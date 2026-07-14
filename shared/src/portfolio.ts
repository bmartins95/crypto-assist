import type { Op, Asset, AssetWithPlatform, Currency, ExchangeRates, Prices, ExitPrices } from './types';

export function convertOpsToUsd(ops: Op[], rates: ExchangeRates): Op[] {
  return ops.map(o => {
    const from: Currency = o.currency ?? 'BRL';
    const rate = rates[from];
    if (!(rate > 0)) throw new Error(`Missing exchange rate for ${from}`);
    return { ...o, price: o.price / rate, fee: o.fee / rate, total: o.total / rate, currency: 'USD' };
  });
}

export function computePositions(ops: Op[]): Omit<Asset, 'exitPrice'>[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  ops.forEach(o => {
    if (!o.coinId) return;
    if (!map[o.coinId]) map[o.coinId] = { coinId: o.coinId, symbol: o.symbol, name: o.name, buyQty: 0, buyTotal: 0, sellQty: 0 };
    if (o.type === 'Buy') { map[o.coinId].buyQty += o.qty; map[o.coinId].buyTotal += o.qty * o.price; }
    else { map[o.coinId].sellQty += o.qty; }
  });
  return Object.values(map).map(m => ({
    coinId: m.coinId, symbol: m.symbol, name: m.name,
    qty: +(m.buyQty - m.sellQty).toFixed(10),
    avgPrice: m.buyQty > 0 ? m.buyTotal / m.buyQty : 0,
  })).filter(a => a.qty > 1e-9);
}

export function collectAssets(ops: Op[], exitPrices: ExitPrices): Asset[] {
  return computePositions(ops).map(p => ({ ...p, exitPrice: exitPrices[p.coinId] || 0 }));
}

export function computePositionsByAssetAndPlatform(ops: Op[]): AssetWithPlatform[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; platformId: string; platformName: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  ops.forEach(o => {
    if (!o.coinId) return;
    const platformId = o.platformId || '';
    const platformName = o.platformName || '';
    const key = o.coinId + '||' + platformId;
    if (!map[key]) map[key] = { coinId: o.coinId, symbol: o.symbol, name: o.name, platformId, platformName, buyQty: 0, buyTotal: 0, sellQty: 0 };
    if (o.type === 'Buy') { map[key].buyQty += o.qty; map[key].buyTotal += o.qty * o.price; }
    else { map[key].sellQty += o.qty; }
  });
  return Object.values(map).map(m => ({
    coinId: m.coinId, symbol: m.symbol, name: m.name, platformId: m.platformId, platformName: m.platformName,
    qty: +(m.buyQty - m.sellQty).toFixed(10),
    avgPrice: m.buyQty > 0 ? m.buyTotal / m.buyQty : 0,
  })).filter(a => a.qty > 1e-9);
}

export interface AssetProfit {
  coinId: string;
  symbol: string;
  name: string;
  investedOpen: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  realizedPnl: number;
  hasOpenPosition: boolean;
  hasPrice: boolean;
}

export function computeProfitByAsset(ops: Op[], prices: Prices): AssetProfit[] {
  const sorted = [...ops].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const map: Record<string, { symbol: string; name: string; qty: number; avgCost: number; realizedPnl: number }> = {};
  sorted.forEach(o => {
    if (!o.coinId) return;
    if (!map[o.coinId]) map[o.coinId] = { symbol: o.symbol, name: o.name, qty: 0, avgCost: 0, realizedPnl: 0 };
    const h = map[o.coinId];
    if (o.type === 'Buy') {
      const newQty = h.qty + o.qty;
      h.avgCost = newQty > 0 ? (h.qty * h.avgCost + o.qty * o.price) / newQty : 0;
      h.qty = newQty;
    } else {
      const sellQty = Math.min(o.qty, h.qty);
      h.realizedPnl += sellQty * (o.price - h.avgCost);
      h.qty -= sellQty;
    }
  });
  return Object.entries(map).map(([coinId, h]) => {
    const qty = +h.qty.toFixed(10);
    const price = prices[coinId] || 0;
    const investedOpen = qty * h.avgCost;
    const currentValue = qty * price;
    const unrealizedPnl = currentValue - investedOpen;
    return {
      coinId, symbol: h.symbol, name: h.name,
      investedOpen, currentValue, unrealizedPnl,
      unrealizedPct: investedOpen > 0 ? (unrealizedPnl / investedOpen) * 100 : 0,
      realizedPnl: h.realizedPnl,
      hasOpenPosition: qty > 1e-9,
      hasPrice: price > 0,
    };
  });
}

// invested/currentValue cover only currently-open positions (what "Valor da carteira" plots);
// pnl additionally folds in P/L already banked from past sells/trades, so "Lucro no tempo"
// doesn't drop a coin's realized gain the moment the position closes.
export interface TimelinePoint {
  date: string;
  invested: number;
  currentValue: number;
  pnl: number;
}

const HISTORICAL_PRICE_FALLBACK_DAYS = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function priceOnDate(historicalPrices: Record<string, Record<string, number>>, coinId: string, date: string): number {
  const byDate = historicalPrices[coinId];
  if (!byDate) return 0;
  let cursor = date;
  for (let i = 0; i <= HISTORICAL_PRICE_FALLBACK_DAYS; i++) {
    if (byDate[cursor] !== undefined) return byDate[cursor];
    cursor = addDaysISO(cursor, -1);
  }
  return 0;
}

function applyOpToHoldings(holdings: Record<string, { qty: number; avgCost: number }>, op: Op): number {
  if (!op.coinId) return 0;
  if (!holdings[op.coinId]) holdings[op.coinId] = { qty: 0, avgCost: 0 };
  const h = holdings[op.coinId];
  if (op.type === 'Buy') {
    const newQty = h.qty + op.qty;
    h.avgCost = newQty > 0 ? (h.qty * h.avgCost + op.qty * op.price) / newQty : 0;
    h.qty = newQty;
    return 0;
  }
  const sellQty = Math.min(op.qty, h.qty);
  const realizedPnl = sellQty * (op.price - h.avgCost);
  h.qty = Math.max(0, h.qty - op.qty);
  return realizedPnl;
}

export function computeTimeline(
  ops: Op[],
  historicalPrices: Record<string, Record<string, number>>,
  from?: string,
  to?: string,
): TimelinePoint[] {
  const sorted = [...ops].filter(o => o.coinId).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rangeFrom = from ?? sorted[0]?.date ?? todayISO();
  const rangeTo = to ?? todayISO();

  const holdings: Record<string, { qty: number; avgCost: number }> = {};
  let realizedPnl = 0;
  let opIndex = 0;
  while (opIndex < sorted.length && sorted[opIndex].date < rangeFrom) {
    realizedPnl += applyOpToHoldings(holdings, sorted[opIndex]);
    opIndex++;
  }

  const result: TimelinePoint[] = [];
  for (let day = rangeFrom; day <= rangeTo; day = addDaysISO(day, 1)) {
    while (opIndex < sorted.length && sorted[opIndex].date === day) {
      realizedPnl += applyOpToHoldings(holdings, sorted[opIndex]);
      opIndex++;
    }

    let invested = 0;
    let currentValue = 0;
    for (const [coinId, h] of Object.entries(holdings)) {
      if (h.qty <= 1e-9) continue;
      invested += h.qty * h.avgCost;
      currentValue += h.qty * priceOnDate(historicalPrices, coinId, day);
    }
    result.push({ date: day, invested, currentValue, pnl: currentValue - invested + realizedPnl });
  }
  return result;
}

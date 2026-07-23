import type { Op, OpClosure, Asset, AssetWithPlatform, Currency, ExchangeRates, Prices, ExitPrices } from './types';

// A cross-asset trade-close (e.g. closing a BTC long by receiving Solana) stores only the
// received op — there is no Sell of the source coin, so the source's holdings would look
// untouched. This derives that missing disposal from each such closure as a synthetic Sell
// of the source coin at the trade value, so every holdings/profit/timeline calculation
// reflects the source having been partially closed without special-casing closures. A
// same-asset close already has a real Sell op, so it is skipped (no double-counting).
export function withClosureAdjustments(ops: Op[], closures: OpClosure[]): Op[] {
  if (!closures.length) return ops;
  const byId = new Map(ops.map((o) => [o.id, o]));
  const synthetic: Op[] = [];
  for (const c of closures) {
    const source = byId.get(c.sourceOpId);
    const closing = byId.get(c.closingOpId);
    if (!source || !closing || source.coinId === closing.coinId) continue;
    const proceeds = closing.total - closing.fee;
    synthetic.push({
      ...source,
      id: `synthetic-close-${c.id}`,
      date: closing.date,
      type: 'Sell',
      qty: c.qtyClosed,
      price: c.qtyClosed > 0 ? proceeds / c.qtyClosed : 0,
      fee: 0,
      total: proceeds,
    });
  }
  return synthetic.length ? [...ops, ...synthetic] : ops;
}

export function convertOpsToUsd(ops: Op[], rates: ExchangeRates): Op[] {
  return ops.map(o => {
    const from: Currency = o.currency ?? 'BRL';
    const rate = rates[from];
    if (!(rate > 0)) throw new Error(`Missing exchange rate for ${from}`);
    return { ...o, price: o.price / rate, fee: o.fee / rate, total: o.total / rate, currency: 'USD' };
  });
}

// Trade (leveraged) positions never represent real held assets, so they're excluded
// from every Wallet/Profit view calculation — a short with zero balance is the clearest
// case of why counting it as a holding would misrepresent the portfolio.
export function walletOnly(ops: Op[]): Op[] {
  return ops.filter(o => (o.kind ?? 'wallet') === 'wallet');
}

export function computePositions(ops: Op[], closures: OpClosure[] = []): Omit<Asset, 'exitPrice'>[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  withClosureAdjustments(walletOnly(ops), closures).forEach(o => {
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

export function collectAssets(ops: Op[], exitPrices: ExitPrices, closures: OpClosure[] = []): Asset[] {
  return computePositions(ops, closures).map(p => ({ ...p, exitPrice: exitPrices[p.coinId] || 0 }));
}

export function computePositionsByAssetAndPlatform(ops: Op[], closures: OpClosure[] = []): AssetWithPlatform[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; platformId: string; platformName: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  withClosureAdjustments(walletOnly(ops), closures).forEach(o => {
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

export function computeProfitByAsset(ops: Op[], prices: Prices, closures: OpClosure[] = []): AssetProfit[] {
  const sorted = [...withClosureAdjustments(walletOnly(ops), closures)].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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

export interface AssetContribution {
  coinId: string;
  symbol: string;
  deltaAbs: number;
}

// invested/currentValue cover only currently-open positions (what "Valor da carteira" plots);
// pnl additionally folds in P/L already banked from past sells/trades, so "Lucro no tempo"
// doesn't drop a coin's realized gain the moment the position closes.
export interface TimelinePoint {
  date: string;
  invested: number;
  currentValue: number;
  pnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dayDeltaAbs: number;
  dayDeltaPct: number;
  opsCount: number;
  assetContribution: AssetContribution[];
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
  closures: OpClosure[] = [],
): TimelinePoint[] {
  const sorted = [...withClosureAdjustments(walletOnly(ops), closures)].filter(o => o.coinId).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rangeFrom = from ?? sorted[0]?.date ?? todayISO();
  const rangeTo = to ?? todayISO();

  const holdings: Record<string, { qty: number; avgCost: number }> = {};
  const realizedByCoin: Record<string, number> = {};
  const symbolByCoin: Record<string, string> = {};
  let realizedPnl = 0;
  let opIndex = 0;

  function applyOp(op: Op): void {
    const coinId = op.coinId as string;
    const realized = applyOpToHoldings(holdings, op);
    realizedByCoin[coinId] = (realizedByCoin[coinId] ?? 0) + realized;
    symbolByCoin[coinId] = op.symbol;
    realizedPnl += realized;
  }

  while (opIndex < sorted.length && sorted[opIndex].date < rangeFrom) {
    applyOp(sorted[opIndex]);
    opIndex++;
  }

  const result: TimelinePoint[] = [];
  let prevPnl = 0;
  let prevCoinTotals: Record<string, number> = {};
  let isFirstPoint = true;

  for (let day = rangeFrom; day <= rangeTo; day = addDaysISO(day, 1)) {
    let opsCount = 0;
    while (opIndex < sorted.length && sorted[opIndex].date === day) {
      applyOp(sorted[opIndex]);
      opIndex++;
      opsCount++;
    }

    let invested = 0;
    let currentValue = 0;
    const coinTotals: Record<string, number> = {};
    const coinIds = new Set([...Object.keys(holdings), ...Object.keys(prevCoinTotals)]);
    for (const coinId of coinIds) {
      const h = holdings[coinId];
      const qty = h && h.qty > 1e-9 ? h.qty : 0;
      const price = qty > 0 ? priceOnDate(historicalPrices, coinId, day) : 0;
      const coinInvested = qty * (h?.avgCost ?? 0);
      const coinValue = qty * price;
      if (qty > 0) {
        invested += coinInvested;
        currentValue += coinValue;
      }
      coinTotals[coinId] = (realizedByCoin[coinId] ?? 0) + coinValue - coinInvested;
    }

    const pnl = currentValue - invested + realizedPnl;
    const dayDeltaAbs = isFirstPoint ? 0 : pnl - prevPnl;
    const dayDeltaPct = isFirstPoint || prevPnl === 0 ? 0 : (dayDeltaAbs / Math.abs(prevPnl)) * 100;

    const assetContribution: AssetContribution[] = [];
    if (!isFirstPoint) {
      for (const coinId of coinIds) {
        const deltaAbs = coinTotals[coinId] - (prevCoinTotals[coinId] ?? 0);
        if (Math.abs(deltaAbs) > 1e-9) {
          assetContribution.push({ coinId, symbol: symbolByCoin[coinId] ?? coinId, deltaAbs });
        }
      }
      assetContribution.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));
    }

    result.push({
      date: day,
      invested,
      currentValue,
      pnl,
      realizedPnl,
      unrealizedPnl: currentValue - invested,
      dayDeltaAbs,
      dayDeltaPct,
      opsCount,
      assetContribution,
    });

    prevPnl = pnl;
    prevCoinTotals = coinTotals;
    isFirstPoint = false;
  }
  return result;
}

export interface AssetPeriodSeries {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  pctChange: number;
  series: number[];
}

// pctChange is the last point of the normalized series, not (last-first)/first — the
// series is already normalized so its first point is 0, making the two equivalent except
// when the series is empty (no price data), where this avoids a NaN from a 0/0 division.
export function computeAssetPeriodSeries(
  ops: Op[],
  historicalPrices: Record<string, Record<string, number>>,
  prices: Prices,
  from: string,
  to: string,
  closures: OpClosure[] = [],
): AssetPeriodSeries[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDaysISO(day, 1)) days.push(day);

  return computePositions(ops, closures).map(p => {
    const rawSeries = days.map(day => priceOnDate(historicalPrices, p.coinId, day));
    const basePrice = rawSeries.find(v => v > 0) ?? 0;
    const hasData = basePrice > 0;
    const series = hasData ? rawSeries.map(v => (v > 0 ? ((v - basePrice) / basePrice) * 100 : 0)) : [];
    const pctChange = series.length > 1 ? series[series.length - 1] : 0;
    return {
      coinId: p.coinId,
      symbol: p.symbol,
      name: p.name,
      price: prices[p.coinId] || 0,
      pctChange,
      series,
    };
  });
}

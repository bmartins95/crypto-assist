import type { Op, Asset, AssetWithPlatform, Prices, ExitPrices } from './types';

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
  const map: Record<string, { coinId: string; symbol: string; name: string; platform: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  ops.forEach(o => {
    if (!o.coinId) return;
    const plat = o.platform || '';
    const key = o.coinId + '||' + plat;
    if (!map[key]) map[key] = { coinId: o.coinId, symbol: o.symbol, name: o.name, platform: plat, buyQty: 0, buyTotal: 0, sellQty: 0 };
    if (o.type === 'Buy') { map[key].buyQty += o.qty; map[key].buyTotal += o.qty * o.price; }
    else { map[key].sellQty += o.qty; }
  });
  return Object.values(map).map(m => ({
    coinId: m.coinId, symbol: m.symbol, name: m.name, platform: m.platform,
    qty: +(m.buyQty - m.sellQty).toFixed(10),
    avgPrice: m.buyQty > 0 ? m.buyTotal / m.buyQty : 0,
  })).filter(a => a.qty > 1e-9);
}

export interface TimelinePoint {
  date: string;
  invested: number;
  currentValue: number;
  pnl: number;
}

export function computeTimeline(ops: Op[], prices: Prices): TimelinePoint[] {
  const sorted = [...ops].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const result: TimelinePoint[] = [];
  const holdings: Record<string, { qty: number; avgCost: number }> = {};
  sorted.forEach(op => {
    if (!op.coinId) return;
    if (!holdings[op.coinId]) holdings[op.coinId] = { qty: 0, avgCost: 0 };
    const h = holdings[op.coinId];
    if (op.type === 'Buy') {
      const newQty = h.qty + op.qty;
      h.avgCost = newQty > 0 ? (h.qty * h.avgCost + op.qty * op.price) / newQty : 0;
      h.qty = newQty;
    } else {
      h.qty = Math.max(0, h.qty - op.qty);
    }
    const invested = Object.values(holdings).reduce((s, x) => s + x.qty * x.avgCost, 0);
    const currentValue = Object.entries(holdings).reduce((s, [id, x]) => s + x.qty * (prices[id] || 0), 0);
    result.push({ date: op.date, invested, currentValue, pnl: currentValue - invested });
  });
  const byDate: Record<string, TimelinePoint> = {};
  result.forEach(r => { byDate[r.date] = r; });
  return Object.values(byDate).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

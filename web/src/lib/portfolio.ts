import type { Op, Asset, AssetWithPlatform, Prices } from './types';
import { storage } from './storage';

export function computePositions(ops: Op[]): Omit<Asset, 'exitPrice'>[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  ops.forEach(o => {
    if (!o.coinId) return;
    if (!map[o.coinId]) map[o.coinId] = { coinId: o.coinId, symbol: o.symbol, name: o.name, buyQty: 0, buyTotal: 0, sellQty: 0 };
    if (o.tipo === 'Compra') { map[o.coinId].buyQty += o.qtd; map[o.coinId].buyTotal += o.qtd * o.preco; }
    else { map[o.coinId].sellQty += o.qtd; }
  });
  return Object.values(map).map(m => ({
    coinId: m.coinId, symbol: m.symbol, name: m.name,
    qty: +(m.buyQty - m.sellQty).toFixed(10),
    avgPrice: m.buyQty > 0 ? m.buyTotal / m.buyQty : 0,
  })).filter(a => a.qty > 1e-9);
}

export function collectAssets(ops: Op[]): Asset[] {
  const exitPrices = storage.getExitPrices();
  return computePositions(ops).map(p => ({ ...p, exitPrice: exitPrices[p.coinId] || 0 }));
}

export function computePositionsByAssetAndPlatform(ops: Op[]): AssetWithPlatform[] {
  const map: Record<string, { coinId: string; symbol: string; name: string; plataforma: string; buyQty: number; buyTotal: number; sellQty: number }> = {};
  ops.forEach(o => {
    if (!o.coinId) return;
    const plat = o.plataforma || 'Sem plataforma';
    const key = o.coinId + '||' + plat;
    if (!map[key]) map[key] = { coinId: o.coinId, symbol: o.symbol, name: o.name, plataforma: plat, buyQty: 0, buyTotal: 0, sellQty: 0 };
    if (o.tipo === 'Compra') { map[key].buyQty += o.qtd; map[key].buyTotal += o.qtd * o.preco; }
    else { map[key].sellQty += o.qtd; }
  });
  return Object.values(map).map(m => ({
    coinId: m.coinId, symbol: m.symbol, name: m.name, plataforma: m.plataforma,
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
  const sorted = [...ops].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const result: TimelinePoint[] = [];
  const holdings: Record<string, { qty: number; avgCost: number }> = {};
  sorted.forEach(op => {
    if (!op.coinId) return;
    if (!holdings[op.coinId]) holdings[op.coinId] = { qty: 0, avgCost: 0 };
    const h = holdings[op.coinId];
    if (op.tipo === 'Compra') {
      const newQty = h.qty + op.qtd;
      h.avgCost = newQty > 0 ? (h.qty * h.avgCost + op.qtd * op.preco) / newQty : 0;
      h.qty = newQty;
    } else {
      h.qty = Math.max(0, h.qty - op.qtd);
    }
    const invested = Object.values(holdings).reduce((s, x) => s + x.qty * x.avgCost, 0);
    const currentValue = Object.entries(holdings).reduce((s, [id, x]) => s + x.qty * (prices[id] || 0), 0);
    result.push({ date: op.data, invested, currentValue, pnl: currentValue - invested });
  });
  const byDate: Record<string, TimelinePoint> = {};
  result.forEach(r => { byDate[r.date] = r; });
  return Object.values(byDate).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

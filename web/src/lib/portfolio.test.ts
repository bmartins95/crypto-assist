import { describe, it, expect, vi, afterEach } from 'vitest';
import { computePositions, computePositionsByAssetAndPlatform, computeTimeline, computeAssetPeriodSeries, computeAssetPositionOnDate, collectAssets, computeProfitByAsset, convertOpsToUsd } from './portfolio';
import type { Op, OpClosure } from './types';

function op(overrides: Partial<Op>): Op {
  return {
    id: 'op-1',
    date: '2024-01-01',
    coinId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'Buy',
    qty: 1,
    price: 100,
    fee: 0,
    total: 100,
    ...overrides,
  };
}

describe('closure-aware holdings (cross-asset trade-close)', () => {
  // Closing 0.5 BTC by receiving 5 SOL, stored as one op: the SOL Buy, linked to the BTC Buy.
  const btc = op({ id: 'btc', coinId: 'bitcoin', symbol: 'BTC', qty: 1, price: 100, total: 100 });
  const sol = op({ id: 'sol', coinId: 'solana', symbol: 'SOL', qty: 5, price: 12, fee: 0, total: 60, date: '2024-02-01' });
  const closure: OpClosure = { id: 'c1', sourceOpId: 'btc', closingOpId: 'sol', qtyClosed: 0.5, realizedPnl: 10 };

  it('reduces the source coin by the closed amount and keeps the received coin', () => {
    const positions = computePositions([btc, sol], [closure]);
    expect(positions.find(p => p.coinId === 'bitcoin')?.qty).toBeCloseTo(0.5);
    expect(positions.find(p => p.coinId === 'solana')?.qty).toBeCloseTo(5);
  });

  it('does not reduce holdings without the closures argument (backwards-compatible)', () => {
    expect(computePositions([btc, sol]).find(p => p.coinId === 'bitcoin')?.qty).toBeCloseTo(1);
  });

  it('does not double-count a same-asset close (a real Sell op already reduces it)', () => {
    const sell = op({ id: 'sell', coinId: 'bitcoin', symbol: 'BTC', type: 'Sell', qty: 0.5, price: 120, total: 60 });
    const sameAsset: OpClosure = { id: 'c2', sourceOpId: 'btc', closingOpId: 'sell', qtyClosed: 0.5, realizedPnl: 10 };
    expect(computePositions([btc, sell], [sameAsset]).find(p => p.coinId === 'bitcoin')?.qty).toBeCloseTo(0.5);
  });

  it('books the cross-asset trade value as realized P/L on the source coin', () => {
    const profit = computeProfitByAsset([btc, sol], {}, [closure]);
    // proceeds = sol.total - sol.fee = 60; cost of 0.5 BTC = 0.5 * 100 = 50 → realized 10.
    expect(profit.find(p => p.coinId === 'bitcoin')?.realizedPnl).toBeCloseTo(10);
  });
});

describe('computePositions', () => {
  it('aggregates buys into a position with the weighted average price', () => {
    const ops = [
      op({ qty: 1, price: 100 }),
      op({ qty: 1, price: 200 }),
    ];
    const [position] = computePositions(ops);
    expect(position.qty).toBe(2);
    expect(position.avgPrice).toBe(150);
  });

  it('subtracts sells from the held quantity without changing the average cost', () => {
    const ops = [
      op({ type: 'Buy', qty: 2, price: 100 }),
      op({ type: 'Sell', qty: 1, price: 999 }),
    ];
    const [position] = computePositions(ops);
    expect(position.qty).toBe(1);
    expect(position.avgPrice).toBe(100);
  });

  it('omits assets whose position has been fully sold off', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ type: 'Sell', qty: 1, price: 100 }),
    ];
    expect(computePositions(ops)).toHaveLength(0);
  });

  it('keeps separate positions per coinId', () => {
    const ops = [
      op({ coinId: 'bitcoin', symbol: 'BTC', qty: 1, price: 100 }),
      op({ coinId: 'ethereum', symbol: 'ETH', qty: 5, price: 10 }),
    ];
    const positions = computePositions(ops);
    expect(positions).toHaveLength(2);
    expect(positions.find((p) => p.coinId === 'ethereum')?.qty).toBe(5);
  });

  it('ignores operations without a coinId', () => {
    expect(computePositions([op({ coinId: '' })])).toHaveLength(0);
  });
});

describe('computePositionsByAssetAndPlatform', () => {
  it('keeps the same asset separate per platform', () => {
    const ops = [
      op({ platformId: 'binance', platformName: 'Binance', qty: 1, price: 100 }),
      op({ platformId: 'metamask', platformName: 'MetaMask', qty: 2, price: 200 }),
    ];
    const positions = computePositionsByAssetAndPlatform(ops);
    expect(positions).toHaveLength(2);
    expect(positions.map((p) => p.platformName).sort()).toEqual(['Binance', 'MetaMask']);
  });

  it('falls back to an empty string when no platform is set', () => {
    const [position] = computePositionsByAssetAndPlatform([op({})]);
    expect(position.platformId).toBe('');
    expect(position.platformName).toBe('');
  });
});

describe('computeTimeline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces one point per day in range, sorted chronologically', () => {
    const ops = [
      op({ date: '2024-01-02', type: 'Buy', qty: 1, price: 100 }),
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 50 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 50, '2024-01-02': 60 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    expect(timeline.map((t) => t.date)).toEqual(['2024-01-01', '2024-01-02']);
  });

  it('prices each day with that day\'s historical price, not a single flat price', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 2, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 120 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    expect(timeline.map((t) => t.currentValue)).toEqual([200, 240]);
    expect(timeline[0].invested).toBe(200);
    expect(timeline[1].pnl).toBe(40);
  });

  it('falls back to the nearest earlier available date within 7 days', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-04');
    expect(timeline.map((t) => t.currentValue)).toEqual([100, 100, 100, 100]);
  });

  it('treats price as zero once the fallback window exceeds 7 days', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-09');
    const last = timeline[timeline.length - 1];
    expect(last.date).toBe('2024-01-09');
    expect(last.currentValue).toBe(0);
  });

  it('never shows an asset contributing before its acquisition date', () => {
    const ops = [op({ date: '2024-01-05', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-05': 100 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-05');
    expect(timeline.find((t) => t.date === '2024-01-01')?.currentValue).toBe(0);
    expect(timeline.find((t) => t.date === '2024-01-05')?.currentValue).toBe(100);
  });

  it('defaults to the earliest op date through today when from/to are omitted', () => {
    vi.setSystemTime(new Date('2024-01-03T00:00:00Z'));
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 100, '2024-01-03': 100 } };
    const timeline = computeTimeline(ops, historicalPrices);
    expect(timeline.map((t) => t.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it("keeps a closed position's realized profit in pnl instead of dropping it once sold", () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 150 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-03');
    expect(timeline[0].pnl).toBe(0);
    expect(timeline[1].currentValue).toBe(0);
    expect(timeline[1].invested).toBe(0);
    expect(timeline[1].pnl).toBe(50);
    expect(timeline[2].pnl).toBe(50);
  });

  it("folds a trade's realized loss into pnl the same way a plain sell does", () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 80 }),
      op({ id: 'op-3', coinId: 'ethereum', symbol: 'ETH', date: '2024-01-02', type: 'Buy', qty: 1, price: 80 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 80 }, ethereum: { '2024-01-02': 80 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    expect(timeline[1].pnl).toBe(-20);
  });

  it('splits pnl into realizedPnl + unrealizedPnl on every point (sold + open positions)', () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 }),
      op({ id: 'op-3', coinId: 'ethereum', symbol: 'ETH', date: '2024-01-02', type: 'Buy', qty: 1, price: 80 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 150 }, ethereum: { '2024-01-02': 80, '2024-01-03': 100 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-03');
    for (const point of timeline) {
      expect(point.realizedPnl + point.unrealizedPnl).toBeCloseTo(point.pnl);
    }
    expect(timeline[2].realizedPnl).toBe(50);
    expect(timeline[2].unrealizedPnl).toBe(20);
  });

  it('counts operations dated exactly that day, and 0 on days with none', () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-01', coinId: 'ethereum', symbol: 'ETH', type: 'Buy', qty: 1, price: 10 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 100 }, ethereum: { '2024-01-01': 10 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    expect(timeline[0].opsCount).toBe(2);
    expect(timeline[1].opsCount).toBe(0);
  });

  it('reports a 0 dayDeltaAbs/dayDeltaPct and no assetContribution on the first point in range, regardless of prior activity', () => {
    const ops = [op({ date: '2023-12-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2023-12-01': 100, '2024-01-01': 400 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-01');
    expect(timeline[0].dayDeltaAbs).toBe(0);
    expect(timeline[0].dayDeltaPct).toBe(0);
    expect(timeline[0].assetContribution).toEqual([]);
  });

  it('does not produce NaN% when the previous day pnl was exactly 0', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 100 } };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    expect(timeline[0].pnl).toBe(0);
    expect(timeline[1].dayDeltaPct).toBe(0);
    expect(Number.isNaN(timeline[1].dayDeltaPct)).toBe(false);
  });

  it('attributes a day\'s pnl delta to the asset(s) that caused it, sorted by magnitude', () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', coinId: 'ethereum', symbol: 'ETH', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
    ];
    const historicalPrices = {
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 100, '2024-01-02': 105 },
    };
    const timeline = computeTimeline(ops, historicalPrices, '2024-01-01', '2024-01-02');
    const [top, second] = timeline[1].assetContribution;
    expect(top.coinId).toBe('bitcoin');
    expect(top.deltaAbs).toBeCloseTo(10);
    expect(second.coinId).toBe('ethereum');
    expect(second.deltaAbs).toBeCloseTo(5);
  });
});

describe('computeAssetPeriodSeries', () => {
  it('normalizes each held asset\'s prices into a % series starting at 0', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 110, '2024-01-03': 90 } };
    const [series] = computeAssetPeriodSeries(ops, historicalPrices, { bitcoin: 90 }, '2024-01-01', '2024-01-03');
    expect(series.coinId).toBe('bitcoin');
    expect(series.series).toEqual([0, 10, -10]);
    expect(series.pctChange).toBe(-10);
    expect(series.price).toBe(90);
    expect(series.priceSeries).toEqual([100, 110, 90]);
    expect(series.absChange).toBe(-10);
  });

  it('returns an empty series (not an error) when an asset has no price history in range', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const [series] = computeAssetPeriodSeries(ops, {}, {}, '2024-01-01', '2024-01-03');
    expect(series.series).toEqual([]);
    expect(series.priceSeries).toEqual([]);
    expect(series.pctChange).toBe(0);
    expect(series.absChange).toBe(0);
    expect(Number.isNaN(series.pctChange)).toBe(false);
  });

  it('reports pctChange/absChange 0 (not NaN) for a single-day period', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100 } };
    const [series] = computeAssetPeriodSeries(ops, historicalPrices, { bitcoin: 100 }, '2024-01-01', '2024-01-01');
    expect(series.series).toEqual([0]);
    expect(series.pctChange).toBe(0);
    expect(series.absChange).toBe(0);
  });

  it('falls back to basePrice (not the raw 0) when the last day is beyond the price-history fallback window', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    const historicalPrices = { bitcoin: { '2024-01-01': 100 } };
    const [series] = computeAssetPeriodSeries(ops, historicalPrices, { bitcoin: 100 }, '2024-01-01', '2024-01-10');
    expect(series.priceSeries[series.priceSeries.length - 1]).toBe(0);
    expect(series.absChange).toBe(0);
  });

  it('ignores fully-closed positions, same as computePositions', () => {
    const ops = [
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 100 }),
    ];
    const historicalPrices = { bitcoin: { '2024-01-01': 100, '2024-01-02': 100 } };
    expect(computeAssetPeriodSeries(ops, historicalPrices, {}, '2024-01-01', '2024-01-02')).toHaveLength(0);
  });
});

describe('computeAssetPositionOnDate', () => {
  it('returns the quantity/avg price held as of the given date, ignoring later ops', () => {
    const ops = [
      op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 2, price: 100 }),
      op({ id: 's1', date: '2024-01-05', type: 'Sell', qty: 1, price: 150 }),
    ];
    const before = computeAssetPositionOnDate(ops, 'bitcoin', '2024-01-01');
    expect(before.qty).toBeCloseTo(2);
    expect(before.avgPrice).toBeCloseTo(100);
    const after = computeAssetPositionOnDate(ops, 'bitcoin', '2024-01-05');
    expect(after.qty).toBeCloseTo(1);
  });

  it('lists only acquisitions on or before the date, newest first', () => {
    const ops = [
      op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'b2', date: '2024-01-03', type: 'Buy', qty: 1, price: 110 }),
      op({ id: 'b3', date: '2024-01-10', type: 'Buy', qty: 1, price: 120 }),
    ];
    const { acquisitions } = computeAssetPositionOnDate(ops, 'bitcoin', '2024-01-03');
    expect(acquisitions.map(a => a.id)).toEqual(['b2', 'b1']);
  });

  it('returns zero qty/avgPrice for a coin with no ops on or before the date', () => {
    const ops = [op({ id: 'b1', date: '2024-06-01', type: 'Buy', qty: 1, price: 100 })];
    const position = computeAssetPositionOnDate(ops, 'bitcoin', '2024-01-01');
    expect(position.qty).toBe(0);
    expect(position.avgPrice).toBe(0);
    expect(position.acquisitions).toHaveLength(0);
  });

  it('accounts for closure adjustments in the point-in-time quantity', () => {
    const btc = op({ id: 'btc', coinId: 'bitcoin', symbol: 'BTC', qty: 1, price: 100, total: 100, date: '2024-01-01' });
    const sol = op({ id: 'sol', coinId: 'solana', symbol: 'SOL', qty: 5, price: 12, fee: 0, total: 60, date: '2024-02-01' });
    const closure: OpClosure = { id: 'c1', sourceOpId: 'btc', closingOpId: 'sol', qtyClosed: 0.5, realizedPnl: 10 };
    const position = computeAssetPositionOnDate([btc, sol], 'bitcoin', '2024-02-01', [closure]);
    expect(position.qty).toBeCloseTo(0.5);
  });
});

describe('collectAssets', () => {
  it('attaches the exit price passed in, defaulting to 0 when absent', () => {
    const ops = [op({ coinId: 'bitcoin', qty: 1, price: 100 }), op({ coinId: 'ethereum', qty: 1, price: 10 })];
    const assets = collectAssets(ops, { bitcoin: 500000 });
    expect(assets.find((a) => a.coinId === 'bitcoin')?.exitPrice).toBe(500000);
    expect(assets.find((a) => a.coinId === 'ethereum')?.exitPrice).toBe(0);
  });
});

describe('computeProfitByAsset', () => {
  it('attributes P/L to realizedPnl only when the position is fully closed', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ date: '2024-01-02', type: 'Sell', qty: 1, price: 150 }),
    ];
    const [profit] = computeProfitByAsset(ops, {});
    expect(profit.realizedPnl).toBe(50);
    expect(profit.unrealizedPnl).toBe(0);
    expect(profit.hasOpenPosition).toBe(false);
  });

  it('attributes P/L to unrealizedPnl only when the position is fully open', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    const [profit] = computeProfitByAsset(ops, { bitcoin: 150 });
    expect(profit.realizedPnl).toBe(0);
    expect(profit.unrealizedPnl).toBe(50);
    expect(profit.hasOpenPosition).toBe(true);
  });

  it('splits realized and unrealized correctly on a partial sell without double-counting cost basis', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ date: '2024-01-02', type: 'Sell', qty: 0.5, price: 150 }),
    ];
    const [profit] = computeProfitByAsset(ops, { bitcoin: 150 });
    expect(profit.realizedPnl).toBe(25);
    expect(profit.investedOpen).toBe(50);
    expect(profit.unrealizedPnl).toBe(25);
    expect(profit.hasOpenPosition).toBe(true);
  });

  it('marks an asset as priceless when no price is available for it', () => {
    const [profit] = computeProfitByAsset([op({ type: 'Buy', qty: 1, price: 100 })], {});
    expect(profit.hasPrice).toBe(false);
    expect(profit.currentValue).toBe(0);
  });

  it('ignores operations without a coinId', () => {
    expect(computeProfitByAsset([op({ coinId: '' })], {})).toHaveLength(0);
  });
});

describe('convertOpsToUsd', () => {
  const rates = { BRL: 5, USD: 1, EUR: 0.9, GBP: 0.8, JPY: 150 };

  it('treats ops without a currency as BRL', () => {
    const [converted] = convertOpsToUsd([op({ price: 100, fee: 5, total: 105 })], rates);
    expect(converted.price).toBe(20);
    expect(converted.fee).toBe(1);
    expect(converted.total).toBe(21);
    expect(converted.currency).toBe('USD');
  });

  it('passes USD ops through unchanged', () => {
    const [converted] = convertOpsToUsd([op({ price: 100, fee: 5, total: 105, currency: 'USD' })], rates);
    expect(converted.price).toBe(100);
    expect(converted.fee).toBe(5);
    expect(converted.total).toBe(105);
  });

  it('converts mixed-currency ops so totals aggregate consistently', () => {
    const ops = [
      op({ id: 'a', qty: 1, price: 500, total: 500, currency: 'BRL' }),
      op({ id: 'b', qty: 1, price: 100, total: 100, currency: 'USD' }),
      op({ id: 'c', qty: 1, price: 15000, total: 15000, currency: 'JPY' }),
    ];
    const converted = convertOpsToUsd(ops, rates);
    expect(converted.map(o => o.price)).toEqual([100, 100, 100]);
    const [position] = computePositions(converted);
    expect(position.qty).toBe(3);
    expect(position.avgPrice).toBe(100);
  });

  it('does not mutate quantity, dates or the input array', () => {
    const source = [op({ qty: 2.5, price: 50, currency: 'BRL' })];
    const converted = convertOpsToUsd(source, rates);
    expect(converted[0].qty).toBe(2.5);
    expect(converted[0].date).toBe('2024-01-01');
    expect(source[0].price).toBe(50);
  });

  it('throws on a missing rate instead of producing silent garbage', () => {
    expect(() => convertOpsToUsd([op({ currency: 'EUR' })], { ...rates, EUR: 0 })).toThrow(/EUR/);
  });
});

import { describe, it, expect } from 'vitest';
import { computePositions, computePositionsByAssetAndPlatform, computeTimeline, collectAssets, computeProfitByAsset, convertOpsToUsd } from './portfolio';
import type { Op } from './types';

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
    platform: '',
    ...overrides,
  };
}

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
      op({ platform: 'Binance', qty: 1, price: 100 }),
      op({ platform: 'MetaMask', qty: 2, price: 200 }),
    ];
    const positions = computePositionsByAssetAndPlatform(ops);
    expect(positions).toHaveLength(2);
    expect(positions.map((p) => p.platform).sort()).toEqual(['Binance', 'MetaMask']);
  });

  it('falls back to an empty string when the platform is empty', () => {
    const [position] = computePositionsByAssetAndPlatform([op({ platform: '' })]);
    expect(position.platform).toBe('');
  });
});

describe('computeTimeline', () => {
  it('produces one point per date, sorted chronologically', () => {
    const ops = [
      op({ date: '2024-01-02', type: 'Buy', qty: 1, price: 100 }),
      op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 50 }),
    ];
    const timeline = computeTimeline(ops, { bitcoin: 150 });
    expect(timeline.map((t) => t.date)).toEqual(['2024-01-01', '2024-01-02']);
  });

  it('computes invested and current value using the given prices', () => {
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 2, price: 100 })];
    const [point] = computeTimeline(ops, { bitcoin: 120 });
    expect(point.invested).toBe(200);
    expect(point.currentValue).toBe(240);
    expect(point.pnl).toBe(40);
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

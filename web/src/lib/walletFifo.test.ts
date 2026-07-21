import { describe, it, expect } from 'vitest';
import { computeWalletBalance, computeWalletRealizedPnl, computeWalletEditImpact } from '@crypto-assist/shared';
import type { Op } from '@crypto-assist/shared';

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
    platformId: 'binance',
    platformName: 'Binance',
    currency: 'BRL',
    kind: 'wallet',
    ...overrides,
  };
}

describe('computeWalletBalance', () => {
  it('returns zero balance with no ops', () => {
    expect(computeWalletBalance([], 'bitcoin', 'binance', 'BRL')).toEqual({ availableQty: 0, avgCost: 0 });
  });

  it('sums multiple buys at different prices into a weighted average cost', () => {
    const ops = [
      op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'b2', date: '2024-01-02', type: 'Buy', qty: 1, price: 200 }),
    ];
    expect(computeWalletBalance(ops, 'bitcoin', 'binance', 'BRL')).toEqual({ availableQty: 2, avgCost: 150 });
  });

  it('consumes the oldest lot first on a partial sell', () => {
    const ops = [
      op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'b2', date: '2024-01-02', type: 'Buy', qty: 1, price: 200 }),
      op({ id: 's1', date: '2024-01-03', type: 'Sell', qty: 1, price: 150 }),
    ];
    // The 100-cost lot is consumed first; only the 200-cost lot remains.
    expect(computeWalletBalance(ops, 'bitcoin', 'binance', 'BRL')).toEqual({ availableQty: 1, avgCost: 200 });
  });

  it('ignores ops on a different platform or coin', () => {
    const ops = [
      op({ id: 'b1', type: 'Buy', qty: 1, price: 100, platformId: 'binance' }),
      op({ id: 'b2', type: 'Buy', qty: 5, price: 100, platformId: 'kraken' }),
      op({ id: 'b3', type: 'Buy', qty: 5, price: 100, coinId: 'ethereum' }),
    ];
    expect(computeWalletBalance(ops, 'bitcoin', 'binance', 'BRL').availableQty).toBe(1);
  });

  it('ignores trade-kind ops entirely', () => {
    const ops = [op({ id: 't1', type: 'Buy', qty: 10, price: 100, kind: 'trade', side: 'long' })];
    expect(computeWalletBalance(ops, 'bitcoin', 'binance', 'BRL').availableQty).toBe(0);
  });
});

describe('computeWalletRealizedPnl', () => {
  it('returns 0 for a Buy', () => {
    const buy = op({ id: 'b1', type: 'Buy', qty: 1, price: 100 });
    expect(computeWalletRealizedPnl(buy, [buy])).toBe(0);
  });

  it('computes profit for a sell against a single lot', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 });
    const sell = op({ id: 's1', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 });
    expect(computeWalletRealizedPnl(sell, [buy, sell])).toBe(50);
  });

  it('splits realized P/L across multiple consumed lots at their own cost', () => {
    const buy1 = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 });
    const buy2 = op({ id: 'b2', date: '2024-01-02', type: 'Buy', qty: 1, price: 200 });
    const sell = op({ id: 's1', date: '2024-01-03', type: 'Sell', qty: 2, price: 180 });
    // (180-100)*1 + (180-200)*1 = 80 - 20 = 60
    expect(computeWalletRealizedPnl(sell, [buy1, buy2, sell])).toBe(60);
  });
});

describe('computeWalletEditImpact', () => {
  it('reports no impact when no later ops depend on the edited one', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 });
    const impact = computeWalletEditImpact([buy], 'b1', { ...buy, qty: 2 });
    expect(impact).toEqual({ affectedCount: 0, firstNegativeBalanceDate: null });
  });

  it('flags a later sell as affected when an earlier buy is edited', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 2, price: 100 });
    const sell = op({ id: 's1', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 });
    const impact = computeWalletEditImpact([buy, sell], 'b1', { ...buy, price: 50 });
    expect(impact.affectedCount).toBe(1);
    expect(impact.firstNegativeBalanceDate).toBeNull();
  });

  it('detects a negative balance when a buy is edited down below what a later sell consumed', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 2, price: 100 });
    const sell = op({ id: 's1', date: '2024-01-02', type: 'Sell', qty: 1.5, price: 150 });
    const impact = computeWalletEditImpact([buy, sell], 'b1', { ...buy, qty: 1 });
    expect(impact.firstNegativeBalanceDate).toBe('2024-01-02');
  });

  it('detects a negative balance when a buy is deleted entirely', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100 });
    const sell = op({ id: 's1', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 });
    const impact = computeWalletEditImpact([buy, sell], 'b1', null);
    expect(impact.firstNegativeBalanceDate).toBe('2024-01-02');
  });

  it('handles a move to a different platform by checking both the old and new groups', () => {
    const buy = op({ id: 'b1', date: '2024-01-01', type: 'Buy', qty: 1, price: 100, platformId: 'binance' });
    const sell = op({ id: 's1', date: '2024-01-02', type: 'Sell', qty: 1, price: 150, platformId: 'binance' });
    const impact = computeWalletEditImpact([buy, sell], 'b1', { ...buy, platformId: 'kraken', platformName: 'Kraken' });
    // Moving the only buy away from 'binance' leaves the later sell there with nothing to consume.
    expect(impact.firstNegativeBalanceDate).toBe('2024-01-02');
  });
});

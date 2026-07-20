import { describe, it, expect } from 'vitest';
import { computeOpStatus, openQtyRemaining, realizedPnlFor, hasClosure, estimateClosePnl } from '@crypto-assist/shared';
import type { Op, OpClosure } from '@crypto-assist/shared';

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

function closure(overrides: Partial<OpClosure>): OpClosure {
  return {
    id: 'closure-1',
    sourceOpId: 'op-1',
    closingOpId: 'op-2',
    qtyClosed: 1,
    realizedPnl: 0,
    ...overrides,
  };
}

describe('computeOpStatus', () => {
  it('is open when there are no closures against it', () => {
    expect(computeOpStatus(op({ qty: 2 }), [])).toBe('open');
  });

  it('is partial when some but not all of its quantity is closed', () => {
    const closures = [closure({ sourceOpId: 'op-1', qtyClosed: 1 })];
    expect(computeOpStatus(op({ id: 'op-1', qty: 2 }), closures)).toBe('partial');
  });

  it('is closed when the full quantity has been closed', () => {
    const closures = [closure({ sourceOpId: 'op-1', qtyClosed: 2 })];
    expect(computeOpStatus(op({ id: 'op-1', qty: 2 }), closures)).toBe('closed');
  });

  it('is closed when multiple closures together cover the full quantity', () => {
    const closures = [
      closure({ id: 'c1', sourceOpId: 'op-1', qtyClosed: 1 }),
      closure({ id: 'c2', sourceOpId: 'op-1', qtyClosed: 1 }),
    ];
    expect(computeOpStatus(op({ id: 'op-1', qty: 2 }), closures)).toBe('closed');
  });

  it('ignores closures referencing a different op', () => {
    const closures = [closure({ sourceOpId: 'op-2', qtyClosed: 1 })];
    expect(computeOpStatus(op({ id: 'op-1', qty: 2 }), closures)).toBe('open');
  });
});

describe('openQtyRemaining', () => {
  it('subtracts the sum of closures from the op quantity', () => {
    const closures = [closure({ sourceOpId: 'op-1', qtyClosed: 0.4 })];
    expect(openQtyRemaining(op({ id: 'op-1', qty: 1 }), closures)).toBeCloseTo(0.6);
  });

  it('equals the full quantity when there are no closures', () => {
    expect(openQtyRemaining(op({ id: 'op-1', qty: 1 }), [])).toBe(1);
  });
});

describe('realizedPnlFor', () => {
  it('sums realized P/L across closures where the op is the source', () => {
    const closures = [closure({ sourceOpId: 'op-1', realizedPnl: 3 })];
    expect(realizedPnlFor('op-1', closures)).toBe(3);
  });

  it('sums realized P/L across closures where the op is the closing leg', () => {
    const closures = [closure({ closingOpId: 'op-2', realizedPnl: 3 })];
    expect(realizedPnlFor('op-2', closures)).toBe(3);
  });

  it('is zero for an op referenced by no closures', () => {
    expect(realizedPnlFor('op-1', [])).toBe(0);
  });
});

describe('hasClosure', () => {
  it('is true when the op is a source', () => {
    expect(hasClosure('op-1', [closure({ sourceOpId: 'op-1' })])).toBe(true);
  });

  it('is true when the op is a closing leg', () => {
    expect(hasClosure('op-2', [closure({ closingOpId: 'op-2' })])).toBe(true);
  });

  it('is false when the op has no closures', () => {
    expect(hasClosure('op-1', [])).toBe(false);
  });
});

describe('estimateClosePnl', () => {
  it('computes P/L for a Sell closing an open Buy', () => {
    const source = op({ type: 'Buy', price: 100 });
    const closing = op({ type: 'Sell', price: 150 });
    expect(estimateClosePnl(source, closing, 2)).toBe(100); // 2 * (150 - 100)
  });

  it('computes P/L for a Buy closing an open Sell', () => {
    const source = op({ type: 'Sell', price: 150 });
    const closing = op({ type: 'Buy', price: 100 });
    expect(estimateClosePnl(source, closing, 2)).toBe(100); // 2 * (150 - 100)
  });

  it('is negative when the close is at a loss', () => {
    const source = op({ type: 'Buy', price: 150 });
    const closing = op({ type: 'Sell', price: 100 });
    expect(estimateClosePnl(source, closing, 1)).toBe(-50);
  });
});

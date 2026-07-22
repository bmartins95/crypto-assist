import { describe, it, expect } from 'vitest';
import { computeCycles } from '@crypto-assist/shared';
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
    platformId: 'binance',
    platformName: 'Binance',
    currency: 'BRL',
    kind: 'trade',
    side: 'long',
    ...overrides,
  };
}

function closure(overrides: Partial<OpClosure>): OpClosure {
  return { id: 'c1', sourceOpId: 'entry', closingOpId: 'exit', qtyClosed: 1, realizedPnl: 0, ...overrides };
}

describe('computeCycles', () => {
  it('resolves a single entry with a single full exit to one closed cycle', () => {
    const entry = op({ id: 'entry', date: '2024-01-01', qty: 1 });
    const exit = op({ id: 'exit', date: '2024-01-05', type: 'Sell', qty: 1, price: 150 });
    const closures = [closure({ qtyClosed: 1, realizedPnl: 50 })];
    const cycles = computeCycles([entry, exit], closures);
    const cycle = cycles.get('entry');
    expect(cycle).toBeDefined();
    expect(cycles.get('exit')).toBe(cycle);
    expect(cycle?.status).toBe('closed');
    expect(cycle?.qtyRemaining).toBe(0);
    expect(cycle?.realizedPnl).toBe(50);
    expect(cycle?.entries.map(e => e.id)).toEqual(['entry']);
    expect(cycle?.exits.map(e => e.id)).toEqual(['exit']);
  });

  it('resolves a single entry with multiple partial exits to one partial cycle', () => {
    const entry = op({ id: 'entry', date: '2024-01-01', qty: 2 });
    const exit1 = op({ id: 'exit1', date: '2024-01-05', type: 'Sell', qty: 1, price: 150 });
    const exit2 = op({ id: 'exit2', date: '2024-01-10', type: 'Sell', qty: 0.5, price: 120 });
    const closures = [
      closure({ id: 'c1', closingOpId: 'exit1', qtyClosed: 1, realizedPnl: 50 }),
      closure({ id: 'c2', closingOpId: 'exit2', qtyClosed: 0.5, realizedPnl: 10 }),
    ];
    const cycles = computeCycles([entry, exit1, exit2], closures);
    const cycle = cycles.get('entry');
    expect(cycle?.status).toBe('partial');
    expect(cycle?.qtyRemaining).toBe(0.5);
    expect(cycle?.realizedPnl).toBe(60);
    expect(cycle?.exits).toHaveLength(2);
  });

  it('resolves a multi-entry component (two entries closed by one exit) into a single cycle', () => {
    const entry1 = op({ id: 'e1', date: '2024-01-01', qty: 1 });
    const entry2 = op({ id: 'e2', date: '2024-01-02', qty: 1 });
    const exit = op({ id: 'exit', date: '2024-01-05', type: 'Sell', qty: 2, price: 150 });
    const closures = [
      closure({ id: 'c1', sourceOpId: 'e1', closingOpId: 'exit', qtyClosed: 1, realizedPnl: 50 }),
      closure({ id: 'c2', sourceOpId: 'e2', closingOpId: 'exit', qtyClosed: 1, realizedPnl: 50 }),
    ];
    const cycles = computeCycles([entry1, entry2, exit], closures);
    const cycle = cycles.get('e1');
    expect(cycle?.entries).toHaveLength(2);
    expect(cycle).toBe(cycles.get('e2'));
    expect(cycle).toBe(cycles.get('exit'));
    expect(cycle?.status).toBe('closed');
  });

  it('assigns no cycle to an op with no closure link', () => {
    const entry = op({ id: 'lonely', date: '2024-01-01' });
    const cycles = computeCycles([entry], []);
    expect(cycles.has('lonely')).toBe(false);
  });

  it('never resolves a wallet op to a cycle even if closures reference it', () => {
    const walletOp = op({ id: 'w1', kind: 'wallet', side: undefined });
    const exit = op({ id: 'exit', type: 'Sell', kind: 'wallet', side: undefined });
    const closures = [closure({ sourceOpId: 'w1', closingOpId: 'exit' })];
    const cycles = computeCycles([walletOp, exit], closures);
    expect(cycles.size).toBe(0);
  });

  it('labels cycles sequentially per coin in chronological order of the earliest entry', () => {
    const entryA = op({ id: 'a-entry', coinId: 'bitcoin', symbol: 'BTC', date: '2024-01-01' });
    const exitA = op({ id: 'a-exit', coinId: 'bitcoin', symbol: 'BTC', type: 'Sell', date: '2024-01-02' });
    const entryB = op({ id: 'b-entry', coinId: 'bitcoin', symbol: 'BTC', date: '2024-02-01' });
    const exitB = op({ id: 'b-exit', coinId: 'bitcoin', symbol: 'BTC', type: 'Sell', date: '2024-02-02' });
    const closures = [
      closure({ id: 'c1', sourceOpId: 'a-entry', closingOpId: 'a-exit' }),
      closure({ id: 'c2', sourceOpId: 'b-entry', closingOpId: 'b-exit' }),
    ];
    const cycles = computeCycles([entryA, exitA, entryB, exitB], closures);
    expect(cycles.get('a-entry')?.cycleLabel).toBe('BTC-1');
    expect(cycles.get('b-entry')?.cycleLabel).toBe('BTC-2');
  });
});

import { describe, it, expect } from 'vitest';
import { fmt, fmtPct, fmtQty, fmtDate } from './format';

describe('fmt', () => {
  it('formats a positive value as BRL', () => {
    expect(fmt(1234.5)).toBe('R$ 1.234,50');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('R$ 0,00');
  });

  it('formats a negative value', () => {
    expect(fmt(-50)).toBe('R$ -50,00');
  });
});

describe('fmtPct', () => {
  it('prefixes positive values with a plus sign', () => {
    expect(fmtPct(12.345)).toBe('+12.35%');
  });

  it('does not prefix negative values', () => {
    expect(fmtPct(-5)).toBe('-5.00%');
  });

  it('prefixes zero with a plus sign', () => {
    expect(fmtPct(0)).toBe('+0.00%');
  });
});

describe('fmtQty', () => {
  it('formats with up to 8 decimal digits', () => {
    expect(fmtQty(0.00012345)).toBe('0,00012345');
  });

  it('keeps at least 2 decimal digits', () => {
    expect(fmtQty(2)).toBe('2,00');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date string as pt-BR', () => {
    expect(fmtDate('2024-01-15')).toBe('15/01/2024');
  });

  it('returns a dash for an empty string', () => {
    expect(fmtDate('')).toBe('—');
  });
});

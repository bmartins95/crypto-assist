import { describe, it, expect } from 'vitest';
import { fmt, fmtPct, fmtQty, fmtDate, currencySymbol } from './format';

const norm = (s: string) => s.replace(/ /g, ' ');


describe('fmt', () => {
  it('formats a positive value as BRL', () => {
    expect(norm(fmt(1234.5))).toBe('R$ 1.234,50');
  });

  it('formats zero', () => {
    expect(norm(fmt(0))).toBe('R$ 0,00');
  });

  it('formats a negative value', () => {
    expect(norm(fmt(-50))).toBe('-R$ 50,00');
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
  it('rounds values >= 1 to a flat 2 decimals, no matter how much precision the input has', () => {
    expect(fmtQty(2762.83407874)).toBe('2.762,83');
  });

  it('keeps at least 2 decimal digits for whole numbers', () => {
    expect(fmtQty(2)).toBe('2,00');
  });

  it('keeps at least 2 significant decimals for a value under 1', () => {
    expect(fmtQty(0.042)).toBe('0,042');
  });

  it('extends past more leading zeros to keep 2 significant decimals', () => {
    expect(fmtQty(0.00012345)).toBe('0,00012');
  });

  it('caps small-value precision at 8 decimals', () => {
    expect(fmtQty(0.0000000012345)).toBe('0,00000000');
  });

  it('formats exactly zero with 2 decimals', () => {
    expect(fmtQty(0)).toBe('0,00');
  });

  it('applies the same significant-decimal rule to negative values under 1', () => {
    expect(fmtQty(-0.0042)).toBe('-0,0042');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date string as pt-BR', () => {
    expect(fmtDate('2024-01-15')).toBe('15/01/2024');
  });

  it('returns a dash for an empty string', () => {
    expect(fmtDate('')).toBe('—');
  });

  it('formats a date in de-DE locale', () => {
    expect(fmtDate('2024-01-15', 'de-DE')).toBe('15.1.2024');
  });
});

describe('fmt with locale and currency', () => {
  it('formats in en-US with USD', () => {
    const result = fmt(1234.56, 'en-US', 'USD');
    expect(result.replace(/ /g, ' ')).toBe('$1,234.56');
  });

  it('uses pt-BR and BRL when called with no arguments', () => {
    const result = fmt(1234.5);
    expect(result.replace(/ /g, ' ')).toBe('R$ 1.234,50');
  });
});

describe('fmtQty with locale', () => {
  it('formats quantity in ja-JP locale', () => {
    expect(fmtQty(1.5, 'ja-JP')).toBe('1.50');
  });
});
describe('fmt per-currency decimal rules', () => {
  it('formats JPY with zero decimal places', () => {
    expect(fmt(157320, 'ja-JP', 'JPY').replace(/ /g, ' ')).toBe('￥157,320');
  });

  it('rounds JPY fractions instead of showing decimals', () => {
    expect(fmt(99.6, 'en-US', 'JPY').replace(/ /g, ' ')).toBe('¥100');
  });

  it('formats EUR and GBP with two decimals', () => {
    expect(fmt(1234.5, 'de-DE', 'EUR').replace(/ /g, ' ')).toBe('1.234,50 €');
    expect(fmt(1234.5, 'en-US', 'GBP').replace(/ /g, ' ')).toBe('£1,234.50');
  });
});

describe('currencySymbol', () => {
  it('returns R$ for BRL in pt-BR', () => {
    expect(currencySymbol('BRL', 'pt-BR')).toBe('R$');
  });

  it('returns $ for USD in en-US', () => {
    expect(currencySymbol('USD', 'en-US')).toBe('$');
  });

  it('defaults to pt-BR when no locale is given', () => {
    expect(currencySymbol('USD')).toBe('US$');
  });
});

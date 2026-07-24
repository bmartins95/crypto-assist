import type { Locale } from './i18n/types';

// No explicit fraction digits: Intl applies each currency's own rules (JPY → 0, BRL/USD/EUR/GBP → 2).
export const fmt = (v: number, locale: Locale = 'pt-BR', currency = 'BRL'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v);

// Locale-native compact notation (e.g. en-US "R$163.4K", pt-BR "R$163 mil") — used where
// space is tight and exact cents don't matter, never for figures the user reconciles against.
export const fmtCompact = (v: number, locale: Locale = 'pt-BR', currency = 'BRL'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);

export const fmtPct = (v: number): string =>
  (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';

const QTY_MAX_DECIMALS = 8;
const QTY_MIN_SIGNIFICANT_DECIMALS = 2;

// Quantities >= 1 round to a flat 2 decimals — extra precision there is just noise.
// Quantities under 1 (e.g. a fraction of a BTC) instead keep at least 2 significant
// decimals past the leading zeros, so a small value doesn't collapse to "0.00".
export const fmtQty = (v: number, locale: Locale = 'pt-BR'): string => {
  const n = Number(v);
  const abs = Math.abs(n);
  const decimals = abs > 0 && abs < 1
    ? Math.min(Math.floor(-Math.log10(abs)) + QTY_MIN_SIGNIFICANT_DECIMALS, QTY_MAX_DECIMALS)
    : 2;
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const fmtDate = (s: string, locale: Locale = 'pt-BR'): string =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString(locale) : '—';

// The bare currency symbol/code Intl would prefix a formatted amount with (e.g. "R$",
// "$", "€") — for a money input's static prefix affix, where the amount itself is
// typed separately and re-formatting it on every keystroke isn't wanted.
export const currencySymbol = (currency: string, locale: Locale = 'pt-BR'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(0)
    .find(p => p.type === 'currency')?.value ?? currency;

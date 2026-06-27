import type { Locale } from './i18n/types';

export const fmt = (v: number, locale: Locale = 'pt-BR', currency = 'BRL'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const fmtPct = (v: number): string =>
  (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';

export const fmtQty = (v: number, locale: Locale = 'pt-BR'): string =>
  Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export const fmtDate = (s: string, locale: Locale = 'pt-BR'): string =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString(locale) : '—';

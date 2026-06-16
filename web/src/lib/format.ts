export const fmt = (v: number) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (v: number) =>
  (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';

export const fmtQtd = (v: number) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export const fmtDate = (s: string) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

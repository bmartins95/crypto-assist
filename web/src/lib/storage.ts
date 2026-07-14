import type { AvatarCache, NewOp, ExitPrices } from './types';

// Ops, exit prices and live CoinGecko prices now live in the backend
// (see lib/api/client.ts) — this module only keeps purely client-side,
// non-account data: the avatar image cache and the one-time legacy-data
// migration helpers below.
export const storage = {
  getAvatars: (): AvatarCache => JSON.parse(localStorage.getItem('cp_avatars') || '{}'),
  setAvatars: (a: AvatarCache) => localStorage.setItem('cp_avatars', JSON.stringify(a)),
};

// ─── Legacy localStorage migration ─────────────────────────────────────────
// Before the backend existed, ops/exit-prices lived in these same
// localStorage keys (see PLANO_BACKEND.md → "Migrating existing data").
// On first authenticated load, the dashboard checks for this data and offers
// to import it into the user's account.

// cp_ops written before 2026-06-24 used Portuguese field names (data/tipo/qtd/
// preco/taxa/plataforma) and Portuguese type values; both shapes must import.
const LEGACY_TYPE_MAP: Record<string, NewOp['type']> = {
  Compra: 'Buy',
  Venda: 'Sell',
  Buy: 'Buy',
  Sell: 'Sell',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Mirrors backend/app/platform_resolve.py's _slugify — a browser-side legacy op has
// no catalog access at normalization time, so its free-text platform becomes a
// custom platform directly (same treatment a manually-typed custom platform gets).
function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'platform';
}

function normalizeLegacyOp(raw: unknown): NewOp[] {
  if (!isRecord(raw)) return [];
  const type = LEGACY_TYPE_MAP[String(raw.type ?? raw.tipo)];
  const date = raw.date ?? raw.data;
  const qty = raw.qty ?? raw.qtd;
  const price = raw.price ?? raw.preco;
  const fee = raw.fee ?? raw.taxa ?? 0;
  const total = raw.total;
  const platform = raw.platform ?? raw.plataforma ?? '';
  if (
    !type || typeof date !== 'string' || typeof raw.coinId !== 'string' ||
    typeof qty !== 'number' || typeof price !== 'number' ||
    typeof fee !== 'number' || typeof total !== 'number' || typeof platform !== 'string'
  ) return [];
  return [{
    date, coinId: raw.coinId, symbol: String(raw.symbol ?? ''), name: String(raw.name ?? ''),
    type, qty, price, fee, total,
    platformId: platform ? `custom:${slugify(platform)}` : undefined,
    platformName: platform || undefined,
  }];
}

export function getLegacyOps(): NewOp[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('cp_ops') || '[]');
    return Array.isArray(raw) ? raw.flatMap(normalizeLegacyOp) : [];
  } catch { return []; }
}

export function getLegacyExitPrices(): ExitPrices {
  try { return JSON.parse(localStorage.getItem('cp_exit_prices') || '{}'); } catch { return {}; }
}

export function hasMigrationBeenDeclined(): boolean {
  return !!localStorage.getItem('cp_migration_declined');
}

export function declineMigration() {
  localStorage.setItem('cp_migration_declined', '1');
}

export function clearLegacyData() {
  localStorage.removeItem('cp_ops');
  localStorage.removeItem('cp_prices');
  localStorage.removeItem('cp_prices_time');
  localStorage.removeItem('cp_exit_prices');
  localStorage.removeItem('cp_migration_declined');
}

import type { AvatarCache, NewOp, ExitPrices } from './types';

// Ops, exit prices and live CoinGecko prices now live in the backend/Supabase
// (see lib/api/client.ts) — this module only keeps purely client-side,
// non-account data: the avatar image cache and the Google Drive integration
// state, plus the one-time legacy-data migration helpers below.
export const storage = {
  getAvatars: (): AvatarCache => JSON.parse(localStorage.getItem('cp_avatars') || '{}'),
  setAvatars: (a: AvatarCache) => localStorage.setItem('cp_avatars', JSON.stringify(a)),

  getClientId: (): string => localStorage.getItem('cp_gdrive_client_id') || '',
  setClientId: (id: string) => localStorage.setItem('cp_gdrive_client_id', id),
  removeClientId: () => localStorage.removeItem('cp_gdrive_client_id'),

  getGdriveUsed: (): boolean => !!localStorage.getItem('cp_gdrive_used'),
  setGdriveUsed: () => localStorage.setItem('cp_gdrive_used', '1'),
  removeGdriveUsed: () => localStorage.removeItem('cp_gdrive_used'),
};

// ─── Legacy localStorage migration ─────────────────────────────────────────
// Before the backend existed, ops/exit-prices lived in these same
// localStorage keys (see PLANO_BACKEND.md → "Migrating existing data").
// On first authenticated load, the dashboard checks for this data and offers
// to import it into the user's account.
export function getLegacyOps(): NewOp[] {
  try { return JSON.parse(localStorage.getItem('cp_ops') || '[]'); } catch { return []; }
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

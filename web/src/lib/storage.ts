import type { Op, Prices, ExitPrices, AvatarCache, BackupPayload } from './types';

export const storage = {
  getOps: (): Op[] => JSON.parse(localStorage.getItem('cp_ops') || '[]'),
  setOps: (ops: Op[]) => localStorage.setItem('cp_ops', JSON.stringify(ops)),

  getPrices: (): Prices => JSON.parse(localStorage.getItem('cp_prices') || '{}'),
  setPrices: (p: Prices) => localStorage.setItem('cp_prices', JSON.stringify(p)),

  getPricesTime: (): string | null => localStorage.getItem('cp_prices_time'),
  setPricesTime: (t: string) => localStorage.setItem('cp_prices_time', t),

  getExitPrices: (): ExitPrices => JSON.parse(localStorage.getItem('cp_exit_prices') || '{}'),
  setExitPrices: (ep: ExitPrices) => localStorage.setItem('cp_exit_prices', JSON.stringify(ep)),

  getAvatars: (): AvatarCache => JSON.parse(localStorage.getItem('cp_avatars') || '{}'),
  setAvatars: (a: AvatarCache) => localStorage.setItem('cp_avatars', JSON.stringify(a)),

  getClientId: (): string => localStorage.getItem('cp_gdrive_client_id') || '',
  setClientId: (id: string) => localStorage.setItem('cp_gdrive_client_id', id),
  removeClientId: () => localStorage.removeItem('cp_gdrive_client_id'),

  getGdriveUsed: (): boolean => !!localStorage.getItem('cp_gdrive_used'),
  setGdriveUsed: () => localStorage.setItem('cp_gdrive_used', '1'),
  removeGdriveUsed: () => localStorage.removeItem('cp_gdrive_used'),
};

export function buildBackupPayload(): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ops: storage.getOps(),
    prices: storage.getPrices(),
    pricesTime: storage.getPricesTime(),
    exitPrices: storage.getExitPrices(),
  };
}

export function applyBackup(backup: BackupPayload) {
  storage.setOps(backup.ops);
  if (backup.prices) storage.setPrices(backup.prices);
  if (backup.pricesTime) storage.setPricesTime(backup.pricesTime);
  if (backup.exitPrices) storage.setExitPrices(backup.exitPrices);
}

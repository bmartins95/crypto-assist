import { api } from './api/client';

export async function exportData(): Promise<void> {
  const backup = await api.exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'carteira-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importData(file: File, onSuccess?: () => Promise<void>): Promise<void> {
  const text = await file.text();
  const backup = JSON.parse(text) as Record<string, unknown>;
  if (!Array.isArray(backup.ops)) throw new Error('invalid-format');
  await api.importBackup(backup as Parameters<typeof api.importBackup>[0]);
  if (onSuccess) await onSuccess();
}

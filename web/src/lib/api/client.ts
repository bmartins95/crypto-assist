import { createClient } from '@/lib/supabase/client';
import type { Op, ExitPrices, Prices, BackupPayload } from '@/lib/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão não encontrada. Faça login novamente.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Erro ${res.status} ao chamar ${path}`), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Backend retorna Op com `id` (uuid gerado pelo Postgres).
export type RemoteOp = Op & { id: string };

export const api = {
  getOps: () => request<RemoteOp[]>('/api/ops'),
  createOp: (op: Op) => request<RemoteOp>('/api/ops', { method: 'POST', body: JSON.stringify(op) }),
  updateOp: (id: string, op: Op) => request<RemoteOp>(`/api/ops/${id}`, { method: 'PUT', body: JSON.stringify(op) }),
  deleteOp: (id: string) => request<void>(`/api/ops/${id}`, { method: 'DELETE' }),

  getExitPrices: () => request<ExitPrices>('/api/exit-prices'),
  setExitPrice: (coinId: string, exitPrice: number) =>
    request<void>('/api/exit-prices', { method: 'PUT', body: JSON.stringify({ coinId, exitPrice }) }),

  getPrices: (ids: string[]) => request<Prices>(`/api/prices?ids=${ids.join(',')}`),

  exportBackup: () => request<BackupPayload>('/api/export'),
  importBackup: (backup: BackupPayload) => request<void>('/api/import', { method: 'POST', body: JSON.stringify(backup) }),
};

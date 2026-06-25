import { getValidSession } from '@/lib/cognito/client';
import type { Op, NewOp, ExitPrices, MarketPrices, BackupPayload } from '@/lib/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

async function authHeader(): Promise<Record<string, string>> {
  const session = await getValidSession();
  if (!session) throw new Error('Session not found. Please log in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Error ${res.status} calling ${path}`), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getOps: () => request<Op[]>('/api/ops'),
  createOp: (op: NewOp) => request<Op>('/api/ops', { method: 'POST', body: JSON.stringify(op) }),
  updateOp: (id: string, op: NewOp) => request<Op>(`/api/ops/${id}`, { method: 'PUT', body: JSON.stringify(op) }),
  deleteOp: (id: string) => request<void>(`/api/ops/${id}`, { method: 'DELETE' }),

  getExitPrices: () => request<ExitPrices>('/api/exit-prices'),
  setExitPrice: (coinId: string, exitPrice: number) =>
    request<void>('/api/exit-prices', { method: 'PUT', body: JSON.stringify({ coinId, exitPrice }) }),

  getPrices: (ids: string[]) => request<MarketPrices>(`/api/prices?ids=${ids.join(',')}`),

  exportBackup: () => request<BackupPayload>('/api/export'),
  importBackup: (backup: BackupPayload) => request<void>('/api/import', { method: 'POST', body: JSON.stringify(backup) }),
};

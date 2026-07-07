import { getSession } from '@/lib/cognito';
import type { Op, NewOp, ExitPrices, ExchangeRatesPayload, MarketPrices, BackupPayload } from '@crypto-assist/shared';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

async function authHeader(): Promise<Record<string, string>> {
  const session = await getSession();
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

export const api = {
  getOps: () => request<Op[]>('/api/ops'),
  createOp: (op: NewOp) => request<Op>('/api/ops', { method: 'POST', body: JSON.stringify(op) }),
  updateOp: (id: string, op: NewOp) => request<Op>(`/api/ops/${id}`, { method: 'PUT', body: JSON.stringify(op) }),
  deleteOp: (id: string) => request<void>(`/api/ops/${id}`, { method: 'DELETE' }),

  getExitPrices: () => request<ExitPrices>('/api/exit-prices'),
  setExitPrice: (coinId: string, exitPrice: number) =>
    request<void>('/api/exit-prices', { method: 'PUT', body: JSON.stringify({ coinId, exitPrice }) }),

  getPrices: (ids: string[]) => request<MarketPrices>(`/api/prices?ids=${ids.join(',')}`),

  getExchangeRates: () => request<ExchangeRatesPayload>('/api/exchange-rates'),

  exportBackup: () => request<BackupPayload>('/api/export'),
  importBackup: (backup: BackupPayload) => request<void>('/api/import', { method: 'POST', body: JSON.stringify(backup) }),
  clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' }),
};

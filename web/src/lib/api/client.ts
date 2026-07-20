import { getAccessToken } from '@/auth/useAuth';
import type { Op, NewOp, OpClosure, ExitPrices, ExchangeRatesPayload, MarketPrices, BackupPayload, Platform, PlatformKind } from '@/lib/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
  // CoinGecko's own image URL, rendered directly — same precedent as existing
  // coin logos elsewhere in the app (price_cache.image_url / WalletTab's CoinBadge).
  image?: string | null;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    const body: Record<string, unknown> = await res.json().catch(() => ({}));
    // FastAPI reports errors as `detail`; `error` kept for non-FastAPI responses.
    const raw = body.detail ?? body.error;
    const message = typeof raw === 'string' ? raw : `Error ${res.status} calling ${path}`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getOps: () => request<Op[]>('/api/ops'),
  createOp: (op: NewOp) => request<Op>('/api/ops', { method: 'POST', body: JSON.stringify(op) }),
  updateOp: (id: string, op: NewOp) => request<Op>(`/api/ops/${id}`, { method: 'PUT', body: JSON.stringify(op) }),
  deleteOp: (id: string) => request<void>(`/api/ops/${id}`, { method: 'DELETE' }),

  closeOp: (id: string, body: { closingOp: NewOp; qtyToClose: number }) =>
    request<{ closingOp: Op; closures: OpClosure[] }>(`/api/ops/${id}/close`, { method: 'POST', body: JSON.stringify(body) }),
  getOpClosures: () => request<OpClosure[]>('/api/op-closures'),

  getExitPrices: () => request<ExitPrices>('/api/exit-prices'),
  setExitPrice: (coinId: string, exitPrice: number) =>
    request<void>('/api/exit-prices', { method: 'PUT', body: JSON.stringify({ coinId, exitPrice }) }),

  getPrices: (ids: string[]) => request<MarketPrices>(`/api/prices?ids=${ids.join(',')}`),

  getPriceHistory: (ids: string[], from: string, to: string) =>
    request<Record<string, Record<string, number>>>(`/api/prices/history?ids=${ids.join(',')}&from=${from}&to=${to}`),

  getExchangeRates: () => request<ExchangeRatesPayload>('/api/exchange-rates'),

  searchCoins: (query: string) => request<CoinSearchResult[]>(`/api/coins/search?q=${encodeURIComponent(query)}`),

  // logoUrl comes back as a same-origin-to-the-backend path (e.g. /api/platforms/logo/binance,
  // never a raw CoinGecko URL — see backend contracts/platforms-logo.md); prefix it with
  // BACKEND_URL here, once, so every caller of usePlatformCatalog gets a ready-to-render URL.
  getPlatformExchanges: async (): Promise<{ exchanges: Platform[]; updatedAt: string }> => {
    const data = await request<{ exchanges: { id: string; name: string; logoUrl: string | null; kind: PlatformKind }[]; updatedAt: string }>(
      '/api/platforms/exchanges'
    );
    return {
      updatedAt: data.updatedAt,
      exchanges: data.exchanges.map(e => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        logoUrl: e.logoUrl ? `${BACKEND_URL}${e.logoUrl}` : undefined,
      })),
    };
  },

  exportBackup: () => request<BackupPayload>('/api/export'),
  importBackup: (backup: BackupPayload) => request<void>('/api/import', { method: 'POST', body: JSON.stringify(backup) }),
  clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' }),

  // No auth header: /health/db exists so the login page can start the Aurora
  // 0-ACU wake-up before the user has a session.
  warmupDb: () => fetch(`${BACKEND_URL}/health/db`),
};

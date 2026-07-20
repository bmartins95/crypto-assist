import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';

vi.mock('@/auth/useAuth', () => ({
  getAccessToken: vi.fn(async () => 'token'),
}));

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('api request error extraction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces the FastAPI detail string on error responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(500, { detail: 'violates check constraint "ops_type_check"' })
    );
    await expect(api.getOps()).rejects.toThrow('violates check constraint "ops_type_check"');
  });

  it('falls back to the error field when detail is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(500, { error: 'boom' }));
    await expect(api.getOps()).rejects.toThrow('boom');
  });

  it('falls back to a generic message when detail is not a string', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(422, { detail: [{ loc: ['body'], msg: 'Field required' }] })
    );
    await expect(api.getOps()).rejects.toThrow('Error 422 calling /api/ops');
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);
    await expect(api.getOps()).rejects.toThrow('Error 502 calling /api/ops');
  });

  it('attaches the HTTP status to the thrown error', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(429, { detail: 'rate limited' }));
    await expect(api.getOps()).rejects.toMatchObject({ status: 429 });
  });
});

describe('api.closeOp / api.getOpClosures', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/ops/{id}/close with the closing op and quantity, returning the result', async () => {
    const closingOp = { id: 'op-2', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Sell' as const, qty: 0.5, price: 100, fee: 0, total: 50 };
    const closure = { id: 'c1', sourceOpId: 'op-1', closingOpId: 'op-2', qtyClosed: 0.5, realizedPnl: 5 };
    vi.mocked(fetch).mockResolvedValue(mockResponse(201, { closingOp, closures: [closure] }));
    const body = { closingOp: { date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Sell' as const, qty: 0.5, price: 100, fee: 0, total: 50 }, qtyToClose: 0.5 };
    const result = await api.closeOp('op-1', body);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/ops/op-1/close', expect.objectContaining({
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(result).toEqual({ closingOp, closures: [closure] });
  });

  it('fetches every closure link for the current user', async () => {
    const closure = { id: 'c1', sourceOpId: 'op-1', closingOpId: 'op-2', qtyClosed: 0.5, realizedPnl: 5 };
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, [closure]));
    const result = await api.getOpClosures();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/op-closures', expect.anything());
    expect(result).toEqual([closure]);
  });
});

describe('api.getPlatformExchanges', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes each exchange logoUrl with the backend origin, preserving kind', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, {
      exchanges: [
        { id: 'binance', name: 'Binance', logoUrl: '/api/platforms/logo/binance', kind: 'exchange' },
        { id: 'kraken', name: 'Kraken', logoUrl: null, kind: 'exchange' },
      ],
      updatedAt: '2026-01-01T00:00:00Z',
    }));
    const result = await api.getPlatformExchanges();
    expect(result.exchanges).toEqual([
      { id: 'binance', name: 'Binance', kind: 'exchange', logoUrl: 'http://localhost:3001/api/platforms/logo/binance' },
      { id: 'kraken', name: 'Kraken', kind: 'exchange', logoUrl: undefined },
    ]);
    expect(result.updatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('preserves a curated wallet/DeFi entry\'s own kind instead of forcing it to exchange', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, {
      exchanges: [
        { id: 'metamask', name: 'MetaMask', logoUrl: '/api/platforms/logo/metamask', kind: 'wallet' },
      ],
      updatedAt: '2026-01-01T00:00:00Z',
    }));
    const result = await api.getPlatformExchanges();
    expect(result.exchanges).toEqual([
      { id: 'metamask', name: 'MetaMask', kind: 'wallet', logoUrl: 'http://localhost:3001/api/platforms/logo/metamask' },
    ]);
  });
});

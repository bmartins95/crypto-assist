import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeQueryStub } from '../test/supabaseStub';

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from '../lib/supabase';
import { pricesRouter } from './prices';
import { mountRouterForTest } from '../test/testApp';

const fromMock = supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>;

describe('GET /api/prices', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('returns 400 when "ids" is missing', async () => {
    const app = mountRouterForTest('/api/prices', pricesRouter, {});
    const res = await request(app).get('/api/prices');
    expect(res.status).toBe(400);
  });

  it('serves fresh prices straight from the cache, without calling CoinGecko', async () => {
    const freshRow = { coin_id: 'bitcoin', price_brl: '500000', image_url: 'https://example.com/btc.png', updated_at: new Date().toISOString() };
    fromMock.mockReturnValue(makeQueryStub({ data: [freshRow], error: null }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const app = mountRouterForTest('/api/prices', pricesRouter, {});
    const res = await request(app).get('/api/prices?ids=bitcoin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bitcoin: { price: 500000, image: 'https://example.com/btc.png' } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches stale ids from CoinGecko and merges them with the cached ones', async () => {
    const freshRow = { coin_id: 'bitcoin', price_brl: '500000', image_url: null, updated_at: new Date().toISOString() };
    const staleRow = { coin_id: 'ethereum', price_brl: '1', image_url: null, updated_at: '2000-01-01T00:00:00.000Z' };
    fromMock.mockReturnValue(makeQueryStub({ data: [freshRow, staleRow], error: null }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: 'ethereum', current_price: 30000, image: 'https://example.com/eth.png' }],
      }))
    );

    const app = mountRouterForTest('/api/prices', pricesRouter, {});
    const res = await request(app).get('/api/prices?ids=bitcoin,ethereum');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bitcoin: { price: 500000 },
      ethereum: { price: 30000, image: 'https://example.com/eth.png' },
    });
  });

  it('falls back to stale cache data when CoinGecko fails', async () => {
    const staleRow = { coin_id: 'ethereum', price_brl: '29000', image_url: null, updated_at: '2000-01-01T00:00:00.000Z' };
    fromMock.mockReturnValue(makeQueryStub({ data: [staleRow], error: null }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    const app = mountRouterForTest('/api/prices', pricesRouter, {});
    const res = await request(app).get('/api/prices?ids=ethereum');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ethereum: { price: 29000 } });
  });

  it('returns 502 when CoinGecko fails and there is no cache at all', async () => {
    fromMock.mockReturnValue(makeQueryStub({ data: [], error: null }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    const app = mountRouterForTest('/api/prices', pricesRouter, {});
    const res = await request(app).get('/api/prices?ids=ethereum');

    expect(res.status).toBe(502);
  });
});

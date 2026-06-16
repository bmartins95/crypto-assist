import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { exportRouter } from './exportData';
import { mountRouterForTest } from '../test/testApp';

const opRow = {
  id: 'op-1',
  date: '2024-01-15',
  coin_id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  type: 'Compra',
  qty: '0.01',
  price: '250000',
  fee: '5',
  total: '2505',
  platform: 'Binance',
};

describe('GET /api/export', () => {
  it('returns ops and exit prices as a backup payload', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'ops') {
          return { select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [opRow], error: null }) };
        }
        return { select: vi.fn().mockResolvedValue({ data: [{ coin_id: 'bitcoin', exit_price: '500000' }], error: null }) };
      }),
    };
    const app = mountRouterForTest('/api/export', exportRouter, { supabase });

    const res = await request(app).get('/api/export');

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.ops).toEqual([
      { id: 'op-1', date: '2024-01-15', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra', qty: 0.01, price: 250000, fee: 5, total: 2505, platform: 'Binance' },
    ]);
    expect(res.body.exitPrices).toEqual({ bitcoin: 500000 });
  });

  it('returns 500 when fetching ops fails', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
      })),
    };
    const app = mountRouterForTest('/api/export', exportRouter, { supabase });

    const res = await request(app).get('/api/export');

    expect(res.status).toBe(500);
  });
});

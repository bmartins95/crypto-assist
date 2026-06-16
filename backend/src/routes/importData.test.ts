import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { importRouter } from './importData';
import { mountRouterForTest } from '../test/testApp';

function makeSupabaseStub() {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const builderFor = (table: string) => {
    const builder: Record<string, unknown> = {};
    const record = (op: string) => (...args: unknown[]) => {
      calls.push({ table, op, args });
      return builder;
    };
    builder.delete = vi.fn(record('delete'));
    builder.eq = vi.fn((...args: unknown[]) => {
      calls.push({ table, op: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    builder.insert = vi.fn((...args: unknown[]) => {
      calls.push({ table, op: 'insert', args });
      return Promise.resolve({ data: null, error: null });
    });
    return builder;
  };
  const supabase = { from: vi.fn((table: string) => builderFor(table)) };
  return { supabase, calls };
}

describe('POST /api/import', () => {
  it('rejects when "ops" is not an array', async () => {
    const { supabase } = makeSupabaseStub();
    const app = mountRouterForTest('/api/import', importRouter, { supabase });

    const res = await request(app).post('/api/import').send({ ops: 'nope' });

    expect(res.status).toBe(400);
  });

  it('replaces ops and exit prices for the user', async () => {
    const { supabase, calls } = makeSupabaseStub();
    const app = mountRouterForTest('/api/import', importRouter, { userId: 'user-1', supabase });

    const res = await request(app)
      .post('/api/import')
      .send({
        ops: [{ date: '2024-01-15', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra', qty: 0.01, price: 250000, fee: 5, total: 2505, platform: 'Binance' }],
        exitPrices: { bitcoin: 500000, ethereum: 0 },
      });

    expect(res.status).toBe(204);
    expect(calls.some((c) => c.table === 'ops' && c.op === 'delete')).toBe(true);
    expect(calls.some((c) => c.table === 'ops' && c.op === 'insert')).toBe(true);
    expect(calls.some((c) => c.table === 'exit_prices' && c.op === 'delete')).toBe(true);
    const exitInsert = calls.find((c) => c.table === 'exit_prices' && c.op === 'insert');
    // ethereum has a non-positive price and must be filtered out.
    expect(exitInsert?.args[0]).toEqual([{ user_id: 'user-1', coin_id: 'bitcoin', exit_price: 500000 }]);
  });

  it('skips ops insert when the backup has no operations', async () => {
    const { supabase, calls } = makeSupabaseStub();
    const app = mountRouterForTest('/api/import', importRouter, { supabase });

    const res = await request(app).post('/api/import').send({ ops: [] });

    expect(res.status).toBe(204);
    expect(calls.some((c) => c.table === 'ops' && c.op === 'insert')).toBe(false);
  });
});

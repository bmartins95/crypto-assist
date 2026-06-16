import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { opsRouter } from './ops';
import { mountRouterForTest } from '../test/testApp';
import { makeQueryStub, makeSupabaseClientStub } from '../test/supabaseStub';

const dbRow = {
  id: 'op-1',
  date: '2024-01-15',
  coin_id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  type: 'Compra',
  qty: '0.01', // Postgres numeric comes back as string
  price: '250000',
  fee: '5',
  total: '2505',
  platform: 'Binance',
};

const apiOp = {
  id: 'op-1',
  date: '2024-01-15',
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  type: 'Compra',
  qty: 0.01,
  price: 250000,
  fee: 5,
  total: 2505,
  platform: 'Binance',
};

describe('GET /api/ops', () => {
  it('lists the operations as camelCase JSON with numbers coerced', async () => {
    const stub = makeQueryStub({ data: [dbRow], error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).get('/api/ops');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([apiOp]);
  });

  it('returns 500 when the query fails', async () => {
    const stub = makeQueryStub({ data: null, error: { message: 'db down' } });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).get('/api/ops');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'db down' });
  });
});

describe('POST /api/ops', () => {
  it('creates an operation and returns 201 with the inserted row', async () => {
    const stub = makeQueryStub({ data: dbRow, error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app)
      .post('/api/ops')
      .send({ date: '2024-01-15', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra', qty: 0.01, price: 250000, fee: 5, total: 2505, platform: 'Binance' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(apiOp);
  });

  it('rejects when required fields are missing', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).post('/api/ops').send({ symbol: 'BTC' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/ops/:id', () => {
  it('updates an operation', async () => {
    const stub = makeQueryStub({ data: dbRow, error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).put('/api/ops/op-1').send(apiOp);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiOp);
  });

  it('returns 404 when the operation does not exist', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).put('/api/ops/missing').send(apiOp);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/ops/:id', () => {
  it('removes an operation and returns 204', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const app = mountRouterForTest('/api/ops', opsRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).delete('/api/ops/op-1');

    expect(res.status).toBe(204);
  });
});

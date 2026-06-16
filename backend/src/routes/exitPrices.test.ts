import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { exitPricesRouter } from './exitPrices';
import { mountRouterForTest } from '../test/testApp';
import { makeQueryStub, makeSupabaseClientStub } from '../test/supabaseStub';

describe('GET /api/exit-prices', () => {
  it('returns a coinId -> exitPrice map', async () => {
    const stub = makeQueryStub({
      data: [
        { coin_id: 'bitcoin', exit_price: '500000' },
        { coin_id: 'ethereum', exit_price: '30000' },
      ],
      error: null,
    });
    const app = mountRouterForTest('/api/exit-prices', exitPricesRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).get('/api/exit-prices');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bitcoin: 500000, ethereum: 30000 });
  });
});

describe('PUT /api/exit-prices', () => {
  it('rejects when coinId or exitPrice are missing', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const app = mountRouterForTest('/api/exit-prices', exitPricesRouter, { supabase: makeSupabaseClientStub(stub) });

    const res = await request(app).put('/api/exit-prices').send({ coinId: 'bitcoin' });

    expect(res.status).toBe(400);
  });

  it('upserts the exit price when it is positive', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const client = makeSupabaseClientStub(stub);
    const app = mountRouterForTest('/api/exit-prices', exitPricesRouter, { supabase: client });

    const res = await request(app).put('/api/exit-prices').send({ coinId: 'bitcoin', exitPrice: 500000 });

    expect(res.status).toBe(204);
    expect(stub.upsert).toHaveBeenCalledWith({ user_id: 'test-user-id', coin_id: 'bitcoin', exit_price: 500000 });
  });

  it('deletes the exit price when it is zero or negative', async () => {
    const stub = makeQueryStub({ data: null, error: null });
    const client = makeSupabaseClientStub(stub);
    const app = mountRouterForTest('/api/exit-prices', exitPricesRouter, { supabase: client });

    const res = await request(app).put('/api/exit-prices').send({ coinId: 'bitcoin', exitPrice: 0 });

    expect(res.status).toBe(204);
    expect(stub.delete).toHaveBeenCalled();
  });
});

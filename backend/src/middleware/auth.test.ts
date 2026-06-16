import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { auth: { getUser: getUserMock } },
  supabaseForUser: vi.fn((token: string) => ({ __fakeClientFor: token })),
}));

// Imported after the mock so it picks up the mocked lib/supabase.
import { requireAuth } from './auth';

function makeRes() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('requireAuth', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it('rejects requests without an Authorization header', async () => {
    const req = { headers: {} } as Request;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authentication token.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with a header that is not a Bearer token', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as Request;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const req = { headers: { authorization: 'Bearer bad-token' } } as Request;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(getUserMock).toHaveBeenCalledWith('bad-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.userId, req.accessToken and req.supabase on success, then calls next()', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    const req = { headers: { authorization: 'Bearer good-token' } } as Request;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(req.userId).toBe('user-123');
    expect(req.accessToken).toBe('good-token');
    expect(req.supabase).toEqual({ __fakeClientFor: 'good-token' });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

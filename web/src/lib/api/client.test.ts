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

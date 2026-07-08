import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAuthUrl,
  exchangeCode,
  getTokens,
  getSession,
  getValidSession,
  clearSession,
  buildLogoutUrl,
  getEmailFromIdToken,
} from './client';

const STORAGE_KEY = 'cognito_tokens';
const VERIFIER_KEY = 'cognito_pkce_verifier';

// DOMAIN is read from VITE_COGNITO_DOMAIN at module load, which is only set via a
// gitignored .env.local locally and is unset in CI — parse the query string
// directly rather than new URL(url), which requires a valid absolute URL.
function paramsOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

function mockJsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function storeTokens(overrides: Partial<Record<string, unknown>> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: 'access-1',
      id_token: 'id-1',
      refresh_token: 'refresh-1',
      expires_at: Date.now() + 60_000,
      ...overrides,
    })
  );
}

describe('cognito/client', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('buildAuthUrl', () => {
    it('always includes a PKCE code_challenge and stores the verifier', async () => {
      const url = await buildAuthUrl();
      const params = paramsOf(url);
      expect(params.get('code_challenge')).toBeTruthy();
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('identity_provider')).toBeNull();
      expect(sessionStorage.getItem(VERIFIER_KEY)).toBeTruthy();
    });

    it('includes identity_provider only when passed', async () => {
      const url = await buildAuthUrl('Google');
      const params = paramsOf(url);
      expect(params.get('identity_provider')).toBe('Google');
    });
  });

  describe('exchangeCode', () => {
    it('throws when no PKCE verifier is stored', async () => {
      await expect(exchangeCode('auth-code')).rejects.toThrow('PKCE verifier missing');
    });

    it('exchanges the code and persists the returned tokens', async () => {
      sessionStorage.setItem(VERIFIER_KEY, 'verifier-1');
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse(200, {
          access_token: 'access-2',
          id_token: 'id-2',
          refresh_token: 'refresh-2',
          expires_in: 3600,
        })
      );

      await exchangeCode('auth-code');

      expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.access_token).toBe('access-2');
      expect(stored.expires_at).toBeGreaterThan(Date.now());
    });

    it('throws when the token endpoint responds with an error', async () => {
      sessionStorage.setItem(VERIFIER_KEY, 'verifier-1');
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse(400, {}));

      await expect(exchangeCode('bad-code')).rejects.toThrow('Token exchange failed');
    });
  });

  describe('getTokens / getSession', () => {
    it('returns null when nothing is stored', () => {
      expect(getTokens()).toBeNull();
      expect(getSession()).toBeNull();
    });

    it('returns null for malformed stored JSON rather than throwing', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      expect(getTokens()).toBeNull();
    });

    it('returns the stored tokens when not expired', () => {
      storeTokens();
      expect(getSession()?.access_token).toBe('access-1');
    });

    it('returns null once the tokens have expired', () => {
      storeTokens({ expires_at: Date.now() - 1000 });
      expect(getSession()).toBeNull();
    });
  });

  describe('getValidSession', () => {
    it('returns null when no session is stored', async () => {
      await expect(getValidSession()).resolves.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns the stored session without refreshing when still valid', async () => {
      storeTokens();
      const session = await getValidSession();
      expect(session?.access_token).toBe('access-1');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('refreshes and persists new tokens when expired', async () => {
      storeTokens({ expires_at: Date.now() - 1000 });
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse(200, {
          access_token: 'access-refreshed',
          id_token: 'id-refreshed',
          expires_in: 3600,
        })
      );

      const session = await getValidSession();

      expect(session?.access_token).toBe('access-refreshed');
      expect(session?.refresh_token).toBe('refresh-1');
    });

    it('returns null when the refresh call fails', async () => {
      storeTokens({ expires_at: Date.now() - 1000 });
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse(400, {}));

      await expect(getValidSession()).resolves.toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes stored tokens and verifier', () => {
      storeTokens();
      sessionStorage.setItem(VERIFIER_KEY, 'verifier-1');

      clearSession();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    });
  });

  describe('buildLogoutUrl', () => {
    it('includes client_id and the current origin as logout_uri', () => {
      const params = paramsOf(buildLogoutUrl());
      expect(params.get('client_id')).toBeTruthy();
      expect(params.get('logout_uri')).toBe(window.location.origin);
    });
  });

  describe('getEmailFromIdToken', () => {
    it('returns the email claim from a valid JWT', () => {
      const payload = btoa(JSON.stringify({ email: 'user@example.com' }));
      expect(getEmailFromIdToken(`header.${payload}.sig`)).toBe('user@example.com');
    });

    it('returns an empty string for a malformed token', () => {
      expect(getEmailFromIdToken('not-a-jwt')).toBe('');
    });

    it('returns an empty string when the payload has no email claim', () => {
      const payload = btoa(JSON.stringify({ sub: 'user-1' }));
      expect(getEmailFromIdToken(`header.${payload}.sig`)).toBe('');
    });
  });
});

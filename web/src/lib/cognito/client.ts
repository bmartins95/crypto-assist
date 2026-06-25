const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const STORAGE_KEY = 'cognito_tokens';
const VERIFIER_KEY = 'cognito_pkce_verifier';

interface Tokens {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_at: number;
}

function base64URLEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function randomBytes(length: number): ArrayBuffer {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array.buffer;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

export async function buildAuthUrl(identityProvider?: string): Promise<string> {
  const verifier = base64URLEncode(randomBytes(32));
  const challenge = base64URLEncode(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: `${window.location.origin}/auth/callback`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (identityProvider) params.set('identity_provider', identityProvider);

  return `${DOMAIN}/oauth2/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('PKCE verifier missing');

  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      code,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error('Token exchange failed');

  const data = await res.json();
  sessionStorage.removeItem(VERIFIER_KEY);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  } satisfies Tokens));
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function getSession(): Tokens | null {
  const tokens = getTokens();
  if (!tokens || tokens.expires_at <= Date.now()) return null;
  return tokens;
}

async function doRefresh(refreshToken: string): Promise<void> {
  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  } satisfies Tokens));
}

export async function getValidSession(): Promise<Tokens | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  if (tokens.expires_at > Date.now()) return tokens;
  try {
    await doRefresh(tokens.refresh_token);
    return getTokens();
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
}

export function buildLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin,
  });
  return `${DOMAIN}/logout?${params}`;
}

export function getEmailFromIdToken(idToken: string): string {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return (payload.email as string) ?? '';
  } catch {
    return '';
  }
}

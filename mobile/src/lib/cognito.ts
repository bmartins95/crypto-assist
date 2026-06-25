import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DOMAIN = process.env.EXPO_PUBLIC_COGNITO_DOMAIN!;
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!;
const REDIRECT_URI = 'crypto-assist://callback';
const TOKENS_KEY = 'cognito_tokens';

export interface CognitoTokens {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_at: number;
}

function base64URLEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function buildAuthUrl(identityProvider?: string): Promise<{ url: string; verifier: string }> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const verifier = base64URLEncode(randomBytes);

  const hashB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = hashB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (identityProvider) params.set('identity_provider', identityProvider);

  return { url: `${DOMAIN}/oauth2/authorize?${params}`, verifier };
}

export async function exchangeCode(code: string, verifier: string): Promise<void> {
  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(`Token exchange failed (${res.status}): ${body.error ?? ''} – ${body.error_description ?? ''}`);
  }
  const data = await res.json();
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify({
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  } satisfies CognitoTokens));
}

async function storedTokens(): Promise<CognitoTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  return raw ? (JSON.parse(raw) as CognitoTokens) : null;
}

async function doRefresh(refreshToken: string): Promise<void> {
  const res = await fetch(`${DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify({
    access_token: data.access_token,
    id_token: data.id_token,
    // Cognito may not return a new refresh_token; keep the existing one
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  } satisfies CognitoTokens));
}

export async function getSession(): Promise<CognitoTokens | null> {
  const tokens = await storedTokens();
  if (!tokens) return null;
  if (tokens.expires_at > Date.now()) return tokens;
  try {
    await doRefresh(tokens.refresh_token);
    return storedTokens();
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}

export function buildLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: 'crypto-assist://logout',
  });
  return `${DOMAIN}/logout?${params}`;
}

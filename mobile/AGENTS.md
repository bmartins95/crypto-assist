# mobile/ — Expo + React Native

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions and
[`../PLANO_BACKEND.md`](../PLANO_BACKEND.md) for the full architecture.

## Expo SDK 54 — read the docs first

This uses **Expo SDK 54** (downgraded from 56 for physical device compatibility).
APIs, hooks, and file conventions differ from older versions. Check
https://docs.expo.dev/versions/v54.0.0/ before writing any code involving
Expo-specific APIs.

## Routing — expo-router (file-based)

Navigation is handled by **expo-router v4** (file-based, like Next.js App Router):

```
app/
  _layout.tsx          ← root layout (AuthProvider, Stack navigator)
  (auth)/
    login.tsx          ← unauthenticated users land here
  (tabs)/
    _layout.tsx        ← tab bar for authenticated users
    wallet.tsx         ← Carteira tab
    profit.tsx         ← Lucro tab
    history.tsx        ← Histórico tab
```

Auth guard lives in `app/_layout.tsx` — redirects to `(auth)/login` when
no session, to `(tabs)/wallet` when logged in.

## Auth — Cognito PKCE

Auth uses **Amazon Cognito Hosted UI** via `expo-web-browser.openAuthSessionAsync`.

`src/lib/cognito.ts` — PKCE client: `buildAuthUrl`, `exchangeCode`, `getSession` (auto-refreshes), `clearSession`.
- Uses `expo-crypto` for SHA-256 (Hermes lacks `crypto.subtle`)
- Always call `.toString()` on `URLSearchParams` before passing to `fetch` body
- Redirect URI: `crypto-assist://callback` (registered in Cognito mobile client)
- Tokens stored in `expo-secure-store`

`src/lib/auth.tsx` — `AuthProvider` + `useAuth` hook. Exposes `session`, `loading`, `signOut`, `refreshSession`.

## Shared code

`src/lib/` holds mobile-specific code only:
- `cognito.ts` — Cognito PKCE client (replaces supabase.ts)
- `auth.tsx` — `AuthProvider` + `useAuth` hook
- `api/client.ts` — HTTP client that reads Cognito `access_token` for Bearer header

Types, formatters, and portfolio logic come from the monorepo-shared package:
```ts
import { Op, fmt, collectAssets } from '@crypto-assist/shared';
```

## Monorepo setup

`metro.config.js` adds the repo root to `watchFolders` and
`resolver.nodeModulesPaths` so Metro resolves `@crypto-assist/shared` from
the root `node_modules` symlink.

## Environment variables

Copy `.env.example` to `.env.local`. Expo exposes only `EXPO_PUBLIC_*` vars
to the bundle — never put secrets here.

Required vars:
- `EXPO_PUBLIC_COGNITO_DOMAIN` — e.g. `https://crypto-assist-dev.auth.us-east-1.amazoncognito.com`
- `EXPO_PUBLIC_COGNITO_CLIENT_ID` — mobile client ID from SSM `/crypto-assist/{stage}/CognitoMobileClientId`
- `EXPO_PUBLIC_BACKEND_URL` — Lambda Function URL from SSM `/crypto-assist/{stage}/BackendApiUrl`

## Running

```bash
cd mobile
npm start          # Expo Go (scan QR)
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS only)
```

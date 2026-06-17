# mobile/ — Expo + React Native

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions and
[`../PLANO_BACKEND.md`](../PLANO_BACKEND.md) for the full architecture.

## Expo SDK 56 — read the docs first

This uses **Expo SDK 56**. APIs, hooks, and file conventions differ from
older versions. Check https://docs.expo.dev/versions/v56.0.0/ before writing
any code involving Expo-specific APIs.

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

## Shared code

`src/lib/` holds mobile-specific code only:
- `supabase.ts` — Supabase client using `expo-secure-store` for session storage
- `auth.tsx` — `AuthProvider` + `useAuth` hook
- `api/client.ts` — same HTTP client as web, but uses the mobile Supabase session

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

## Running

```bash
cd mobile
npm start          # Expo Go (scan QR)
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS only)
```

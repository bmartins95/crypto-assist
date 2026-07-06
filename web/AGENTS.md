# web/ — Vite + React + TanStack Router

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions and
[`../MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) for the architecture overview.

## Stack

- **Vite** for bundling and dev server (replaces Next.js)
- **React 19** with plain `.tsx` components — no server components, no SSR
- **TanStack Router** for file-based routing (replaces Next.js App Router)
- **`@aws-amplify/auth`** for authentication (replaces `@supabase/ssr`)
- **Tailwind CSS v4**
- **Vitest + Testing Library** for unit tests

## Routing

Routes live in `src/routes/` following TanStack Router's file-based convention.
TanStack Router generates a `routeTree.gen.ts` file — do not edit it manually,
it is regenerated on every `vite dev` / `vite build`.

Auth guard: protected routes check `fetchAuthSession()` from `@aws-amplify/auth`
inside the route's `beforeLoad`. Unauthenticated users are redirected to `/login`.

## shared/ resolution

`vite.config.ts` maps `@crypto-assist/shared` → `../shared/src` via `resolve.alias`.
The same alias is repeated in `vitest.config.ts`. Do not import from a relative path
like `../../shared/src` — always use the `@crypto-assist/shared` alias.

## Auth

`src/lib/auth.ts` wraps Amplify and exposes:
- `signIn(email, password)` / `signOut()`
- `signInWithGoogle()` — redirects to Cognito hosted UI
- `getAccessToken()` — returns the JWT for backend calls (Bearer header)
- `getCurrentUser()` — returns `{ userId, email }`

Do not call Amplify directly in components — go through this wrapper so tests
can mock a single module.

## External APIs and CSP

The browser calls `api.coingecko.com` directly (`src/lib/coingecko.ts`: coin-list search,
fallback search, single-price lookups) until PLAN item 13 moves these behind the backend.
Deployed environments enforce a CloudFront CSP (`aws-infra/stacks/app-stack.ts`) — every
external host the browser fetches must be in `connect-src`. A CSP-blocked fetch throws like
a network error and our catch handlers swallow it, so the symptom is a feature that silently
degrades on deployed environments while working on `localhost` (the dev server has no CSP).
Before debugging such a mismatch, check `curl -sSI <cloudfront-url> | grep -i content-security-policy`.

`src/lib/coingecko.ts` caches through a shared `TtlCache`: the full coin list and per-query
search results expire after 1 hour, single-coin prices after 60 s. `AppLayout` prefetches the
coin list on mount so the History drawer's search is warm before first use.

Backend errors: `request()` in `src/lib/api/client.ts` surfaces FastAPI's string `detail`
(falling back to `error`, then a generic message) and attaches `status` to the thrown Error.
Event handlers showing failures should include `err.message`, not just a localized headline.

## Dev server

```bash
npm run dev    # Vite dev server at http://localhost:5173
npm test       # Vitest + Testing Library
npm run build  # Vite build → dist/
```

The `dist/` folder is synced to S3 by GitHub Actions on every push to `master`.

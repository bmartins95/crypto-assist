# web/ — Vite + React + TanStack Router

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions and
[`../MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) for the architecture overview.

## Stack

- **Vite** for bundling and dev server (replaces Next.js)
- **React 19** with plain `.tsx` components — no server components, no SSR
- **TanStack Router** for file-based routing (replaces Next.js App Router)
- **`aws-amplify`** (the `aws-amplify/auth` subpath) for authentication
- **Tailwind CSS v4**
- **Vitest + Testing Library** for unit tests

## Routing

Routes live in `src/routes/` following TanStack Router's file-based convention.
TanStack Router generates a `routeTree.gen.ts` file — do not edit it manually,
it is regenerated on every `vite dev` / `vite build`.

Auth guard: protected routes call `requireAuth` (`src/auth/RequireAuth.tsx`, which
checks `isAuthenticated()` from `src/auth/useAuth.ts`) inside the route's `beforeLoad`.
Unauthenticated users are redirected to `/login`. The public `/login`, `/login/email`,
and `/signup` routes use the inverse guard, `redirectIfAuthenticated`, so an
already-signed-in visitor is sent straight into the app.

## shared/ resolution

`vite.config.ts` maps `@crypto-assist/shared` → `../shared/src` via `resolve.alias`.
The same alias is repeated in `vitest.config.ts`. Do not import from a relative path
like `../../shared/src` — always use the `@crypto-assist/shared` alias.

## Auth

`src/auth/useAuth.ts` wraps `aws-amplify/auth` and exposes:
- `signIn(email, password)` / `signUp(name, email, password)` / `signOut()`
- `confirmSignUp(email, code)` / `resendSignUpCode(email)`
- `resetPassword(email)` / `confirmResetPassword(email, code, newPassword)`
- `signInWithRedirect(provider)` — `'Google' | 'Facebook'`, redirects to that provider's consent screen
- `isAuthenticated()` / `getAccessToken()` — returns the JWT for backend calls (Bearer header)
- `fetchUserAttributes()` — returns `{ email, name }`

`Amplify.configure(...)` runs once in `src/main.tsx`, reading `VITE_COGNITO_USER_POOL_ID`,
`VITE_COGNITO_CLIENT_ID`, and `VITE_COGNITO_DOMAIN`. Do not call Amplify directly in
components — go through `useAuth.ts` so tests can mock a single module.

The custom auth UI (`src/auth/`) fully replaces the Cognito Hosted UI: `screens/HeroPage.tsx`
(public landing, `/`), `screens/LoginScreen.tsx` (provider choice, `/login`),
`screens/EmailLoginScreen.tsx` (email/password + forgot-password, `/login/email`),
`screens/SignupScreen.tsx` (signup + confirmation code, `/signup`), and `AuthCallback.tsx`
(`/auth/callback`, shown while a social redirect completes). `AppBootstrapGate.tsx` wraps
`AppLayout`'s first data fetch after login with a branded loading state and a timeout-based
error/retry state (~28s), replacing a plain loading spinner.

## i18n / locale

`src/context/LocaleContext.tsx` resolves the active locale in this order: (1) the
saved preference in `localStorage['crypto-assist:locale']`, if any; (2) the first
entry in `navigator.languages` that matches a supported locale exactly, or by
language-only subtag (e.g. `en-GB` → `en-US`) if no exact match exists; (3) the
`en-US` default. Setting a preference via Settings always overrides browser
detection from then on.

## External APIs and CSP

The browser never calls `api.coingecko.com` directly (Item 13 moved coin search behind the
backend's `GET /api/coins/search`, and current/historical prices were already served
through the backend). `src/lib/coingecko.ts` no longer exists — `OpDrawer`'s `CoinSearch`
calls `api.searchCoins(query)`, and price auto-fill calls `api.getPrices(ids)`.

Deployed environments enforce a CloudFront CSP (`aws-infra/stacks/app-stack.ts`) — every
external host the browser fetches must be in `connect-src`. Since the browser no longer
fetches CoinGecko directly, `https://api.coingecko.com` can be removed from `connect-src`
in `aws-infra` as a follow-up (a separate repo/infra change, not performed by this branch).
A CSP-blocked fetch throws like a network error and our catch handlers swallow it, so any
future external host added to a browser fetch should be checked with
`curl -sSI <cloudfront-url> | grep -i content-security-policy` before assuming a feature
that works on `localhost` will also work on a deployed environment.

Backend errors: `request()` in `src/lib/api/client.ts` surfaces FastAPI's string `detail`
(falling back to `error`, then a generic message) and attaches `status` to the thrown Error.
Event handlers showing failures should include `err.message`, not just a localized headline.

## Money and currency

Any UI that displays or edits a monetary amount must go through the shared currency
layer — never hardcode a currency symbol or assume BRL:

- **Display**: use `useCurrency()`'s `fmtMoney`/`fmtMoneyCompact` (for a USD-denominated
  value) or `fmtFromCurrency` (for a value already recorded in a specific `Currency`).
  Both apply the user's selected display currency and locale automatically.
- **Input**: use `MoneyField` (`src/components/MoneyField.tsx`), not a raw `NumericField`
  with a literal `prefix`. It derives the currency symbol from `useCurrency()` and
  `useLocale()` via `currencySymbol()` (`@crypto-assist/shared`), so it always reflects
  whatever currency is actually selected. Pass an explicit `currency` prop only when the
  value is fixed to a specific past currency (e.g. editing an existing operation) rather
  than the app's current selection.

This exists because `OpDrawer`'s price/fee/total fields once hardcoded `prefix="R$"`
directly on `NumericField`, so switching the app to USD (or any non-BRL currency) never
updated those labels even though the underlying values were converted correctly.

## Dev server

```bash
npm run dev    # Vite dev server at http://localhost:5173
npm test       # Vitest + Testing Library
npm run build  # Vite build → dist/
```

The `dist/` folder is synced to S3 by GitHub Actions on every push to `master`.

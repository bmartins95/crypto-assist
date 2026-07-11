# Research: Custom Auth UI

## Auth engine: activate `@aws-amplify/auth`

**Decision**: Introduce `@aws-amplify/auth` as the client for all native (email/password) and social sign-in flows. Remove `web/src/lib/cognito/client.ts` (hand-rolled PKCE) and `web/src/app/auth/AuthClient.tsx` entirely.

**Rationale**: The project's constitution (`.specify/memory/constitution.md`, Technology Standards) already names "AWS Cognito with Amplify on clients" as the fixed auth technology — it supersedes any other practice found in the actual codebase per the constitution's own Governance clause. `web/src/lib/cognito/client.ts` was a narrower, Item-15-era workaround that only implemented the OAuth2/PKCE redirect handshake (`buildAuthUrl`, `exchangeCode`) — exactly what Google/Facebook's `signInWithRedirect` needs, but nothing for native `InitiateAuth`/`SignUp`/`ConfirmSignUp`/`ForgotPassword`, which this item requires for FR-001/002/003 (custom email/password screens that never touch Hosted UI). Hand-rolling those four additional flows would mean re-implementing a meaningful slice of what Amplify already does correctly (SRP auth, token refresh, challenge handling), directly conflicting with the "check if functionality exists" dependency rule — except here the "existing" functionality is a *declared but unused* dependency, not a from-scratch addition.

**Alternatives considered**:
- *Extend the hand-rolled client with raw `fetch` calls to Cognito's `AWSCognitoIdentityProviderService` JSON API* (`InitiateAuth`, `SignUp`, `ConfirmSignUp`, `ForgotPassword`, `ConfirmForgotPassword`). Rejected: doable, but directly contradicts the constitution's explicit, already-ratified choice of Amplify, and duplicates non-trivial SRP/token-refresh logic Amplify already provides correctly.
- *Amplify's full `aws-amplify` umbrella package.* Rejected in favor of the scoped `@aws-amplify/auth` subpackage — this app only needs Auth, not Amplify's Storage/API/DataStore surfaces; matches the "don't add more than the plan item requires" rule.

## Amplify configuration inputs

**Decision**: `Amplify.configure()` runs once in `web/src/main.tsx` before `createRoot(...).render(...)`, using `import.meta.env.VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, and the Hosted-UI domain (`VITE_COGNITO_DOMAIN`, reused only for the OAuth `domain` field Amplify needs internally for `signInWithRedirect` — the user never sees this URL per FR-015, since Amplify redirects to it programmatically, the same way the old PKCE client did).

**Rationale**: `scripts/ci-build-web.sh`'s header comment already documents `VITE_COGNITO_USER_POOL_ID` as injected by the deploy pipeline (`deploy-stage.yml`) — it is simply unused by any code today and undocumented in `web/.env.local.example`. No CI/pipeline change needed; this item only starts consuming a value the pipeline already provides. `redirectSignIn`/`redirectSignOut` use `${window.location.origin}/auth/callback` and `window.location.origin` respectively, mirroring the existing PKCE client's `redirect_uri` and `logout_uri` construction.

**Alternatives considered**: Hardcoding pool/client IDs per stage — rejected, breaks local dev / staging parity, same reasoning that already led to today's env-var-based config.

## CSS: no dedicated `auth.css`

**Decision**: All new auth screen styles (tokens, animations, card/field/button classes) are added to the existing `web/src/app/globals.css`, not a separate stylesheet.

**Rationale**: Every other view added since Item 6 (`Sidebar`, `AppLayout`, `WalletTab`, `ProfitTab`, `HistoryTab`, `OpDrawer`, `settings.tsx`) puts its CSS in `globals.css` — no component in this codebase imports its own `.css` file (verified: zero `import '...css'` statements outside `main.tsx`'s single `globals.css` import). Introducing a second stylesheet for just this feature would be an unjustified new pattern the next AI session would have to learn was a one-off.

**Alternatives considered**: The source design doc's suggested `auth.css` (or CSS modules) — rejected as inconsistent with established convention; not required by anything in spec.md.

## Design tokens: reuse `--s-*`, add two new ones

**Decision**: Reuse the app's existing `--s-accent` (`#2dd4bf` dark / teal), `--s-surface`, `--s-surface-2`, `--s-border`, `--s-text-muted`, `--s-text-dim`, `--bg` tokens (already defined in `globals.css`, established by Items 6-9's color-and-contrast pass) instead of the prototype's differently-named `--accent`/`--surface`/`--border` block. Add exactly two new tokens the app doesn't already have: `--brand-a` (`#f7931a`, the orange used only in the hero headline gradient and logo gradient) and `--accent-ink` (dark text color for the teal primary button, matching `--s-accent`'s existing usage pattern in other `.btn-accent`-style elements if present, else a new `#04201c` dark teal-safe ink).

**Rationale**: The prototype's `--accent:#2dd4bf` is numerically identical to this app's existing `--s-accent` — not a coincidence; the design docs were produced with this app's actual dark theme in mind. Reusing the real tokens keeps light/dark theme switching (already wired via `ThemeContext`/`data-theme`) working for free; duplicating a parallel token set would silently break theme switching on the new screens (they'd stay hardcoded dark) and violate the "no speculative/duplicate abstractions" rule.

**Alternatives considered**: Copying the prototype's full `:root` token block verbatim — rejected, would create two overlapping and drifting token systems and break light-mode support on all new screens (the prototype is dark-only; this app is not).

## Route shape: `/`, `/login`, `/login/email`, `/signup`, `/terms`; callback route path

**Decision**: Reuse the existing `/auth/callback` path for the OAuth return leg (only its component changes, from a plain `<p>` to `<LoadingState>`), rather than renaming it to `/callback` or similar. `/auth` itself is removed (replaced by `/login`). `indexRoute`'s `beforeLoad` changes from an unconditional `redirect({ to: '/wallet' })` to: authenticated → `/wallet` (unchanged), unauthenticated → render `HeroPage` (no redirect).

**Rationale**: `/auth/callback` is already the redirect URI registered with Google/Facebook and Cognito's App Client (per Items 15-16's SSM/Cognito config) — changing it would require an `aws-infra`-side config update, which spec.md's Assumptions explicitly rule out of scope ("No change to the Cognito user pool, identity provider configuration"). Keeping the path stable while changing only what renders there is a pure `crypto-assist`-side change.

**Alternatives considered**: Renaming to `/login/callback` for consistency with the new `/login/*` naming — rejected, would require a coordinated `aws-infra` change (out of this item's scope per spec.md Assumptions) for a purely cosmetic gain.

## Terms page content

**Decision**: `web/src/pages/terms.tsx` is a static page in the same style/shape as `web/src/pages/privacy.tsx` (same `wrap`/`h2` style constants, same heading structure), covering: acceptance of terms, description of service, user responsibilities (accuracy of self-reported ops data), no investment-advice disclaimer, account termination, and a pointer to the Privacy Policy for data handling.

**Rationale**: Matches the clarification's explicit scope ("minimal, real page matching the existing `/privacy` page's depth and style... not a full legal-review document").

## Testing approach

**Decision**: Mock `aws-amplify/auth` at the module boundary (`vi.mock('aws-amplify/auth', () => ({ signIn: vi.fn(), signUp: vi.fn(), ... }))`) in every new screen's test file, exactly as `AuthClient.test.tsx` today mocks `@/lib/cognito/client`. `useAuth.ts` is the single choke point that imports `aws-amplify/auth` directly — every other component imports `useAuth`, not Amplify, so most tests mock `@/auth/useAuth` instead of the Amplify module directly (thinner, more stable mocks).

**Rationale**: Matches existing repo testing convention (mock at the thin-wrapper boundary, not the underlying SDK, wherever a wrapper already exists — e.g. `api` client, `storage` module). Keeps ≥90% coverage achievable per component without re-mocking Amplify's full surface in every file.

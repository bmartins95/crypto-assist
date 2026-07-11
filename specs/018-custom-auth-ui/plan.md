# Implementation Plan: Custom Auth UI

**Branch**: `feat/custom-auth-ui` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-custom-auth-ui/spec.md`

## Summary

Replace the Cognito Hosted UI redirect (used today for both native email/password sign-in/sign-up and — for the email button only — as a redirect target) with a fully branded, in-app auth flow: a public hero landing page, a provider-choice login screen, email/password login and signup screens (with confirmation-code and forgot-password steps), a branded callback loading screen, and a branded post-auth bootstrap gate that replaces today's plain "carregando" text while the first portfolio fetch resolves. Google/Facebook continue to redirect to their own consent screens (unchanged, per Items 15-16) but the surrounding screens are now ours. This finally activates `@aws-amplify/auth`, which the project's constitution already names as the fixed auth technology but which no code currently uses — Item 15's hand-rolled `web/src/lib/cognito/client.ts` PKCE client only ever covered the redirect handshake, not native sign-up/sign-in/confirm/reset, which this item newly requires. `web/src/lib/cognito/client.ts` and `web/src/app/auth/AuthClient.tsx` are removed, superseded by `web/src/auth/`. A new `/terms` page is added alongside the existing `/privacy` page (per clarification). Per clarification, the components are built directly for this app (CSS custom-property tokens, clean boundaries) with no reuse-packaging work — a future extraction into a standalone repo is tracked separately as PLAN.md Item 21.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Vite 8 — existing `web/` stack, no version changes.

**Primary Dependencies**: `aws-amplify` (new, consumed via its `aws-amplify/auth` tree-shakeable subpath — already the constitution's declared, fixed auth technology; installs the native Cognito sign-in/sign-up/confirm/reset APIs and `signInWithRedirect` for social, which the existing hand-rolled `web/src/lib/cognito/client.ts` never implemented since Item 15 only needed the redirect handshake). `@tanstack/react-router` (existing, unchanged — routes added the same way as Items 6-9). No other new dependencies; animations (entrance stagger, spinner, message cross-fade, success check) are plain CSS keyframes added to the existing `web/src/app/globals.css`, matching how Items 6-9 already added view-specific CSS there — no animation library.

**Storage**: N/A for accounts (Cognito remains system of record, via Amplify instead of raw `fetch`). `localStorage` continues to hold only client-side UI preferences (theme, locale, sidebar state) via the same pattern as existing contexts — no new persisted auth state beyond what Amplify itself manages internally.

**Testing**: Vitest + Testing Library (existing `web/` pattern). `@aws-amplify/auth` is mocked via `vi.mock('aws-amplify/auth', ...)` at the module boundary, the same way `web/src/lib/cognito/client.ts` is mocked in today's `AuthClient.test.tsx` and `Sidebar.test.tsx`.

**Target Platform**: Browser SPA served from S3/CloudFront (existing `web/` deploy pipeline, `scripts/ci-build-web.sh`). `VITE_COGNITO_USER_POOL_ID` is already injected by the deploy pipeline (per `scripts/ci-build-web.sh`'s header comment) but not yet consumed by any code or documented in `web/.env.local.example` — this item is what starts using it (Amplify's `configure()` needs a User Pool ID, unlike the old raw-`fetch` PKCE client which only needed the Hosted UI domain).

**Project Type**: Web frontend only (`web/`). No `backend/` changes — sign-up, sign-in, confirmation, and password reset are all Cognito-direct client calls (same pattern as today's Google/Facebook redirects), not backend-mediated. `shared/` changes are limited to new i18n keys (`shared/src/i18n/types.ts` + all 10 locale files) — no new types, formatters, or portfolio logic.

**Performance Goals**: N/A explicit; SC-005's 30s bootstrap-gate timeout is the only timing requirement, already achievable since it wraps `AppLayout`'s existing first-fetch `useEffect` with a client-side timer, not a new backend capability.

**Constraints**: Must not change the Cognito User Pool, Identity Provider configuration, or the cross-provider account-linking Lambda established in Items 15-16 (all `aws-infra`-side; this item is `crypto-assist`-only, matching the pattern already established for Item 15's web-side button work). Must not introduce a new external host — Amplify talks to the same `cognito-idp.<region>.amazonaws.com` and Hosted-UI domain endpoints already allow-listed in the CloudFront CSP `connect-src` (Item 3), so no `aws-infra` CSP change is required (verify during implementation per `web/AGENTS.md`'s CSP-check guidance, don't assume).

**Scale/Scope**: New `web/src/auth/` directory (~10 components/screens per spec's four user stories) replacing `web/src/app/auth/AuthClient.tsx` + `web/src/app/auth/AuthClient.test.tsx` + `web/src/lib/cognito/client.ts` + `web/src/lib/cognito/client.test.ts`. `web/src/router.tsx` gains `/`, `/login`, `/login/email`, `/signup`, `/terms` routes and loses the old `/auth` route (callback route path may be kept or renamed — decided in research.md). `web/src/components/Sidebar.tsx`'s logout call switches from `buildLogoutUrl()`/`clearSession()` to Amplify's `signOut()`. `web/src/components/AppLayout.tsx`'s existing `loading` branch is replaced by `AppBootstrapGate`. One new static page (`web/src/pages/terms.tsx`), modeled on the existing `web/src/pages/privacy.tsx`. `shared/src/i18n/` gains auth-specific keys across `types.ts` and all 10 locale files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — PASS. Only new i18n keys are added to `shared/src/i18n/`; no portfolio/formatter logic changes; `mobile/` is unaffected (this item is web-only, `mobile/` has no auth UI in scope here — no mobile type contract is touched).
- **II. Security at the Boundary** — PASS. No new backend endpoint; nothing new to validate at the API boundary. Client-side form validation is UX-only, not a trust boundary — Cognito remains the actual authority on credentials. FR-011 requires every failed-auth `catch` to update visible UI state, directly satisfying "every `await` in an event handler must have a `catch` that updates visible UI state." No secrets added — `VITE_COGNITO_USER_POOL_ID` is a public client identifier (not a secret), consistent with the already-public `VITE_COGNITO_CLIENT_ID`/`VITE_COGNITO_DOMAIN`.
- **III. Behavior Coverage Over Line Coverage** — PASS (enforced in tasks.md). Every new component/screen needs ≥90% coverage on the happy path, primary error paths (wrong password, unverified email, expired/invalid code, network failure), and the edge cases listed in spec.md (already-authenticated redirect, reduced motion, session-expiry mid-flow, narrow viewport where testable via layout assertions).
- **IV. No Speculative Code** — PASS, directly per clarification: no reusable-kit packaging, no configurable multi-backend `useAuth` abstraction beyond what Amplify itself requires, no premature extraction. Terms page is minimal, matching `privacy.tsx`'s existing depth — not a new CMS or content system.
- **V. Accessibility and Internationalisation** — PASS, enforced by FR-012/013/014: every input labeled, every non-button/link interactive element gets `aria-label`, all copy through `useLocale()`/`UIText`, `prefers-reduced-motion` respected in the new CSS keyframes.

No violations. No Complexity Tracking entries required — `@aws-amplify/auth` is not a *new* technology choice; it is the technology the constitution's "Technology Standards" section already names as fixed ("Auth: AWS Cognito with Amplify on clients"), simply not yet actually wired into any code path.

## Project Structure

### Documentation (this feature)

```text
specs/018-custom-auth-ui/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory — this feature adds no new backend API surface; the only external contract exercised is Cognito's own client-side Identity Provider API, which this repo does not author.

### Source Code (repository root)

```text
web/src/
├── auth/                          # NEW — replaces web/src/app/auth/ and web/src/lib/cognito/
│   ├── AuthShell.tsx               # page wrapper: dark bg + animated brand glow + centered slot
│   ├── AuthCard.tsx                # 392px card used by login/email/signup/loading/ready states
│   ├── BrandMark.tsx               # inline logo SVG, sized per context
│   ├── ProviderButton.tsx          # Google / Facebook / e-mail full-width button
│   ├── AuthField.tsx               # labeled input (email/password/text/name)
│   ├── LoadingState.tsx            # spinner ring + rotating message list (oauth + bootstrap reuse)
│   ├── SuccessState.tsx            # animated check + title/subtitle
│   ├── AuthCallback.tsx            # "/auth/callback" — branded LoadingState during the OAuth redirect exchange; routes into the app on success, back to /login with a message on failure/cancel
│   ├── RequireAuth.tsx             # route guard component/helper used by appLayoutRoute.beforeLoad
│   ├── AppBootstrapGate.tsx        # wraps AppLayout's existing first-fetch effect with LoadingState/SuccessState/error+retry
│   ├── useAuth.ts                  # thin wrapper over aws-amplify/auth (signIn/signUp/confirmSignUp/resetPassword/confirmResetPassword/signInWithRedirect/signOut/fetchAuthSession)
│   └── screens/
│       ├── HeroPage.tsx            # public landing ("/"), app-specific content
│       ├── LoginScreen.tsx         # provider choice ("/login")
│       ├── EmailLoginScreen.tsx    # email/password + forgot-password entry ("/login/email")
│       └── SignupScreen.tsx        # name/email/password + confirmation-code step ("/signup")
├── pages/
│   └── terms.tsx                   # NEW — minimal ToS page, modeled on privacy.tsx
├── router.tsx                      # MODIFY — new routes, remove old /auth + /auth/callback wiring
├── components/
│   ├── Sidebar.tsx                 # MODIFY — logout call switches to useAuth().signOut()
│   └── AppLayout.tsx                # MODIFY — loading branch replaced by <AppBootstrapGate>
├── main.tsx                        # MODIFY — Amplify.configure(...) added before render
└── .env.local.example               # MODIFY — document VITE_COGNITO_USER_POOL_ID (already injected in CI)

web/src/app/auth/                   # REMOVE (AuthClient.tsx, AuthClient.test.tsx)
web/src/lib/cognito/                # REMOVE (client.ts, client.test.ts)

shared/src/i18n/
├── types.ts                        # MODIFY — new auth_* / hero_* / terms_* keys
└── locales/*.ts                    # MODIFY — all 10 locales gain the new keys
```

**Structure Decision**: A single new `web/src/auth/` directory holds the whole flow (mirrors the source design doc's `web/src/auth/` layout), fully replacing the two old, narrower auth locations (`web/src/app/auth/`, `web/src/lib/cognito/`) rather than living alongside them — there is no reason to keep the PKCE-only client once Amplify covers its one job (the redirect handshake) plus everything this item newly needs. No dedicated `auth.css` file (the source design doc's suggestion): this repo's established convention (Items 6-9) is one shared `web/src/app/globals.css` for all view-specific CSS, not per-component stylesheets — followed here for consistency, confirmed in research.md.

## Complexity Tracking

*No violations — this section is not applicable.*

---

description: "Task list for Custom Auth UI (specs/018-custom-auth-ui)"
---

# Tasks: Custom Auth UI

**Input**: Design documents from `/specs/018-custom-auth-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Required — this repo's constitution (Principle III) mandates ≥90% coverage per changed module with happy-path + primary error-path + edge-case tests, not optional here.

**Organization**: Tasks are grouped by user story (US1-US4 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)
- File paths are exact and relative to the repository root.

---

## Phase 1: Setup

**Purpose**: Add the new dependency and document the env var this feature starts consuming.

- [ ] T001 Add `@aws-amplify/auth` to `web/package.json` dependencies and run `npm install` in `web/`
- [ ] T002 [P] Document `VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxx` in `web/.env.local.example` (already injected by the deploy pipeline per `scripts/ci-build-web.sh`; new locally)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Activate Amplify, build the shared presentational primitives every screen reuses, add every new i18n key up front (TypeScript's `UIText` requires all 10 locales in lockstep), and cut over the existing auth gate/logout/old-client code so nothing double-implements session handling.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. **Note**: this phase intentionally leaves `/login` unresolved (redirect target with no route yet) until US1 lands — acceptable because this feature ships as a single PR, not deployed phase-by-phase.

- [ ] T003 [P] Create `web/src/auth/useAuth.ts` — thin wrapper over `aws-amplify/auth` exposing `signIn`, `signUp`, `confirmSignUp`, `resendSignUpCode`, `resetPassword`, `confirmResetPassword`, `signInWithRedirect`, `signOut`, `fetchAuthSession`, `fetchUserAttributes`
- [ ] T004 [P] Wire `Amplify.configure(...)` in `web/src/main.tsx` using `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_CLIENT_ID` / `VITE_COGNITO_DOMAIN`, `redirectSignIn`/`redirectSignOut` at `${window.location.origin}/auth/callback` and `window.location.origin`
- [ ] T005 [P] Create `web/src/auth/RequireAuth.tsx` — async guard helper (`fetchAuthSession()`-based) for use in route `beforeLoad`
- [ ] T006 [P] Create `web/src/auth/AuthShell.tsx` — page wrapper with animated brand glow, centered `.stage` slot
- [ ] T007 [P] Create `web/src/auth/AuthCard.tsx` — 392px max-width card, staggered `.a` entrance for direct children; verify it remains legible (no clipped/overflowing content) down to a 360px viewport width (SC-006)
- [ ] T008 [P] Create `web/src/auth/BrandMark.tsx` — inline logo SVG with a `size` prop
- [ ] T009 [P] Create `web/src/auth/AuthField.tsx` — labeled input (email/password/text), teal focus ring, associated `<label>`
- [ ] T010 [P] Create `web/src/auth/ProviderButton.tsx` — full-width Google/Facebook/e-mail button with provider icon
- [ ] T011 [P] Create `web/src/auth/LoadingState.tsx` — spinner ring + rotating `messages` cross-fade (reused by `AuthCallback` in US2 and `AppBootstrapGate` in US4)
- [ ] T012 [P] Create `web/src/auth/SuccessState.tsx` — animated check-draw + title/subtitle
- [ ] T013 Add auth design tokens (`--brand-a`, `--accent-ink`), keyframes (`rise`, `drift1`, `drift2`, `spin`, `pulse`, `blink`, `pop`, `draw`), primitive classes (`.a-shell`, `.a-glow`, `.a-card`, `.a-field`, `.a-btn`, `.a-loader`, `.a-check`) and a `prefers-reduced-motion` override to `web/src/app/globals.css`, reusing existing `--s-accent`/`--s-surface`/`--s-border`/`--bg` tokens per research.md
- [ ] T014 Add new `UIText` keys (`hero_*`, `auth_login_*`, `auth_signup_*`, `auth_forgot_*`, `auth_callback_*`, `auth_bootstrap_*`, `terms_*`, `legal_*`) to `shared/src/i18n/types.ts`
- [ ] T015 [P] Add the new key translations to `shared/src/i18n/locales/pt-BR.ts`
- [ ] T016 [P] Add the new key translations to `shared/src/i18n/locales/en-US.ts`
- [ ] T017 [P] Add the new key translations to `shared/src/i18n/locales/es-ES.ts`
- [ ] T018 [P] Add the new key translations to `shared/src/i18n/locales/fr-FR.ts`
- [ ] T019 [P] Add the new key translations to `shared/src/i18n/locales/de-DE.ts`
- [ ] T020 [P] Add the new key translations to `shared/src/i18n/locales/zh-CN.ts`
- [ ] T021 [P] Add the new key translations to `shared/src/i18n/locales/ja-JP.ts`
- [ ] T022 [P] Add the new key translations to `shared/src/i18n/locales/ar-SA.ts`
- [ ] T023 [P] Add the new key translations to `shared/src/i18n/locales/hi-IN.ts`
- [ ] T024 [P] Add the new key translations to `shared/src/i18n/locales/ru-RU.ts`
- [ ] T025 Update `web/src/router.tsx`: `appLayoutRoute.beforeLoad` uses `RequireAuth`/`fetchAuthSession()` instead of `getSession()`; redirect target becomes `/login`; remove the old `authRoute`/`authCallbackRoute` definitions (callback route is re-added in US2)
- [ ] T026 Update `web/src/components/Sidebar.tsx`: logout action calls `useAuth().signOut()` instead of `clearSession()`/`buildLogoutUrl()`; user chip email comes from `useAuth().fetchUserAttributes()` instead of `getEmailFromIdToken()`
- [ ] T027 Update `web/src/components/Sidebar.test.tsx` mocks from `@/lib/cognito/client` to `@/auth/useAuth`
- [ ] T028 Delete `web/src/lib/cognito/client.ts` and `web/src/lib/cognito/client.test.ts`
- [ ] T029 Delete `web/src/app/auth/AuthClient.tsx` and `web/src/app/auth/AuthClient.test.tsx`

**Checkpoint**: App compiles, protected routes gate on a real Amplify session, logout works. No screen yet renders at `/login`, `/signup`, or `/` for a logged-out visitor — filled in by US1/US3 next.

---

## Phase 3: User Story 1 - Branded email/password sign-in and sign-up (Priority: P1) 🎯 MVP

**Goal**: Custom `/login`, `/login/email`, and `/signup` screens fully replace the Cognito Hosted UI for account creation, sign-in, email verification, and password reset.

**Independent Test**: Complete account creation (name/email/password), the email verification code step, and a subsequent sign-in purely through `/signup` and `/login/email`, confirming the Cognito-hosted domain is never shown.

### Tests for User Story 1

- [ ] T030 [P] [US1] Test `EmailLoginScreen`: renders labeled fields, submits valid credentials, shows a specific error on wrong password, preserves the email field after a failed attempt, forgot-password request → code → new password flow, and asserts sign-in goes through `useAuth().signIn` (never sets `window.location.href` to the Cognito Hosted UI domain — SC-002/FR-015) — `web/src/auth/screens/EmailLoginScreen.test.tsx`
- [ ] T031 [P] [US1] Test `SignupScreen`: field validation (invalid email, short password, mismatched confirm-password, empty required field), successful `signUp` shows the confirm-code step, wrong/expired code shows a specific error with a resend option, and asserts sign-up goes through `useAuth().signUp`/`confirmSignUp` (never the Hosted UI domain — SC-002/FR-015) — `web/src/auth/screens/SignupScreen.test.tsx`
- [ ] T032 [P] [US1] Test `LoginScreen`: renders Google/Facebook/e-mail `ProviderButton`s, e-mail button navigates to `/login/email`, legal line links to `/terms` and `/privacy` — `web/src/auth/screens/LoginScreen.test.tsx`
- [ ] T033 [P] [US1] Test `terms.tsx` renders expected headings — `web/src/pages/terms.test.tsx`

### Implementation for User Story 1

- [ ] T034 [US1] Create `web/src/auth/screens/LoginScreen.tsx` — three `ProviderButton`s (Google/Facebook call `useAuth().signInWithRedirect`; e-mail routes to `/login/email`), legal line, back-to-hero link
- [ ] T035 [US1] Create `web/src/auth/screens/EmailLoginScreen.tsx` — email/password `AuthField`s, submit → `useAuth().signIn` with inline error mapping (FR-010/FR-011), nested "Esqueci a senha" request-code/enter-code+new-password sub-steps via `useAuth().resetPassword`/`confirmResetPassword`, link to `/signup`
- [ ] T036 [US1] Create `web/src/auth/screens/SignupScreen.tsx` — name/email/password/confirm-password `AuthField`s with client-side validation, submit → `useAuth().signUp`, nested confirm-code step → `useAuth().confirmSignUp` with a resend-code option, link to `/login/email`
- [ ] T037 [P] [US1] Create `web/src/pages/terms.tsx` — minimal Terms of Service page modeled on `web/src/pages/privacy.tsx`'s style/depth
- [ ] T038 [US1] Add `/login`, `/login/email`, `/signup` routes to `web/src/router.tsx`, each wrapped in `AuthShell`/`AuthCard` and redirecting an already-authenticated visitor into `/wallet` (FR-007); add `/terms` as a plain, ungated route (renders regardless of auth state, same as the existing `/privacy` route — Terms of Service is not one of FR-007's three gated screens)

**Checkpoint**: User Story 1 is fully functional and independently testable — signup, confirmation, login, wrong-password, and forgot-password all work end to end with no Hosted UI redirect.

---

## Phase 4: User Story 2 - Branded social sign-in entry and return (Priority: P1)

**Goal**: The OAuth redirect return (`/auth/callback`) shows a branded loading screen instead of blank, for both success and cancel/deny paths.

**Independent Test**: Select "Continuar com Google" (or Facebook) from `/login` (built in US1), complete the provider's consent screen, and confirm a branded "Autenticando" loading screen — never blank — appears before landing in the app; repeat with consent denied and confirm a graceful return to `/login`.

**Depends on**: User Story 1 (`LoginScreen` must exist as the entry point).

### Tests for User Story 2

- [ ] T039 [P] [US2] Test `AuthCallback`: shows `LoadingState` while the redirect exchange is in progress, routes into the app on success — `web/src/auth/AuthCallback.test.tsx`
- [ ] T040 [P] [US2] Test `AuthCallback`: shows a clear message and returns to `/login` on failure or denied consent, never leaves the user on a blank/stuck screen — `web/src/auth/AuthCallback.test.tsx`

### Implementation for User Story 2

- [ ] T041 [US2] Create `web/src/auth/AuthCallback.tsx` — uses `LoadingState` (title from `auth_callback_authenticating`) while Amplify completes the redirect exchange; on success navigates into the app; on failure/cancel shows the failure message then returns to `/login`
- [ ] T042 [US2] Add the `/auth/callback` route back to `web/src/router.tsx`, pointing at `AuthCallback`

**Checkpoint**: User Stories 1 AND 2 both work independently — the full email/password and social flows are usable with no unbranded screen anywhere in either.

---

## Phase 5: User Story 3 - Public marketing landing page (Priority: P2)

**Goal**: `/` shows a branded hero page for unauthenticated visitors instead of an immediate auth wall.

**Independent Test**: Visit `/` while logged out; confirm the hero renders (headline, product preview, feature cards) with two working CTAs into the login flow built in US1.

**Depends on**: User Story 1 (`/login` and `/login/email` must exist as CTA targets).

### Tests for User Story 3

- [ ] T043 [P] [US3] Test `HeroPage`: renders headline/preview/feature cards, primary CTA routes to `/login`, secondary CTA routes to `/login/email` — `web/src/auth/screens/HeroPage.test.tsx`
- [ ] T044 [P] [US3] Test `indexRoute`: unauthenticated visit to `/` renders the hero (no redirect); authenticated visit redirects to `/wallet` — `web/src/router.test.tsx` (create if it does not yet exist)

### Implementation for User Story 3

- [ ] T045 [US3] Create `web/src/auth/screens/HeroPage.tsx` — topbar (`BrandMark` + "Entrar" ghost button → `/login`), gradient headline, sub copy, CTAs, product preview panel, three feature cards
- [ ] T046 [US3] Update `web/src/router.tsx`'s `indexRoute`: unauthenticated → render `HeroPage`; authenticated → redirect to `/wallet` (replaces the current unconditional redirect)
- [ ] T047 [P] [US3] Add hero-specific CSS (`.topbar`, `.hero-main`, `.preview`, `.pv-row`, `.features`, `.feat`, mobile single-column collapse) to `web/src/app/globals.css`

**Checkpoint**: All three of US1-US3 work independently — a fresh, logged-out visitor can go from `/` through signup/login to the app with every screen branded.

---

## Phase 6: User Story 4 - Friendly post-auth loading state (Priority: P2)

**Goal**: The first portfolio fetch after login shows a branded, progressive loading state instead of plain "carregando" text, with an error+retry state on timeout.

**Independent Test**: Sign in, delay/throttle the first data fetch, and observe the rotating status messages, followed by either the app rendering or a retry option if the delay is excessive.

**Depends on**: Nothing from US1-US3 — reuses `LoadingState`/`SuccessState` from Phase 2 and can be built any time after Foundational.

### Tests for User Story 4

- [ ] T048 [P] [US4] Test `AppBootstrapGate`: shows `LoadingState` with rotating messages while pending, renders children on success, shows error+"Tentar novamente" retry after the timeout — `web/src/auth/AppBootstrapGate.test.tsx`

### Implementation for User Story 4

- [ ] T049 [US4] Create `web/src/auth/AppBootstrapGate.tsx` — wraps a pending/error/ready state machine around a provided async operation, ~28s timeout (SC-005's 30s budget), "Tentar novamente" retry calling the operation again
- [ ] T050 [US4] Update `web/src/components/AppLayout.tsx`: replace the existing plain-text `loading` branch with `<AppBootstrapGate>` wrapping the existing first-fetch effect/`reload` callback

**Checkpoint**: All four user stories work independently and together — the full spec.md flow (hero → login/signup → callback → bootstrap → app) is usable end to end.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Update `web/AGENTS.md`'s "Auth" section to describe the new `web/src/auth/useAuth.ts` Amplify wrapper, replacing its stale pre-existing description
- [ ] T052 Audit `shared/src/i18n/types.ts` and all 10 locale files for keys made dead by this refactor (e.g. old `auth_subtitle`/`auth_authenticating`/`auth_failed` if fully superseded) and remove them
- [ ] T053 Verify the mobile app still builds after the `shared/src/i18n` changes (`cd mobile && npx tsc --noEmit`), per the constitution's mobile-parity check
- [ ] T054 Run `cd web && npm run coverage`; confirm ≥90% on every changed module; add any missing edge-case tests (reduced motion, narrow viewport, session-expiry mid-flow)
- [ ] T055 Run `cd web && npm run lint` and fix all findings
- [ ] T056 Run `cd backend && pytest` to confirm the untouched backend suite is still green
- [ ] T057 Execute `quickstart.md`'s manual verification steps end to end against local dev

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational + User Story 1's `LoginScreen`.
- **User Story 3 (Phase 5)**: Depends on Foundational + User Story 1's `/login` and `/login/email` routes.
- **User Story 4 (Phase 6)**: Depends on Foundational only — independent of US1-US3, could be built in parallel with any of them.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- All `[P]` Setup tasks (T001-T002) in parallel.
- Within Foundational, T003-T012 (all distinct new files) in parallel, then T013-T024 (CSS + all 10 locale files) in parallel, then T025-T029 sequentially (they touch the same router/Sidebar cutover).
- Once Foundational completes, User Story 4 can be built in parallel with User Story 1.
- User Story 2 and User Story 3 can be built in parallel with each other once User Story 1 completes (both depend only on US1, not on each other).
- All `[P]`-marked test tasks within a story phase in parallel.

---

## Parallel Example: Foundational Phase

```bash
Task: "Create web/src/auth/useAuth.ts"
Task: "Create web/src/auth/AuthShell.tsx"
Task: "Create web/src/auth/AuthCard.tsx"
Task: "Create web/src/auth/BrandMark.tsx"
Task: "Create web/src/auth/AuthField.tsx"
Task: "Create web/src/auth/ProviderButton.tsx"
Task: "Create web/src/auth/LoadingState.tsx"
Task: "Create web/src/auth/SuccessState.tsx"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Test EmailLoginScreen in web/src/auth/screens/EmailLoginScreen.test.tsx"
Task: "Test SignupScreen in web/src/auth/screens/SignupScreen.test.tsx"
Task: "Test LoginScreen in web/src/auth/screens/LoginScreen.test.tsx"
Task: "Test terms.tsx in web/src/pages/terms.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) — email/password signup/login/reset with no Hosted UI is the core of PLAN.md Item 17.
3. **STOP and VALIDATE**: run `quickstart.md` sections 2-3 against local dev.

### Incremental Delivery

1. Setup + Foundational → app compiles, protected routes gated, old auth code removed.
2. + User Story 1 → email/password flow fully branded (MVP).
3. + User Story 2 → social round trip fully branded.
4. + User Story 3 → public hero landing.
5. + User Story 4 → friendly post-auth bootstrap loading.
6. + Polish → docs, coverage, lint, mobile-parity, full quickstart pass.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency.
- Commit after each task or logical group, per this repo's single-line conventional-commit rule.
- Every new component/screen needs its own test file per `Constitution Check` in plan.md — do not defer tests to Phase 7.
- Stop at any checkpoint to validate that story independently before continuing.

# Feature Specification: Custom Auth UI

**Feature Branch**: `feat/custom-auth-ui`

**Created**: 2026-07-10

**Status**: Draft

## Clarifications

### Session 2026-07-10

- Q: Should this item invest extra effort making the auth components genuinely portable for reuse in other apps (per the source doc's "reusable kit" framing), or build them directly for this app only? → A: Build directly for this app only, using CSS custom-property tokens and clean component boundaries as this app's existing convention already provides — no reuse-specific packaging or documented public interface in this item. A future extraction into a separate, standalone reusable auth-kit repository is explicitly desired later and is tracked as a new, separate PLAN.md item, not part of this item's scope.
- Q: Should this item create a real Terms of Service page, or only link to the existing Privacy page and drop the Terms reference? → A: Create a minimal Terms of Service page (`/terms`), matching the existing `/privacy` page's style and depth, so the legal footer's "Termos" link is real rather than broken or missing.

**Input**: User description: "Implement PLAN.md Item 17 — Custom auth UI (branch feat/custom-auth-ui, depends on Item 15 which is merged). The two documents attached earlier in this conversation are the authoritative source of truth for this spec and supersede/expand the brief description under Item 17 in PLAN.md: (1) auth-flow-implementation.md — full implementation plan for a reusable, token-driven auth kit: AuthShell, AuthCard, BrandMark, ProviderButton, AuthField, LoadingState, SuccessState, screens (HeroPage, LoginScreen, EmailLoginScreen, SignupScreen), AuthCallback, AppBootstrapGate, RequireAuth, useAuth hook, routing/guards, i18n keys, and 'done when' criteria. (2) auth-flow-prototype.html — the pixel/behavior source of truth (exact CSS tokens, animations, markup structure, copy) that the implementation must match. Scope for this spec: build the full flow described in auth-flow-implementation.md — public hero landing (/), /login, /login/email, /signup, /auth/callback, and the post-auth AppBootstrapGate warming state — using AWS Amplify Auth v6 directly (no Cognito Hosted UI), matching the prototype's tokens/animations/copy exactly. Reuse existing i18n infra for all auth strings. Respect this repo's existing TanStack Router setup and existing sidebar/app-shell layout from Items 6-9 for what 'the app' renders into post-auth."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Branded email/password sign-in and sign-up replace Cognito Hosted UI (Priority: P1)

A visitor creates an account or signs in using their name/email/password entirely on in-app screens styled to match the rest of the product. They never see the plain, unbrandable Cognito-hosted login page.

**Why this priority**: This is the core problem PLAN Item 17 exists to fix — the Cognito Hosted UI's styling cannot be made to match the app, and it is the last major screen in the product that still looks off-brand. Every credential-based auth interaction must move onto branded, in-app screens for this item to be done at all.

**Independent Test**: Can be fully tested by completing account creation (name/email/password), the email verification code step, and a subsequent sign-in purely through the custom `/signup` and `/login/email` screens, confirming the Cognito-hosted domain is never shown in the browser.

**Acceptance Scenarios**:

1. **Given** a first-time visitor with no account, **When** they submit name/email/password on the custom signup screen, **Then** their account is created and they are asked to enter a verification code sent to their email before they can sign in.
2. **Given** a returning user with valid email/password, **When** they submit the custom login form, **Then** they are authenticated and routed into the app without ever seeing the Cognito-hosted domain.
3. **Given** a returning user who enters an incorrect password, **When** they submit the form, **Then** they see a clear on-screen error and remain on the login screen with their email preserved.
4. **Given** a user who forgot their password, **When** they use "Esqueci a senha", **Then** they can request a reset code by email, enter it along with a new password, and sign in successfully with the new password afterward.

---

### User Story 2 - Branded social sign-in entry and return (Priority: P1)

A user chooses to continue with Google or Facebook from the branded login screen. The provider's own consent screen appears (as it must — it cannot be restyled), but everything before and after it — including the moment the browser returns to the app — stays on-brand.

**Why this priority**: Google and Facebook are already the primary sign-in methods in practice (established in Items 15-16). Today the return trip from the provider's redirect lands on a blank, unbranded page while the exchange completes, which reads as broken. Fixing this is as central to the redesign as the email/password forms.

**Independent Test**: Can be tested by selecting "Continuar com Google" (or Facebook) from the branded login screen, completing the provider's consent screen, and confirming a branded "Autenticando" loading screen — never a blank page — is shown before landing in the app.

**Acceptance Scenarios**:

1. **Given** the branded login screen, **When** a user selects Google or Facebook, **Then** they are sent to that provider's own consent screen.
2. **Given** a successful provider consent, **When** the browser returns to the app's callback route, **Then** a branded loading screen is shown while the sign-in completes — never a blank or unbranded page.
3. **Given** a user cancels or denies consent on the provider's screen, **When** they return to the app, **Then** they land back on the branded login screen with a clear message, not stuck on a blank or broken page.

---

### User Story 3 - Public marketing landing page for unauthenticated visitors (Priority: P2)

A visitor who is not signed in and reaches the app's base URL sees a branded hero page introducing the product, instead of being sent straight to an auth wall.

**Why this priority**: There is currently no public-facing explanation of the product before login — visitors hit an auth wall immediately. A hero page establishes trust and context before asking for credentials, and is explicitly part of this item's scope per the source design documents.

**Independent Test**: Can be tested by visiting the app's root URL while logged out and confirming the hero content renders with two working calls to action that route into the login flow.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor at the app's root URL, **When** the page loads, **Then** they see the product hero (headline, description, product preview, feature highlights) and two calls to action.
2. **Given** the hero page, **When** the visitor selects the primary call to action, **Then** they land on the provider-choice login screen; **when** they select the secondary one, **then** they land directly on the e-mail login screen.
3. **Given** an already-authenticated user, **When** they visit the root URL, **Then** they are routed directly into the app, not shown the hero page again.

---

### User Story 4 - Friendly post-auth loading state during first data load (Priority: P2)

Immediately after signing in, while the user's portfolio data is first loading (which can take a few seconds due to backend cold starts), the user sees a branded, reassuring loading screen instead of a blank page or an indefinite spinner.

**Why this priority**: A cold backend can take several seconds to respond after a period of inactivity. Without a good loading state, a user's very first screen after logging in looks broken. This is a real, previously undocumented UX gap that the source design explicitly calls out as part of this redesign.

**Independent Test**: Can be tested by delaying the first post-login data fetch and observing the progressive, rotating status messages, followed by either the app rendering normally or a retry option if the delay is excessive.

**Acceptance Scenarios**:

1. **Given** a user has just completed sign-in (email/password or social), **When** their first portfolio data load is in progress, **Then** they see a branded loading screen with rotating, friendly status messages and no technical or infrastructure-specific wording.
2. **Given** the first data load succeeds, **When** it completes, **Then** the app renders normally.
3. **Given** the first data load does not complete within a reasonable time, **When** the timeout is reached, **Then** the user sees a clear error state with a way to retry, instead of an indefinite loading screen.

---

### Edge Cases

- What happens when an already-authenticated user navigates directly to `/login`, `/signup`, or the email login screen? They are redirected into the app rather than shown the auth forms again.
- What happens when a user submits the signup form with an email that already has an account? A clear, specific error distinguishes this from other validation failures.
- What happens when a confirmation or password-reset code is expired or entered incorrectly? A clear error is shown with the option to request a new code.
- What happens for a user with a reduced-motion preference enabled? All entrance, loading, and success animations are skipped or shown instantly, with no motion-triggered discomfort.
- What happens if a session expires while a user is mid-flow (e.g., idle on the post-auth loading screen)? They are routed back to login rather than left stuck.
- What happens if the network hiccups during the OAuth redirect exchange at the callback route? An error state is shown with a retry/return-to-login path rather than an indefinite spinner.
- What happens on a narrow mobile viewport? Every screen, including the two-column hero, remains legible and usable — the hero collapses to a single column.
- What happens when a visitor selects "Termos" or "Política de Privacidade" on the login/signup legal line? Both links navigate to a real, working page (`/terms` and `/privacy` respectively) — neither is a dead or missing link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide custom, in-app screens for account sign-in and sign-up (email/password) that fully replace the Cognito Hosted UI experience — no step in the email/password flow may redirect to the Cognito-hosted domain.
- **FR-002**: The system MUST let a new user create an account with name, email, and password, then require email verification via a one-time code before the account can sign in.
- **FR-003**: The system MUST let a user request a password reset by email, receive a one-time code, and set a new password, then sign in successfully with the new password.
- **FR-004**: The system MUST offer Google and Facebook as sign-in options directly from the branded login screen; selecting one sends the user to that provider's own consent screen and returns them to a branded in-app screen afterward.
- **FR-005**: The system MUST show a branded transitional loading screen while a social sign-in redirect is being completed, so the user is never shown a blank or unbranded page during that exchange.
- **FR-006**: The system MUST show a public marketing landing page at the app's root URL for unauthenticated visitors, describing the product and offering entry points into both the provider-choice login screen and the direct e-mail login screen.
- **FR-007**: The system MUST route an already-authenticated user directly into the app when they visit the landing page, login screen, or signup screen, rather than presenting the auth forms again.
- **FR-008**: The system MUST show a branded loading screen with rotating, friendly status messages (no technical or infrastructure-specific wording) while the user's data loads for the first time after authentication.
- **FR-009**: The system MUST show a clear, actionable error state with a retry option if the first post-auth data load does not complete within a reasonable time.
- **FR-010**: Every form field on the auth screens MUST be validated before submission, with specific, actionable inline error messages (invalid email format, password too short, passwords don't match, required field empty).
- **FR-011**: Every failed authentication attempt (wrong password, unknown account, expired code, network/service failure) MUST show the user a specific, human-readable error without leaving them on a blank or frozen screen.
- **FR-012**: All user-facing text on every auth screen (labels, buttons, errors, loading messages, legal copy) MUST be delivered through the app's existing multi-language system and available in every currently supported locale, honoring the user's selected language preference.
- **FR-013**: Every auth screen and interactive control MUST meet the app's existing accessibility requirements (labeled inputs, `aria-label` on non-button/link interactive elements, sufficient contrast), consistent with the rest of the app.
- **FR-014**: All entrance, loading, and success animations MUST be disabled or reduced to an instant state for users with a reduced-motion preference.
- **FR-015**: The system MUST NOT display or expose the raw Cognito-hosted domain URL to the user at any point in the email/password flow.
- **FR-016**: The system MUST provide a working Terms of Service page, linked from the legal line shown on the login and signup screens alongside the existing Privacy Policy link.

### Key Entities

- **Account**: A user's Cognito identity — email, name, password credential and/or linked social identity, and verification status.
- **Session**: The authenticated state established after sign-in, used to gate access to the app and to decide redirect behavior on the public auth routes.
- **Auth Screen Flow State**: The current step a visitor/user is in (landing, provider choice, email login, signup, code confirmation, password reset, callback exchange, post-auth bootstrap), used to decide what is rendered and where "back"/redirect actions lead.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from the app's homepage to a fully verified, signed-in account entirely through in-app screens in under 2 minutes, including the email verification code step.
- **SC-002**: Zero user-facing steps in the email/password flow display the raw Cognito-hosted domain.
- **SC-003**: 100% of authentication failure cases (wrong password, unverified email, expired code, network failure) result in a specific on-screen message, never a blank or frozen screen.
- **SC-004**: Returning users complete sign-in (email/password or social) in 2 steps or fewer after choosing their method.
- **SC-005**: The post-auth loading screen always resolves to either the app or a retry option within 30 seconds, never leaving a user on an indefinite spinner.
- **SC-006**: All auth screens remain fully legible and usable on a 360px-wide mobile viewport.

## Assumptions

- This item's auth engine remains AWS Cognito; the custom screens are a thin, branded UI layer over Cognito's own sign-in/sign-up/reset/social APIs. No change to the Cognito user pool, identity provider configuration, or the cross-provider account-linking behavior established in Items 15-16.
- The public hero/marketing landing page is in scope for this item, per the explicit direction accompanying this feature request — it becomes the app's new `/` for unauthenticated visitors, replacing today's direct-to-auth-wall behavior.
- The post-auth "warming" loading state is a UX wrapper around the app's existing first data fetch after login; it does not change what data is fetched or how backend/database cold starts are themselves mitigated (already addressed by prior dev/prod fixes) — it only changes what the user sees while waiting.
- Password reset ("Esqueci a senha") is implemented as a real, working flow (request code → verify code + new password → sign in), not a decorative link with no behavior, consistent with this project's rule against half-finished implementations.
- This feature is built directly for this app's existing screens/routes. It is not packaged as a separate, installable multi-app "kit" or new workspace package in this item — reuse-friendliness is achieved only informally, through CSS custom-property tokens (already this app's established pattern) and clean component boundaries, not through a published package. A genuine extraction into a standalone, reusable auth-kit repository is a real, desired future goal (per clarification), tracked as a new separate PLAN.md item rather than in scope here.
- The Terms of Service page created for this item (`/terms`) is a minimal, real page matching the existing `/privacy` page's depth and style; it is not a full legal-review document — content accuracy/legal sign-off is out of scope for this engineering item.
- The existing sidebar/app-shell (Items 6-9) remains what renders after the post-auth loading state resolves; this item does not redesign any already-authenticated screen.
- Supported locales, the default locale (pt-BR), and the existing shared i18n mechanism are reused as-is; new keys are added for auth-specific copy across every already-supported locale.
- The password policy (minimum length, character requirements) matches whatever is already configured on the Cognito user pool; the UI's stated rules must reflect that policy exactly rather than inventing a separate client-side rule.
- "A reasonable time" for the post-auth loading timeout defaults to roughly 25-30 seconds, matching the source implementation plan's guidance and how long a cold backend start can realistically take.

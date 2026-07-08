# Feature Specification: Facebook Login

**Feature Branch**: `feat/facebook-login`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Item 15 — Facebook login (see PLAN.md). Adds Facebook as a second Cognito social IdP alongside Google, following the identical pattern in aws-infra/stacks/app-stack.ts (Google IdP block). Requires one-time manual steps documented in the plan (create Facebook App, store FacebookClientId/FacebookClientSecret in SSM for dev and prod, register Cognito callback URI in the Facebook App) before the infra change takes effect end-to-end — these are manual/external prerequisites, not part of the automated implementation."

## Clarifications

### Session 2026-07-08

- Q: Item 15's code changes (`app-stack.ts`, `dev.yaml`, `prod.yaml`, `aws-infra/AGENTS.md`) are entirely in the separate `aws-infra` repo, not `crypto-assist`. How should the implementation/PR be structured? → A: Implement in `aws-infra` on its own `feat/facebook-login` branch (off `master`), open a PR there targeting `master`. This `crypto-assist` branch/spec carries the plan tracking only. `PLAN.md`'s checkbox is ticked in a separate follow-up PR on `crypto-assist` once the `aws-infra` PR merges — this feature's own PR does not touch `PLAN.md`.
- Q: Facebook SSM secrets and the Facebook Developer App don't exist yet and can't be created by automation. How should `facebookEnabled` be set in the shipped code? → A: Ship the Facebook IdP block and `facebookEnabled` support in both `dev.yaml` and `prod.yaml`, but leave `facebookEnabled: false` (or omit it) in both files. The user flips it to `true` per-environment only after completing the manual Facebook App + SSM steps for that environment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with an existing Facebook account (Priority: P1)

A visitor who already has a Facebook account wants to access Crypto Assist without creating a new username/password. They choose "Continue with Facebook" on the login screen, authorize the app on Facebook, and land back in the app already signed in.

**Why this priority**: This is the entire point of the feature — without a working end-to-end social login, nothing else in this item has value.

**Independent Test**: Can be fully tested by clicking "Continuar com Facebook" on the hosted login UI in the dev environment, completing the Facebook OAuth consent screen, and confirming the app shows the user as authenticated with their Facebook-provided email.

**Acceptance Scenarios**:

1. **Given** a user without an existing Crypto Assist account, **When** they authenticate via Facebook for the first time, **Then** a new Cognito user is provisioned and they land on the authenticated app with their portfolio (empty for a new user).
2. **Given** a user who previously signed up with Google using the same email address, **When** they authenticate via Facebook, **Then** they land on a separate, distinct Cognito account with an empty portfolio — confirmed by live testing in dev that Cognito does not auto-link federated identities by email today (for Google or Facebook), contradicting this scenario's original assumption. Cross-provider account linking is tracked separately as `PLAN.md` Item 20 and is explicitly out of scope for this feature.

---

### User Story 2 - Facebook option is visible alongside Google (Priority: P2)

A returning or new user viewing the login screen sees both "Continuar com Google" and "Continuar com Facebook" as equally valid entry points.

**Why this priority**: Discoverability of the new option; without it the feature ships but no one finds it.

**Independent Test**: Can be tested by loading the hosted login UI in the dev environment and visually confirming both social buttons render.

**Acceptance Scenarios**:

1. **Given** the login screen, **When** it renders, **Then** both "Continuar com Google" and "Continuar com Facebook" buttons are present and enabled.

---

### User Story 3 - Feature is deployable per-environment (Priority: P3)

An operator enables Facebook login in dev first, verifies it works, and only then enables it in prod — without redeploying code, just by flipping a config value once credentials exist for that environment.

**Why this priority**: Matches the existing Google IdP rollout pattern and lets the team validate before exposing the option to production users.

**Independent Test**: Can be tested by deploying with `facebookEnabled: false` (or absent) in an environment and confirming no Facebook button appears, then flipping it to `true` and confirming it does.

**Acceptance Scenarios**:

1. **Given** `facebookEnabled` is not set (or `false`) for an environment, **When** the stack deploys, **Then** the Cognito user pool for that environment has no Facebook identity provider and the hosted UI shows no Facebook button.
2. **Given** Facebook credentials exist in SSM for an environment and `facebookEnabled: true` is set, **When** the stack deploys, **Then** the Facebook identity provider is attached to the user pool and the button appears.

### Edge Cases

- What happens when `facebookEnabled: true` is set but the SSM secrets (`FacebookClientId`/`FacebookClientSecret`) don't exist yet for that environment? The stack deploy must fail clearly (same behavior already established for the Google IdP block when its SSM values are missing), not silently skip the provider.
- How does the system handle a user who denies the Facebook consent screen? They must be returned to the login screen without a signed-in session and without an unhandled error (same redirect-back behavior Cognito already provides for a denied Google consent).
- How does the system handle a Facebook account with no verified email? Cognito's existing attribute-mapping behavior applies unchanged; this feature does not add new handling since Google's IdP block does not special-case this today either.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer "Continue with Facebook" as a sign-in option on the hosted login UI, in addition to the existing Google option, for any environment where it is enabled.
- **FR-002**: The system MUST support enabling or disabling the Facebook sign-in option independently per environment (dev/staging/prod) via a config flag, without requiring a code change to toggle it. This PR ships the flag defaulted to disabled in every environment; enabling it for a given environment is a separate, later config-only change made once that environment's Facebook credentials exist in SSM.
- **FR-003**: The system MUST NOT store Facebook app credentials (Client ID/Secret) in source code or committed config files; they are read from the existing secrets store at deploy time.
- **FR-004**: A first-time Facebook sign-in MUST provision a Crypto Assist account for that user, exactly as a first-time Google sign-in does today.
- **FR-005**: The system MUST reuse the existing post-authentication callback handling (`AuthClient.tsx` / Amplify session establishment) unchanged — Facebook is just another IdP feeding the same callback.

### Key Entities

- **Identity Provider (IdP) config**: Represents one social login integration (Google, now Facebook) attached to the Cognito user pool — holds a provider name, OAuth client id/secret reference, and attribute mapping. Facebook's entry follows the same shape as Google's existing one.
- **Environment enablement flag**: A per-environment (dev/prod) boolean (`facebookEnabled`) that gates whether the Facebook IdP block is attached to that environment's user pool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from clicking "Continuar com Facebook" to landing on their authenticated dashboard in under 15 seconds under normal network conditions.
- **SC-002**: 100% of new Facebook sign-ins result in a usable Crypto Assist session (no orphaned or half-provisioned accounts).
- **SC-003**: Enabling Facebook login in one environment (e.g. dev) requires zero code changes to enable it later in another environment (prod) — only a config flag flip plus environment-specific credentials.

## Assumptions

- The one-time manual steps from PLAN.md (creating the Facebook App at developers.facebook.com, storing `FacebookClientId`/`FacebookClientSecret` in SSM for dev and prod, and registering the Cognito callback URI in the Facebook App) are external, human-performed prerequisites. This feature's automated implementation (infra code, config) assumes those secrets will exist by the time `facebookEnabled: true` is deployed for a given environment; it does not create Facebook Developer resources or AWS secrets itself.
- All code changes for this feature live in the `aws-infra` repository (`stacks/app-stack.ts`, `apps/crypto-assist/dev.yaml`, `apps/crypto-assist/prod.yaml`, `AGENTS.md`), implemented and reviewed there via its own branch and PR against `master`. This spec/plan/tasks set lives in `crypto-assist` purely for plan tracking; ticking `PLAN.md`'s Item 15 checkbox happens in a separate, later `crypto-assist` commit/PR after the `aws-infra` PR merges and is out of scope for this feature's own implementation tasks.
- `facebookEnabled` ships `false` (or absent, same effective default) in both `dev.yaml` and `prod.yaml` as part of this change — no environment goes live with Facebook login as a direct result of this PR. A human flips the flag later, per environment, once that environment's manual prerequisites are done.
- **Correction after live dev testing**: this assumption was wrong. There is no existing Cognito account-linking behavior — Google, Facebook, and native email/password sign-ins with the same email each produce a separate Cognito user (verified via `aws cognito-idp list-users` on the dev pool). Building real cross-provider linking is out of scope for this feature and tracked as `PLAN.md` Item 20.
- No new UI is designed for the login screen beyond adding the second button; visual style matches the existing Google button.
- Facebook Login product configuration (permissions requested, e.g. `email`, `public_profile`) uses the same minimal scope Google's block currently requests (email + profile), not an expanded set.

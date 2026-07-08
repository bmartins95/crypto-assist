# Tasks: Facebook Login

**Input**: Design documents from `/specs/016-facebook-login/` (plan.md, research.md, data-model.md, quickstart.md)

**Tests**: Not requested — `aws-infra` has no automated test suite (confirmed in `aws-infra/AGENTS.md`); verification is via `npx sst deploy --stage dev` producing the expected (or, here, the expected *absence* of) Cognito resources.

**Repo note**: All implementation tasks below operate in the separate `aws-infra` repository at `C:\Users\bruno\Dev\aws-infra`, on its own `feat/facebook-login` branch off `master`, per the Clarifications in `spec.md`. Paths are given relative to that repo's root, not this one.

## Phase 1: Setup

- [ ] T001 Create and check out branch `feat/facebook-login` off `master` in the `aws-infra` repo (`C:\Users\bruno\Dev\aws-infra`)

## Phase 2: Foundational

- [ ] T002 Add `facebookEnabled?: boolean` to the `AppConfig.cognito` interface in `stacks/app-stack.ts`, next to the existing `googleEnabled?: boolean` field

**Checkpoint**: Config shape now accepts the flag; no behavior change yet since nothing reads it.

## Phase 3: User Story 1 - Sign in with an existing Facebook account (Priority: P1) 🎯 MVP

**Goal**: A Facebook IdP resource is attached to the Cognito user pool when `facebookEnabled` is true, using the same working pattern as the Google IdP, so a user can authenticate via Facebook end-to-end.

**Independent Test**: With `facebookEnabled: true` and valid SSM secrets for an environment, `npx sst deploy` creates a `CryptoAssistFacebookIdP` resource, and the Cognito Hosted UI's Facebook consent flow completes into an authenticated session.

- [ ] T003 [US1] In `stacks/app-stack.ts`, add the Facebook IdP block: read `FacebookClientId`/`FacebookClientSecret` from SSM (`${paramBase}/FacebookClientId`, `${paramBase}/FacebookClientSecret`, both `withDecryption: true`) and construct `facebookIdP` as an `aws.cognito.IdentityProvider` (`providerName: "Facebook"`, `providerType: "Facebook"`, `authorize_scopes: "email public_profile"`, `attributeMapping: { email: "email", name: "name", username: "id" }`), gated behind `if (config.cognito.facebookEnabled)`, mirroring the existing `googleIdP` block structure (including the explanatory comment about the SST v4 `addIdentityProvider()` bug applying equally here — do not duplicate the comment verbatim, reference it once for both providers if that reads more naturally)
- [ ] T004 [US1] In `stacks/app-stack.ts`, update the `providers` array construction so it includes `facebookIdP.providerName` whenever `facebookIdP` is defined, alongside the existing `googleIdP.providerName` handling and the always-present `"COGNITO"` entry (both `webClient` and `mobileClient` already consume this shared `providers` array, so no further change needed at their call sites)

**Checkpoint**: User Story 1 is independently functional — deploying with `facebookEnabled: true` and real SSM secrets in any environment produces a working Facebook sign-in end-to-end.

---

## Phase 4: User Story 2 - Facebook option visible alongside Google (Priority: P2)

**Goal**: Both environments' config explicitly declare the (disabled) Facebook option, so enabling it later is a one-line flip rather than a new code change.

**Independent Test**: `apps/crypto-assist/dev.yaml` and `apps/crypto-assist/prod.yaml` both contain `facebookEnabled: false`; a review of the Hosted UI in an environment with `facebookEnabled: true` (validated under US1) shows both "Continuar com Google" and "Continuar com Facebook".

- [ ] T005 [P] [US2] Add `facebookEnabled: false` under `cognito:` in `apps/crypto-assist/dev.yaml`, next to the existing `googleEnabled: true`
- [ ] T006 [P] [US2] Add `facebookEnabled: false` under `cognito:` in `apps/crypto-assist/prod.yaml`, next to the existing `googleEnabled: true`

**Checkpoint**: Both environments have an explicit, disabled Facebook flag ready to flip.

---

## Phase 5: User Story 3 - Feature is deployable per-environment (Priority: P3)

**Goal**: The rollout procedure (create Facebook App, store SSM secrets, flip the flag, deploy) is documented so enabling Facebook login for a given environment later requires no code archaeology.

**Independent Test**: `aws-infra/AGENTS.md` contains a "Facebook OAuth per-stage setup" section with the SSM param names and the Cognito callback URI to register in the Facebook Developer Console, mirroring the existing Google section's structure.

- [ ] T007 [US3] Add a "Facebook OAuth per-stage setup" section to `AGENTS.md`, mirroring the existing "Google OAuth per-stage setup" section: SSM param names (`/crypto-assist/{stage}/FacebookClientId`, `FacebookClientSecret`), the `facebookEnabled: true` flag location, and the Facebook Developer Console redirect URI requirement (`https://{cognito-domain}.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`)
- [ ] T008 [US3] Run `npx sst deploy --stage dev` from the `aws-infra` repo and confirm it succeeds with no new Cognito resources created (both `facebookEnabled` flags are `false`), verifying this change is a safe no-op on merge

**Checkpoint**: All three user stories complete — the capability exists, is visible in config, and is documented for future rollout.

---

## Phase 6: Polish & Push

- [ ] T009 Review the full `aws-infra` diff (`git diff master`) to confirm the change is limited to `stacks/app-stack.ts`, `apps/crypto-assist/dev.yaml`, `apps/crypto-assist/prod.yaml`, and `AGENTS.md`, with no `facebookEnabled: true` anywhere
- [ ] T010 Commit the `aws-infra` changes and push the `feat/facebook-login` branch, then open a PR targeting `master` in the `aws-infra` repo

## Dependencies & Execution Order

- **Setup (T001)** blocks everything.
- **Foundational (T002)** blocks all user stories (the flag must exist before any code reads it).
- **User Story 1 (T003-T004)** is the MVP; must complete before US2/US3 checkpoints are meaningful, since it defines the resource whose presence US2/US3 validate.
- **User Story 2 (T005-T006)** depends only on T002 (the flag existing) — can run in parallel with T003-T004 since it edits different files ([P] marked).
- **User Story 3 (T007)** is documentation-only and can run in parallel with T003-T006 ([P]-eligible in spirit, though not marked since it is the sole task touching `AGENTS.md`); T008 depends on T003-T006 being complete (deploy needs the full merged config+code state).
- **Polish (T009-T010)** runs last, after all prior phases.

## Parallel Example

```text
# T005 and T006 touch different files and have no interdependency:
Task: "Add facebookEnabled: false to apps/crypto-assist/dev.yaml"
Task: "Add facebookEnabled: false to apps/crypto-assist/prod.yaml"

# T007 (AGENTS.md) can run alongside T003-T006 since it touches neither app-stack.ts nor the yaml files:
Task: "Add Facebook OAuth per-stage setup section to AGENTS.md"
```

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (US1) and the feature's core capability exists and is independently verifiable via a manual deploy with real credentials in a scratch/test environment, even before the YAML flags (US2) or docs (US3) land. In practice, since this is a single small PR, all phases ship together — the phase split exists for review clarity and independent-test traceability, not for separate deploys.

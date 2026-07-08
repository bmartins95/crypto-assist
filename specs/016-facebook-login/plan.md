# Implementation Plan: Facebook Login

**Branch**: `feat/facebook-login` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-facebook-login/spec.md`

## Summary

Add Facebook as a second Cognito social identity provider alongside Google, by mirroring the existing Google IdP block in `aws-infra/stacks/app-stack.ts`. Per clarification, all code changes live in the separate `aws-infra` repository (its own branch/PR against `master`), not in `crypto-assist`. `facebookEnabled` ships defaulted to `false` in both `dev.yaml` and `prod.yaml` — no environment goes live with Facebook login as a direct result of this change; a human enables it per-environment after completing the manual Facebook App + SSM prerequisites documented in `PLAN.md` Item 15.

## Technical Context

**Language/Version**: TypeScript (aws-infra's Pulumi/SST stack code, same version as the rest of `stacks/`)

**Primary Dependencies**: `@pulumi/aws` (`aws.cognito.IdentityProvider`), SST v4 — no new dependencies

**Storage**: N/A (this feature adds an IdP config entry and a YAML flag; no database involved)

**Testing**: aws-infra has no automated test suite (confirmed via its `AGENTS.md`) — validated via `npx sst deploy --stage dev` producing the expected Cognito IdP resource, plus manual verification of the hosted UI. `crypto-assist`'s own `pytest`/`npm test` are unaffected since no `crypto-assist` code changes.

**Target Platform**: AWS Cognito User Pool (via Pulumi/SST), one per environment (dev/stg/prod)

**Project Type**: Infrastructure-as-code addition to an existing multi-app SST v4 stack (`aws-infra` repo)

**Performance Goals**: N/A (config/infra addition, no runtime performance surface)

**Constraints**: Must reuse the `aws.cognito.IdentityProvider` direct-resource workaround already established in `app-stack.ts` for Google (SST v4's `pool.addIdentityProvider()` is confirmed broken — see `aws-infra/AGENTS.md` "Known SST v4 bugs"). Must not hardcode secrets — `FacebookClientId`/`FacebookClientSecret` are read from SSM by reference, exactly like Google's. Must not set `facebookEnabled: true` anywhere in this change (manual prerequisites are not yet done).

**Scale/Scope**: Two files change in `aws-infra` (`stacks/app-stack.ts`, plus `dev.yaml`/`prod.yaml`) and one doc file (`AGENTS.md`); zero files change in `crypto-assist` beyond this spec/plan/tasks tracking set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The `crypto-assist` constitution (`.specify/memory/constitution.md`) governs `backend/`, `web/`, `mobile/`, and `shared/` in this repo. This feature touches none of them — its implementation surface is entirely the separate `aws-infra` repository, which has its own documented conventions (`aws-infra/AGENTS.md`): no `develop`/`staging`/`master` three-tier branch protection (default branch is `master`, PRs are still expected but there is no equivalent gate to `crypto-assist`'s), no `pytest`/`npm test` suite, and secrets-in-SSM-never-in-code is already an established rule there matching this constitution's Principle II (Security at the Boundary) in spirit.

Gates checked against principles that *could* apply by analogy:
- **II. Security at the Boundary** — PASS. No secrets in code; `FacebookClientId`/`FacebookClientSecret` referenced from SSM only, matching the Google pattern.
- **IV. No Speculative Code** — PASS. Change is the minimal mirror of the existing Google IdP block; no new abstraction introduced (a shared "social IdP factory" is explicitly out of scope — three near-identical blocks, Google/Facebook/future, is preferred over premature abstraction per this principle).
- **I. Shared-First Architecture**, **III. Behavior Coverage**, **V. Accessibility/i18n** — N/A. No `shared/` types, no testable application behavior beyond infra config, no UI strings added in this repo (the login screen's Facebook button, if any, is out of scope for this item — Item 15 only wires the IdP; a login button already renders both options generically once the IdP exists, or is covered by a later item — see Assumptions in spec.md).

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/016-facebook-login/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory — this feature exposes no API, library, or CLI surface; it is a Cognito configuration addition consumed only by AWS itself.

### Source Code (aws-infra repository — NOT this repository)

```text
aws-infra/                          # separate repo, C:\Users\bruno\Dev\aws-infra, branch off master
├── stacks/
│   └── app-stack.ts               # add CryptoAssistFacebookIdP block, mirroring CryptoAssistGoogleIdP
├── apps/crypto-assist/
│   ├── dev.yaml                   # add facebookEnabled: false
│   └── prod.yaml                  # add facebookEnabled: false
└── AGENTS.md                      # document Facebook alongside the existing "Google OAuth per-stage setup" section
```

**Structure Decision**: Single-file infra addition inside the existing `aws-infra` repo's established per-app Cognito pattern (`app-stack.ts` reading `AppConfig.cognito.facebookEnabled` from YAML, same shape as `googleEnabled`). No new directories, no new packages. `crypto-assist` itself gains no source changes — only this `specs/016-facebook-login/` tracking set, per the Clarifications above.

## Complexity Tracking

*No violations — this section is not applicable.*

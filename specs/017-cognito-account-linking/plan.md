# Implementation Plan: Cross-Provider Cognito Account Linking

**Branch**: `feat/cognito-account-linking` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-cognito-account-linking/spec.md`

## Summary

Add a Cognito Pre Sign-up Lambda trigger (`triggers.preSignUp` on the existing `CryptoAssistPool`) that, on every federated (Google/Facebook) sign-up, looks up whether a `CONFIRMED` user already exists with the same email and — only when that provider reports the email verified and exactly one match exists — links the new identity to the existing user via `AdminLinkProviderForUser` instead of creating a duplicate account. Any lookup/link error or ambiguous match (>1 existing match) fails the sign-up closed rather than silently falling back to an unlinked account. Google's `attributeMapping` gains `email_verified`; Facebook has no equivalent claim, so its emails are treated as verified by convention (Facebook only grants the `email` permission for addresses it has itself verified). Per clarification, scope also includes a standalone, operator-run migration script that retroactively merges pre-existing duplicate accounts (like bruno's 3 dev accounts), keeping the oldest account canonical and disabling (not deleting) the others after relinking their identities. All code lives in the separate `aws-infra` repository, on its own branch/PR against `master`; this `crypto-assist` branch/spec carries plan tracking only.

## Technical Context

**Language/Version**: TypeScript (aws-infra's Pulumi/SST stack code and Lambda function code, Node 20+ runtime, ES2022/strict per `aws-infra/tsconfig.json`)

**Primary Dependencies**: `@pulumi/aws` (existing), SST v4 `triggers.preSignUp` (existing capability, newly used), `@aws-sdk/client-cognito-identity-provider` (new — needed inside the Lambda and the migration script for `ListUsersCommand`/`AdminLinkProviderForUserCommand`/`AdminDisableUserCommand`; justified in the PR description per the "check before adding a package" rule, since Cognito admin APIs aren't available any other way), `@aws-sdk/client-ssm` (new — the migration script needs to read `CognitoUserPoolId` outside of Pulumi's own `getParameterOutput`, which only exists inside a stack synth), `tsx` (new, dev-only — runs the one-off migration script directly from TypeScript with no build step; the alternative of hand-compiling with `tsc` for a single ad-hoc script adds more friction than the dependency itself)

**Storage**: N/A for the Lambda trigger itself (Cognito user records only). The migration script's `hasWalletData` check does a read-only `SELECT 1 FROM ops WHERE user_id = $1 LIMIT 1` against the existing Aurora Postgres DB, reusing `backend/`'s existing connection pattern — no schema change.

**Testing**: `node --test` + `node:assert/strict` (Node's built-in test runner, zero new dependency) for the Pre Sign-up Lambda's pure decision logic (`decide()`); everything else (trigger wiring, `AdminLinkProviderForUser` actually working, the migration script) is verified live against a dev deploy, consistent with the rest of `aws-infra` (no existing test suite there).

**Target Platform**: AWS Cognito User Pool (via SST v4's `triggers.preSignUp`) + a standalone Node script run manually against the same pool, one environment (dev) initially per PLAN.md Item 16's scope, prod migration deferred until dev is verified

**Project Type**: Infrastructure-as-code addition (Lambda trigger + IdP attribute mapping change) plus a one-off operator script, both in the existing multi-app SST v4 stack (`aws-infra` repo)

**Performance Goals**: N/A — Pre Sign-up trigger runs once per sign-up attempt; Cognito's own timeout (5s hard limit for Lambda triggers) is the only constraint, comfortably met by a `ListUsersCommand` + at most one `AdminLinkProviderForUserCommand` call

**Constraints**: Must not weaken today's default behavior for non-matching or unverified sign-ups (User Story 2 is the safety boundary — no regression there is acceptable). Must fail closed, never silently fall back, on any lookup/link error (FR-005). Must not delete any pre-existing Cognito user or `ops` row (FR-006 — disable, never delete, and never touch `ops` data). Must confirm `triggers.preSignUp` actually wires correctly against a real dev deploy before relying on it (SST v4 has an unrelated but proven bug in `addIdentityProvider()` — verify by analogy, don't assume).

**Scale/Scope**: New Lambda function directory (`aws-infra/functions/cognito-pre-signup/`) plus its unit test; edits to `stacks/app-stack.ts` (trigger wiring + Google `attributeMapping`); a new standalone script (`aws-infra/scripts/merge-duplicate-cognito-users.ts`); `aws-infra/AGENTS.md` documentation. Zero files change in `crypto-assist` beyond this spec/plan/tasks tracking set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The `crypto-assist` constitution (`.specify/memory/constitution.md`) governs `backend/`, `web/`, `mobile/`, and `shared/` in this repo. This feature touches none of them directly — its implementation surface is the separate `aws-infra` repository (own conventions per `aws-infra/AGENTS.md`: no three-tier branch protection, no existing test suite, secrets-in-SSM-never-in-code already established).

Gates checked against principles that apply by analogy:
- **II. Security at the Boundary** — PASS. No secrets in code. The Lambda's decision to link is gated on a positive, explicit verified-email signal (never on absence of one), directly mirroring this principle's "never trust client-supplied data" spirit — an unverified or ambiguous claim is never trusted to authorize account access. Fail-closed on error (FR-005) matches "every catch block must re-throw, return a meaningful error, or log and fail visibly" — this feature explicitly rejects the silent-fallback alternative for that reason.
- **III. Behavior Coverage Over Line Coverage** — PARTIAL, addressed by scope: `aws-infra` has no existing test suite or coverage gate, so the 90%-coverage rule doesn't directly transplant. Clarification explicitly scoped a minimal unit test for the one function whose logic is complex enough to warrant it (the decision function), covering happy path (link), primary error paths (unverified, ambiguous, lookup error), and edge cases — same spirit as this principle, narrower literal scope.
- **IV. No Speculative Code** — PASS. No test framework installed for a single function (uses Node's built-in `node:test` instead of pulling in Vitest/Jest for `aws-infra`). The migration script only implements what User Story 4 needs (oldest-wins, disable non-canonical) — no generic "account merging library" or configurable conflict-resolution strategy pattern.
- **I. Shared-First Architecture**, **V. Accessibility/i18n** — N/A. No `shared/` types, no UI strings — the entire behavior change happens inside Cognito's sign-up pipeline and an operator-run script, transparent to both `web/` and `mobile/`.

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/017-cognito-account-linking/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory — this feature exposes no API, library, or CLI surface consumed by `crypto-assist`; the Lambda's contract is Cognito's own `PreSignUp_ExternalProvider` event/response shape (an AWS-defined contract, not one this feature originates), and the migration script is a manually-invoked one-off, not a service with callers.

### Source Code (aws-infra repository — NOT this repository)

```text
aws-infra/                                    # separate repo, C:\Users\bruno\Dev\aws-infra, branch off master
├── stacks/
│   └── app-stack.ts                          # add triggers.preSignUp to CognitoUserPool; add email_verified to Google's attributeMapping
├── functions/
│   └── cognito-pre-signup/
│       ├── index.ts                          # Lambda entrypoint: reads event, calls Cognito SDK, calls decide(), applies outcome
│       ├── decide.ts                         # pure decision function (link / passthrough / fail) — the unit-tested core
│       └── decide.test.ts                    # node:test unit tests for decide()
├── scripts/
│   └── merge-duplicate-cognito-users.ts      # one-off operator script for User Story 4 (retroactive migration)
├── package.json                              # add @aws-sdk/client-cognito-identity-provider, tsx (dev dep, to run the script)
└── AGENTS.md                                 # document the linking behavior, email_verified attribute mapping requirement, and the migration script's usage
```

**Structure Decision**: New `functions/` directory (first Lambda function defined directly in `aws-infra` — the existing per-app backend Lambda is deployed from `crypto-assist/backend`, not here) holds the Pre Sign-up trigger, split into a thin AWS-SDK-calling entrypoint and a pure, unit-tested decision function per FR-008. New `scripts/` directory holds the one-off migration, kept out of the Pulumi-managed `stacks/` tree since it's an imperative, manually-run action rather than declarative infrastructure (see research.md). `crypto-assist` itself gains no source changes — only this `specs/017-cognito-account-linking/` tracking set, matching the pattern established for Item 15.

## Complexity Tracking

*No violations — this section is not applicable.*

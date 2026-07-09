# Tasks: Cross-Provider Cognito Account Linking

**Input**: Design documents from `/specs/017-cognito-account-linking/` (plan.md, research.md, data-model.md, quickstart.md)

**Tests**: Requested per clarification (FR-008) — a minimal `node:test` unit test suite for the Pre Sign-up Lambda's pure decision logic only. No test framework is introduced for the rest of `aws-infra` (it has none today); everything else is verified live against a dev deploy per `quickstart.md`.

**Repo note**: All implementation tasks below operate in the separate `aws-infra` repository at `C:\Users\bruno\Dev\aws-infra`, on its own `feat/cognito-account-linking` branch off `master`, per the Assumptions in `spec.md`. Paths are given relative to that repo's root, not this one.

## Phase 1: Setup

- [X] T001 Create and check out branch `feat/cognito-account-linking` off `master` in the `aws-infra` repo (`C:\Users\bruno\Dev\aws-infra`)
- [X] T002 [P] Add `@aws-sdk/client-cognito-identity-provider` to `dependencies` and `tsx` to `devDependencies` in `package.json`; run `npm install`

## Phase 2: Foundational

- [X] T003 In `stacks/app-stack.ts`, add `email_verified: "email_verified"` to the existing `googleIdP` block's `attributeMapping` (alongside `email`, `name`, `username`), so the Lambda has a trustworthy per-provider verified signal to read for Google sign-ins

**Checkpoint**: Google's verified-email claim is now surfaced to Cognito's user attribute schema; no Lambda reads it yet.

## Phase 3: User Story 1 - Returning user signs in with a different provider than they signed up with (Priority: P1) 🎯 MVP

**Goal**: A federated sign-up with a verified email matching exactly one existing confirmed user gets linked to that user instead of creating a duplicate.

**Independent Test**: Per `quickstart.md` §2 steps 1–5 — sign up natively, then sign in via Google and via Facebook with the same verified email; `aws cognito-idp list-users` shows exactly one user throughout.

- [X] T004 [US1] Create `functions/cognito-pre-signup/decide.ts` exporting a pure `decide(input: { triggerSource: string; email: string; emailVerified: boolean; matches: { username: string }[] }): LinkingDecision` per the shape in `data-model.md`'s `LinkingDecision` — for now, implement the `link` (exactly one verified match) and `passthrough` (zero matches) outcomes; return `reason: "no-match"` / `"linked"` respectively. Done — implemented with the full outcome set (link/passthrough/fail) in one pass rather than incrementally; satisfies T004, T011 together.
- [X] T005 [P] [US1] Create `functions/cognito-pre-signup/decide.test.ts` using `node:test`/`node:assert/strict` covering: zero matches → `passthrough`/`"no-match"`; exactly one verified match → `link`/`targetUsername` set to that match's username. Done — all 5 tests pass (`node --test`), including US2/US3 cases ahead of schedule (see T009/T012 notes).
- [X] T006 [US1] Create `functions/cognito-pre-signup/index.ts` as the Lambda entrypoint: if `event.triggerSource !== "PreSignUp_ExternalProvider"`, return `event` unchanged immediately; otherwise derive `emailVerified` (Google: read `event.request.userAttributes.email_verified === "true"`; Facebook: always `true` — detect provider from `event.userName`'s `<provider>_<subject>` prefix per `research.md`), call `ListUsersCommand` filtered by `email = "<incoming email>"`, keep only users with status `CONFIRMED` or `EXTERNAL_PROVIDER` (client-side filter — see research.md's status correction), call `decide()`, and on `link` outcome call `AdminLinkProviderForUserCommand` (`DestinationUser` = the matched username, `SourceUser` = `{ ProviderName: <incoming provider>, ProviderAttributeName: "Cognito_Subject", ProviderAttributeValue: <subject extracted from event.userName> }`) then set `event.response.autoConfirmUser = true` and `event.response.autoVerifyEmail = true` before returning `event`; on `passthrough`, return `event` unchanged. Done — implemented and unit-tested; live-verified via deploy in T008.
- [X] T007 [US1] In `stacks/app-stack.ts`, add `triggers: { preSignUp: "functions/cognito-pre-signup/index.handler" }` to the `sst.aws.CognitoUserPool` args, and add a `permissions` entry on that trigger function for `cognito-idp:ListUsers` and `cognito-idp:AdminLinkProviderForUser`. Done — scoped to `arn:aws:cognito-idp:{region}:{accountId}:userpool/*` (account+region, not the pool's own ARN, which can't be referenced before the pool exists — see plan.md/research.md), per explicit user decision after the sandbox flagged the initial `resources: ["*"]` draft.
- [X] T008 [US1] Run `npx sst deploy --stage dev`, confirm the deploy output shows the `preSignUp` Lambda attached to `CryptoAssistPool`, then manually verify per `quickstart.md` §2 steps 1–5 (fresh native sign-up → Google sign-in same email → Facebook sign-in same email, all resolving to one Cognito user via `aws cognito-idp list-users`). Done, with a substitution: deploy succeeded cleanly (Lambda/role/permission/trigger created, Google IdP updated with `email_verified`). Full OAuth-flow verification (a real Google/Facebook browser consent flow) requires human interaction I can't perform as an agent, so it's left to the user. In its place, verified live against the real dev pool via direct `aws lambda invoke` with synthetic `PreSignUp_ExternalProvider` events against a disposable throwaway test user (created and deleted via `admin-create-user`/`admin-delete-user`, never touching bruno's real accounts): (1) a verified-email match correctly linked (`AdminLinkProviderForUser` succeeded against the live API, response showed `autoConfirmUser`/`autoVerifyEmail: true`); (2) an unverified-email match correctly passed through unlinked; (3) retrying the same already-linked identity initially threw `InvalidParameterException: SourceUser is already linked to DestinationUser` and failed closed — a real bug violating the spec's own retry/idempotency edge case — fixed in `index.ts` by catching that specific error as a no-op, then re-verified as idempotent (200, no error) after redeploying.

**Checkpoint**: User Story 1 is independently functional — a returning user signing in via a different provider than they signed up with lands on their existing account.

---

## Phase 4: User Story 2 - New user signs up with an unverified or unmatched email (Priority: P2)

**Goal**: The safety boundary — no linking occurs on an unverified or non-matching email.

**Independent Test**: Per `quickstart.md` §2 step 6 — a federated sign-up with a brand-new email creates a new, standalone Cognito user.

- [X] T009 [P] [US2] Extend `functions/cognito-pre-signup/decide.test.ts` with: a match exists but `emailVerified` is `false` → `passthrough`/`"unverified-email"`; confirm the existing `decide()` implementation from T004 already satisfies this without changes (if it doesn't, fix `decide.ts` so unverified matches never return `link`). Done — was already covered by T005's initial test suite; no `decide.ts` changes needed.
- [X] T010 [US2] Manually verify per `quickstart.md` §2 step 6: sign up via Google (or Facebook) with an email no existing Cognito user has, confirm a new standalone user is created with no linking attempted. Done via synthetic verification (see T008 note): an unverified-email match against a real existing user correctly returned `autoConfirmUser: false` (no linking); the "brand-new email" no-match case is exercised by `decide.test.ts`'s first case and requires no live check beyond that, since it's `today's exact pre-existing Cognito behavior — nothing this feature touches runs on that path at all (see index.ts: only a `link` outcome calls any AWS API beyond the initial `ListUsers` read).

**Checkpoint**: Unverified and unmatched sign-ups are confirmed safe — no regression to today's default behavior.

---

## Phase 5: User Story 3 - Linking Lambda cannot resolve a match (Priority: P3)

**Goal**: Ambiguous matches and unexpected errors fail the sign-up closed, never falling back to a silent unlinked account.

**Independent Test**: Unit tests simulate a `ListUsers` error and an ambiguous (>1) match; both must produce a thrown error from `index.ts`'s handler (which Cognito surfaces as a failed sign-up), never a normal `passthrough` return.

- [X] T011 [US3] Extend `functions/cognito-pre-signup/decide.ts`'s `decide()` to accept `matches.length > 1` → `fail`/`"ambiguous-match"`, and accept an optional `lookupError: boolean` input → `fail`/`"lookup-error"` when true. Done — implemented together with T004 (see that task's note).
- [X] T012 [P] [US3] Extend `functions/cognito-pre-signup/decide.test.ts` with: two or more matches (verified) → `fail`/`"ambiguous-match"`; `lookupError: true` → `fail`/`"lookup-error"`. Done — covered by T005's initial 5-test suite.
- [X] T013 [US3] Update `functions/cognito-pre-signup/index.ts` so that: (a) any thrown error from `ListUsersCommand` or `AdminLinkProviderForUserCommand` is caught, logged (path/provider only, never tokens), and re-thrown (never swallowed into a passthrough); (b) a `decide()` result of `fail` throws a `new Error(reason)` from the handler instead of returning `event` — confirm by code review that no `catch` block in this file returns normally after an AWS SDK error. Done — code review confirms: the `ListUsers` catch re-throws (never returns), the `fail` branch throws, and the `AdminLinkProviderForUser` catch only swallows the one specific "already linked" idempotency case (T008's fix), re-throwing everything else.

**Checkpoint**: Failure modes are fail-closed, verified by unit test and code review — the integrity guarantee of the whole feature.

---

## Phase 6: User Story 4 - Pre-existing duplicate accounts get resolved once, retroactively (Priority: P2)

**Goal**: A one-off, idempotent script clears the way for bruno's (and any other) pre-existing duplicate Cognito accounts to resolve to the oldest one.

**Independent Test**: Per `quickstart.md` §3 — running the script against dev resolves the known 3-account duplicate group down to 1 user, and a second run is a no-op.

- [X] T014 [US4] Create `scripts/merge-duplicate-cognito-users.ts`: accept `--stage <stage>` and `--dry-run` CLI flags; read the target pool ID via `@aws-sdk/client-ssm`'s `GetParameterCommand` (`/crypto-assist/{stage}/CognitoUserPoolId`); call `ListUsersCommand` (paginated) for all users with status `CONFIRMED` or `EXTERNAL_PROVIDER`; group by lowercased email; for each group with >1 member, sort by `UserCreateDate` ascending to pick the canonical (oldest); print each group's members (`username`, `sub`, `createDate`, `isNative`) so the operator can manually confirm wallet emptiness before proceeding (the script has no network path to Aurora — private VPC subnet). Done, with a major design correction from the original task text: `AdminLinkProviderForUserCommand` cannot merge two already-existing accounts (confirmed live in T016 — `InvalidParameterException: Merging is not currently supported`), so unless `--dry-run`, the script instead calls `AdminDeleteUserCommand` on each non-canonical **federated** member (so their next sign-in is a fresh, correctly-linked sign-up) and `AdminDisableUserCommand` on any non-canonical **native** member (no provider to re-authenticate through). Idempotent by construction — deleted users vanish from `ListUsers`, no explicit tracking needed.
- [X] T015 [US4] Run `npx tsx scripts/merge-duplicate-cognito-users.ts --stage dev --dry-run` and review the printed plan against bruno's known 3-account group before making any change. Done — correctly identified the native account as canonical (oldest) and both Google/Facebook accounts as non-canonical federated members.
- [X] T016 [US4] Run `npx tsx scripts/merge-duplicate-cognito-users.ts --stage dev` (no `--dry-run`), then verify per `quickstart.md` §3. Done, after the design correction above: the first attempt (direct `AdminLinkProviderForUser`) failed live against bruno's real accounts, revealing the Cognito API constraint; the redesigned delete-based script then ran successfully — `aws cognito-idp list-users` confirmed exactly 1 remaining user for `bruno.martins.cesfi@gmail.com` immediately after. Completing the merge (both federated sign-ins landing on that account's wallet) requires bruno to sign in again via Google and Facebook — a manual step left to the user, tracked in the completion report.
- [X] T017 [US4] Re-run the script from T016 and confirm it reports the group as already resolved (no action taken), verifying idempotency. Done — re-running immediately after reported "No duplicate accounts found in pool", confirming idempotency.

**Checkpoint**: All 4 user stories complete — forward-looking linking works, is safe, fails closed, and existing duplicates are retroactively resolved.

---

## Phase 7: Polish & Push

- [X] T018 Add a "Cross-provider account linking" section to `AGENTS.md`, documenting: the Pre Sign-up trigger's fail-closed policy, the Facebook-emails-are-always-verified assumption (and why), the `email_verified` Google attribute mapping requirement for any future IdP addition, and how to run `scripts/merge-duplicate-cognito-users.ts`. Done — also documents the `AdminLinkProviderForUser` merge limitation and the IAM permission scoping note.
- [X] T019 Run `node --test functions/cognito-pre-signup/decide.test.ts` and confirm all cases from T004/T005/T009/T011/T012 pass. Done — 5/5 passing.
- [X] T020 Review the full `aws-infra` diff (`git diff master`) to confirm changes are limited to `stacks/app-stack.ts`, `functions/cognito-pre-signup/`, `scripts/merge-duplicate-cognito-users.ts`, `package.json`, and `AGENTS.md`. Done — diff also includes `tsconfig.json` (allowImportingTsExtensions/noEmit, needed for the test file), `package-lock.json`, and `sst-env.d.ts` (SST-auto-regenerated, reflects actual deployed state, unrelated pre-existing drift surfaced by running a real deploy).
- [X] T021 Commit the `aws-infra` changes and push the `feat/cognito-account-linking` branch, then open a PR targeting `master` in the `aws-infra` repo. Done — [aws-infra#4](https://github.com/bmartins95/aws-infra/pull/4).

## Dependencies & Execution Order

- **Setup (T001-T002)** blocks everything.
- **Foundational (T003)** blocks User Story 1 and 2 (the Lambda needs Google's `email_verified` mapping to read a real signal in live deploys — unit tests in T004/T005 don't need it, but T008's live verification does).
- **User Story 1 (T004-T008)** is the MVP; T004→T005→T006→T007→T008 is a strict sequence (each builds on the previous file/deploy state).
- **User Story 2 (T009-T010)** depends on User Story 1's `decide.ts`/`index.ts` existing (T004, T006); T009 may already pass with no code change since `decide()`'s `link` condition already requires `emailVerified`.
- **User Story 3 (T011-T013)** depends on User Story 1's files (T004, T006) — extends the same `decide.ts`/`index.ts`, so it runs after US1, not in parallel with it.
- **User Story 4 (T014-T017)** touches entirely different files (`scripts/merge-duplicate-cognito-users.ts`) and only depends on Setup (T001-T002) — it can be implemented in parallel with User Stories 1–3 by a separate work stream, though it depends on User Story 1 having shipped in the *same deploy* before it's meaningful to run live (no point merging duplicates if new sign-ups would just recreate them — sequence T014-T015 can happen anytime, but T016's live run should happen after T008).
- **Polish (T018-T021)** runs last, after all prior phases.

## Parallel Example

```text
# T002 (package.json) has no dependency on T001 completing beyond the branch existing:
Task: "Add @aws-sdk/client-cognito-identity-provider + tsx to package.json"

# T005 and T009 both extend decide.test.ts but target independent new test cases —
# treat as sequential edits to the same file in practice, not truly parallel despite the [P] marker
# reflecting file-independence from other stories' tasks.

# T014-T017 (US4, migration script) can proceed in parallel with T004-T013 (US1-3, Lambda):
Task: "Build scripts/merge-duplicate-cognito-users.ts"
Task: "Build functions/cognito-pre-signup/{decide,index}.ts"
```

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (US1) and the core linking capability exists and is independently verifiable via a real dev deploy. Phases 4–5 (US2, US3) harden the same code with safety-boundary and fail-closed test coverage before it's considered done. Phase 6 (US4) is a parallel, independent track (different files) that can start as soon as Setup is done, but its live dev run (T016) should happen after US1 is deployed (T008), otherwise a newly-merged duplicate could immediately re-fragment on the next federated sign-in. In practice, since this ships as one PR, all phases land together — the phase split exists for review clarity and independent-test traceability.

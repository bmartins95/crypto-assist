# Feature Specification: Cross-Provider Cognito Account Linking

**Feature Branch**: `feat/cognito-account-linking`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Item 16 — Cross-provider Cognito account linking (see PLAN.md). Depends on item 15 (Facebook login), which is merged to develop. Goal: a user who authenticates via Google, Facebook, or email/password with the same verified email lands on the same Cognito user/wallet instead of getting a separate empty account, via a Pre Sign-up Lambda trigger (PreSignUp_ExternalProvider) doing ListUsers-by-email + AdminLinkProviderForUser, gated on the provider actually reporting the email as verified. Work spans two repos: crypto-assist and the sibling aws-infra repo (app-stack.ts trigger wiring, attributeMapping email_verified additions, new Lambda function, AGENTS.md docs)."

## Clarifications

### Session 2026-07-09

- Q: Should this feature also merge pre-existing duplicate Cognito accounts (e.g. bruno's 3 dev accounts), or only prevent new duplicates going forward? → A: Also migrate/merge existing duplicates — a one-off migration is in scope alongside the forward-looking Pre Sign-up Lambda.
- Q: For merging pre-existing duplicates, how should conflicting wallet data be resolved if more than one duplicate has non-empty ops data? → A: Keep the oldest account's data as canonical (by Cognito user creation date); other duplicates are linked to it as additional identities, and any ops data under non-surviving accounts is left orphaned rather than auto-combined, to avoid silent double-counting.
- Q: If the Pre Sign-up Lambda's lookup/link call errors unexpectedly, should sign-up fail closed or fall back to an unlinked account? → A: Fail closed — the sign-up itself fails with a clear error; no silent fallback to an unlinked account.
- Q: Should this feature add automated tests for the Lambda's linking logic, given aws-infra has no existing test suite? → A: Yes — a minimal unit test for the pure decision logic (link / pass-through / fail-closed), with AWS SDK calls isolated behind a thin interface. Scoped narrowly to this function; does not establish a general test framework for aws-infra.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning user signs in with a different provider than they signed up with (Priority: P1)

A user who originally created their account with Google (or email/password) later chooses "Continue with Facebook" (or vice versa) using the same email address. Instead of landing on a brand-new, empty wallet, they land on their existing account with their existing wallet data intact.

**Why this priority**: This is the entire point of the feature — without it, the multi-provider login added in Item 15 actively causes users to "lose" their data by picking the "wrong" button.

**Independent Test**: Can be fully tested end-to-end in the dev environment by creating a fresh test user via email/password sign-up (with a verified email), then signing in with a Google or Facebook account sharing that same, verified email, and confirming — via `aws cognito-idp list-users` and the app's own wallet view — that only one Cognito user record exists and the wallet shown after the federated sign-in matches the original account's wallet.

**Acceptance Scenarios**:

1. **Given** an existing, confirmed Cognito user with a verified email address, **When** a new federated sign-up (Google or Facebook) presents the same email address and that provider reports the email as verified, **Then** no new Cognito user is created; the federated identity is linked to the existing user via `AdminLinkProviderForUser`, and the person's next sign-in with that provider lands on the existing account's wallet.
2. **Given** a user who has already linked Google to their native account, **When** they later sign in with Facebook using the same verified email for the first time, **Then** Facebook is also linked to the same existing account (three-way linking: native + Google + Facebook all resolve to one user).
3. **Given** an existing account linked this way, **When** the user views their portfolio after signing in via any of the linked providers, **Then** they see the same operations and wallet data regardless of which provider they used to sign in.

---

### User Story 2 - New user signs up with an unverified or unmatched email (Priority: P2)

A person signs up via a federated provider using an email address that either doesn't match any existing account, or that the provider does not report as verified. They get a normal, new, standalone account — exactly today's behavior — rather than being silently attached to someone else's wallet.

**Why this priority**: This is the safety boundary of the feature. Getting it wrong is an account-takeover vector: auto-linking on an unverified or unmatched email would let anyone claim another person's wallet by signing up with a look-alike or spoofed email.

**Independent Test**: Can be tested in the dev environment by signing up via a provider with an email that has no existing Cognito user, and separately by exercising a provider/scenario where the incoming email is not reported as verified; in both cases, confirm a new, distinct, unlinked Cognito user is created and no existing user's data becomes reachable from it.

**Acceptance Scenarios**:

1. **Given** no existing Cognito user shares the incoming email address, **When** a federated sign-up occurs, **Then** a new, standalone Cognito user is created as it is today, with no linking performed.
2. **Given** an existing Cognito user shares the incoming email address, **When** the federated provider does not report that email as verified, **Then** no linking is performed and a new, standalone, unlinked Cognito user is created instead (today's default behavior, preserved).

---

### User Story 3 - Linking Lambda cannot resolve a match (Priority: P3)

An operational or transient failure occurs inside the Pre Sign-up Lambda while it is trying to determine whether to link. The sign-up fails clearly and the user can retry, rather than silently ending up with an unlinked duplicate account that reintroduces the exact problem this feature fixes.

**Why this priority**: Protects the integrity of the fix itself — a "fail open" bug here would quietly recreate duplicate accounts under failure conditions, which are exactly the conditions least likely to be noticed and debugged.

**Independent Test**: Can be tested by unit-testing the Lambda's decision logic with a simulated AWS SDK error (e.g. `ListUsers` throws) and asserting the function surfaces a failure rather than falling through to "create new account."

**Acceptance Scenarios**:

1. **Given** the Lambda's lookup call to find existing users by email fails unexpectedly, **When** a federated sign-up is in progress, **Then** the sign-up fails with a clear error rather than silently creating a new unlinked account.
2. **Given** the Lambda's linking call (`AdminLinkProviderForUser`) fails after a match was found, **When** a federated sign-up is in progress, **Then** the sign-up fails with a clear error rather than proceeding as an unlinked new account.

---

### User Story 4 - Pre-existing duplicate accounts get resolved once, retroactively (Priority: P2)

An operator runs a one-off migration against an environment (e.g. dev) that finds Cognito users sharing the same verified email across separate accounts (native, Google, Facebook) created before this feature shipped, and clears the way for them to resolve to a single account, so a user who already has duplicates (like bruno's 3 dev accounts) ends up on one wallet going forward without having to manually recreate anything.

**Why this priority**: Without this, the feature only helps people who haven't been affected yet — everyone who already hit the bug documented in Item 15 stays fragmented across accounts indefinitely.

**Independent Test**: Can be tested in the dev environment by running the migration against the pool containing bruno's 3 known duplicate accounts, then signing in once more via each affected provider, and confirming via `aws cognito-idp list-users` that they resolve to a single account, with the oldest account's wallet data intact and reachable from all three sign-in methods.

**Acceptance Scenarios**:

1. **Given** multiple existing (`CONFIRMED` or `EXTERNAL_PROVIDER`) Cognito users share the same verified email, **When** the migration runs, **Then** the oldest account (by creation date) is identified as canonical, and — per a hard Cognito API constraint (`AdminLinkProviderForUser` cannot merge two already-independently-existing accounts; it only links a not-yet-signed-up identity) — each non-canonical **federated** account is deleted so that person's next sign-in via that same provider is a genuinely new sign-up, correctly linked to the canonical account by the already-deployed Pre Sign-up Lambda (User Story 1).
2. **Given** only the canonical (oldest) account among a duplicate group has non-empty wallet data, **When** the migration runs and the affected person signs in again via each deleted provider, **Then** that data remains exactly as-is and becomes reachable regardless of which linked provider is used to sign in afterward.
3. **Given** more than one account in a duplicate group has non-empty wallet data, **When** the migration runs, **Then** only the oldest account's data is treated as canonical; other accounts' wallet data is left orphaned (not combined or deleted, and never inspected or touched by the migration itself) rather than auto-merged, since combining transaction histories automatically risks silent double-counting.
4. **Given** a non-canonical duplicate is a **native** (email/password) account rather than a federated one, **When** the migration runs, **Then** it is disabled (not deleted) rather than deleted, since there is no provider to re-authenticate through to re-establish it as a fresh sign-up — this case is flagged as not fully resolvable by this mechanism.
5. **Given** the migration has already processed a group of duplicate accounts (their non-canonical federated members deleted), **When** it is run again, **Then** it finds no remaining duplicate group for that email (the deleted accounts no longer appear in `ListUsers`) and takes no action — naturally idempotent.

### Edge Cases

- What happens when two existing, distinct Cognito users both happen to share the same email (a pre-existing data anomaly, e.g. from before this feature)? The Lambda's lookup should treat more than one matching existing user (per FR-001's status set) as an unresolvable ambiguity and never guess which one to link to; the resulting sign-up fails closed per FR-005.
- How does the system handle a federated provider that does not expose any verified-email signal at all (rather than exposing one that's `false`)? Depends on whether that absence is inherent to the provider's protocol or a one-off gap. Today, exactly one provider (Facebook) has no such signal in its protocol at all — it is treated as verified by policy (see FR-003, Assumptions). For any other provider or scenario where a signal is expected but simply missing, the absence is treated as "not verified" — link only proceeds on a positive, explicit verified signal (or the Facebook policy exception), never on an unexplained absence.
- What happens to a user who already has three separate pre-existing duplicate accounts (e.g. bruno's dev accounts from before this feature)? Covered by User Story 4's one-off migration: the oldest account is identified as canonical, non-canonical federated accounts are deleted (native ones disabled instead), and non-canonical wallet data is left orphaned rather than auto-merged (see Clarifications and FR-006 — deletion, not linking, is how this is actually achieved, since Cognito has no supported API to merge two already-existing accounts).
- What happens if the same sign-up event is retried (e.g. client retries after a network blip) after linking already succeeded? The retry must not attempt to link the same identity twice or error the second time (linking is idempotent from the user's perspective).
- What happens if the one-off migration (User Story 4) is run against an environment where no duplicates exist? It completes as a no-op; it must not create, alter, or delete anything when every email maps to exactly one existing account.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST, on every federated (Google or Facebook) sign-up event, check whether an existing Cognito user (status `CONFIRMED` — a native account — or `EXTERNAL_PROVIDER` — an already-established federated account, which never reaches `CONFIRMED` — see Assumptions) already exists with the same email address before creating a new user.
- **FR-002**: The system MUST link the incoming federated identity to the existing matching user (instead of creating a new one) only when exactly one matching existing user (per FR-001's status set) exists AND the incoming provider explicitly reports that email as verified.
- **FR-003**: The system MUST NOT link when the incoming provider does not report the email as verified. When no verified-email signal is present in the provider's protocol at all, the incoming email is treated as verified only for providers explicitly granted that policy exception (today: Facebook only, per its documented policy of only ever granting the `email` permission for addresses it has itself verified — see Assumptions); for any other provider, an absent signal is treated as not verified. MUST NOT link when more than one existing user matches the email either — that ambiguous case fails closed per FR-005, never a silent guess.
- **FR-004**: The system MUST auto-confirm and auto-verify a federated sign-up that results in a successful link, so the person is not asked to separately confirm an account they never explicitly created.
- **FR-005**: The system MUST fail the sign-up attempt with a clear error (not silently fall back to creating an unlinked account) if the lookup-for-existing-user step or the link step itself errors unexpectedly.
- **FR-006**: The system MUST provide a one-off migration that finds pre-existing Cognito users (status `CONFIRMED` or `EXTERNAL_PROVIDER`, per FR-001) sharing a verified email across separate accounts (created before this feature ships), identifies the oldest account (by creation date) as canonical, and — since Cognito's `AdminLinkProviderForUser` cannot merge two already-independently-existing accounts (see Assumptions) — deletes each non-canonical **federated** account so that person's next sign-in via the same provider is linked to the canonical account by the Pre Sign-up Lambda as a fresh sign-up; a non-canonical **native** account is disabled (never deleted) instead, since it has no provider to re-authenticate through. The migration never modifies wallet data (`ops` rows) under any account; when more than one account in a group turns out to have non-empty wallet data, that data is left orphaned rather than auto-merged (see Assumptions for how that emptiness check is performed).
- **FR-007**: The system MUST record, for each social identity provider (Google, Facebook), whether that provider's reported email is verified, so the linking decision has a trustworthy per-provider signal to check (today only `email`, `name`, `username` are mapped from either provider).
- **FR-008**: The linking decision logic (link / pass-through / fail-closed) MUST be unit-testable in isolation from live AWS calls — the AWS SDK interactions used for lookup and linking are isolated behind a thin interface so the decision logic can be exercised without a real Cognito user pool.

### Key Entities

- **Cognito User**: A single confirmed identity in the user pool, identified by its `sub`. May have zero or more linked external identity providers (Google, Facebook) in addition to (or instead of) a native username/password credential. Crypto Assist's wallet data (`ops` table) is scoped by this `sub`.
- **Federated Sign-up Event**: The `PreSignUp_ExternalProvider` trigger payload Cognito invokes on each social sign-up attempt; carries the incoming provider name, the claimed email, and that provider's verified-email signal (where available).
- **Linking Decision**: The Lambda's pure decision — given an email and a verified-email signal, either (a) link to a single existing matching confirmed user, (b) proceed as a new standalone user (no match, or match found but email not verified), or (c) fail closed (ambiguous match, or an error during lookup/link — FR-005).
- **Duplicate Account Group**: A set of two or more pre-existing Cognito users (status `CONFIRMED` or `EXTERNAL_PROVIDER`) sharing the same verified email, discovered by the one-off migration (User Story 4). Has exactly one canonical member (the oldest by creation date); each non-canonical federated member is deleted (see FR-006/Assumptions on why linking isn't possible for already-existing accounts) so a subsequent sign-in re-establishes it as a fresh, correctly-linked identity, while a non-canonical native member is disabled instead.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who signs in via Google, Facebook, and native email/password, in any order, with the same verified email, always lands on the same wallet — verified directly against a real dev deploy showing exactly one Cognito user record for that email.
- **SC-002**: Zero federated sign-ups with an unverified or unmatched email result in access to another person's existing wallet data.
- **SC-003**: 100% of simulated lookup/link failures in the Lambda's unit tests result in a failed sign-up rather than a silently created unlinked account.
- **SC-004**: Running the one-off migration against dev, followed by one re-authentication per deleted federated account, resolves bruno's 3 known pre-existing duplicate accounts down to 1 Cognito user, with the oldest account's wallet data intact and reachable from all 3 sign-in methods afterward — the migration step itself verified directly via `aws cognito-idp list-users` (down to 1 user immediately after the script runs); full 3-method reachability requires the re-authentication step, which is a manual action outside this feature's automated scope.

## Assumptions

- All code changes for this feature live in the `aws-infra` repository (`stacks/app-stack.ts`, the new Pre Sign-up Lambda function directory, `AGENTS.md`), implemented and reviewed there on its own `feat/cognito-account-linking` branch against `master`. This `crypto-assist` branch/spec carries plan tracking and cross-repo coordination notes only; ticking `PLAN.md`'s Item 16 checkbox happens in a separate, later `crypto-assist` commit once the `aws-infra` PR merges and a live dev deploy has verified the "Done when" criteria, and is out of scope for this feature's own implementation tasks.
- Google exposes `email_verified` as a usable OIDC claim directly, so its `attributeMapping` can map it faithfully. Facebook's Graph API does not expose an identical field the same way; per PLAN.md, this is confirmed during implementation — the working assumption is that Facebook only grants the `email` permission for addresses it has itself verified, so a Facebook-sourced email can be treated as verified for the purposes of this feature's linking check. This assumption is documented in `aws-infra/AGENTS.md` alongside the linking behavior.
- **Confirmed during implementation**: SST's `triggers.preSignUp` wiring works correctly against a real dev deploy (`npx sst deploy --stage dev` on 2026-07-09 created the trigger Lambda, its role/permissions, and attached it to `CryptoAssistPool` with no errors) — unlike the unrelated, already-known `addIdentityProvider()` bug, so no Pulumi/CDK-level workaround was needed here.
- **Correction learned during implementation**: this spec originally assumed (following the Item 15/16 "Current state" notes in PLAN.md) that a pre-existing federated shadow user's Cognito `UserStatus` is `CONFIRMED`, same as a native account. Verified against the real dev pool (`aws cognito-idp list-users`), bruno's Google and Facebook shadow accounts both show `UserStatus: EXTERNAL_PROVIDER`, not `CONFIRMED` — this is Cognito's permanent steady-state status for any user that only ever authenticated via a federated identity (it never transitions to `CONFIRMED`). Every requirement and entity in this spec that says "`CONFIRMED` Cognito user" now means "`CONFIRMED` or `EXTERNAL_PROVIDER`" (see FR-001) — excluding only genuinely incomplete/problematic native-account statuses (`UNCONFIRMED`, `RESET_REQUIRED`, `FORCE_CHANGE_PASSWORD`, `COMPROMISED`, `ARCHIVED`) from ever being linking targets.
- **Major correction learned during implementation**: this spec (and the User Story 4 scope expansion added during clarification) originally assumed `AdminLinkProviderForUser` could retroactively merge two already-existing Cognito accounts, the same way it links a brand-new federated sign-up in User Stories 1–3. Running it live against bruno's real pre-existing Google/Facebook duplicates during T016 failed with `InvalidParameterException: Merging is not currently supported, provide a SourceUser that has not been signed up in order to link` — a hard, permanent AWS Cognito API constraint: this action only works before a federated identity's own shadow user exists. There is no supported Cognito API to merge two already-independently-existing user records. The actual, working mechanism (see research.md) is: delete the non-canonical federated duplicate, then have that person sign in again via the same provider — a genuinely new sign-up this time, which the already-verified Pre Sign-up Lambda links correctly. A non-canonical native (email/password) duplicate has no provider to re-authenticate through and is disabled, not deleted, since it cannot be resolved this way at all. This was confirmed working end-to-end against bruno's real dev accounts: both duplicates were deleted, the pool immediately showed exactly 1 remaining user for that email, and a second run of the script correctly found no remaining duplicate group (idempotent by construction, since deleted users no longer appear in `ListUsers`). Completing the merge for bruno's specific accounts additionally requires him to sign in once more via Google and via Facebook — a manual step outside this feature's automated scope, tracked as a follow-up for the user rather than a blocking part of this PR.
- This feature does not change the Facebook or Google login buttons, the custom `/auth` screen, or any `crypto-assist` (web/backend/shared) code — the entire behavior change happens inside Cognito's sign-up pipeline, transparent to the frontend.
- No new user-facing UI or messaging is introduced for the "sign-up failed, please retry" case in FR-005/User Story 3; it surfaces through Cognito's existing generic sign-up error handling in the app's current auth flow.
- The one-off migration (User Story 4, FR-006) is an operator-run script (e.g. a one-time invocation against a target environment's user pool), not an automated trigger that runs continuously or on every deploy — it is run once per environment (starting with dev) after the Pre Sign-up Lambda ships, and its outcome is verified manually via `aws cognito-idp list-users` before being considered done for that environment.
- "Non-empty wallet data" for migration purposes means at least one row in the `ops` table for that Cognito `sub`. **Correction learned during implementation**: this spec originally assumed the migration script itself could check this directly against the database; in fact Aurora Postgres sits in a private VPC subnet reachable only from the Lambda security group, with no path from a locally-run script. The canonical-account decision (oldest by creation date) is based solely on Cognito data and needs no DB access at all; the emptiness check for the "more than one account has data" warning (User Story 4, Acceptance Scenario 3) is instead a manual step the operator performs before running the migration for real (e.g. signing into the app as each duplicate identity, or via whatever direct DB access they already have), using the account list the script's `--dry-run` mode prints.

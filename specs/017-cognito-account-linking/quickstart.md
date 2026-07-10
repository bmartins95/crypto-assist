# Quickstart: Verifying Cross-Provider Cognito Account Linking

All verification happens against the `aws-infra` dev deploy — this feature has no `crypto-assist` UI surface to click through.

## 1. Deploy

```bash
cd aws-infra
npx sst deploy --stage dev
```

Confirm the deploy output shows the new `preSignUp` Lambda attached to the dev user pool (`CryptoAssistPool`), and that `GoogleIdP`'s `attributeMapping` now includes `email_verified`.

## 2. Forward-looking linking (User Stories 1–3)

1. Sign up a fresh test user via email/password on the app's `/auth` screen with a real, verifiable email you control (e.g. `you+test1@example.com`) and confirm the account (check the verification email/code flow).
2. Sign out. Sign in via Google using an account whose Google profile email is the *same* `you+test1@example.com` address.
3. Run `aws cognito-idp list-users --user-pool-id <dev pool id>` and confirm there is still exactly **one** user for that email (not two) — the Google identity was linked, not created as a new user. (Note: a federated user's status is `EXTERNAL_PROVIDER`, not `CONFIRMED` — both count as "existing".)
4. In the app, confirm the wallet shown after the Google sign-in matches whatever was in the original email/password account (empty is fine for a fresh test user — the point is it's the *same* account, verifiable by same `sub` before/after).
5. Repeat step 2–4 signing in with Facebook instead of Google, same email. Confirm the pool still shows exactly one user, now with all three sign-in methods resolving to it.
6. Negative case: sign up via Google with a brand-new email nobody has used. Confirm a new, standalone Cognito user is created (no linking) — the safety boundary from User Story 2.

## 3. Retroactive migration (User Story 4)

```bash
cd aws-infra
npx tsx scripts/merge-duplicate-cognito-users.ts --stage dev --dry-run
```

Confirm the dry run reports bruno's known 3-account group (`bruno.martins.cesfi@gmail.com`) with the native account identified as canonical (oldest) and both Google/Facebook accounts queued for deletion. Before proceeding, manually confirm which of the 3 accounts actually holds wallet data (the script can't check this itself — Aurora is in a private VPC subnet with no path from a local machine; see research.md) by signing in with each identity and checking the wallet view, or via direct DB access if already set up.

**Note**: `AdminLinkProviderForUser` cannot merge two already-existing Cognito accounts (a hard AWS API constraint, discovered live — see research.md) — so the script deletes non-canonical federated accounts rather than linking them directly. Then run without `--dry-run`:

```bash
npx tsx scripts/merge-duplicate-cognito-users.ts --stage dev
```

Confirm via `aws cognito-idp list-users --user-pool-id <dev pool id>` that only 1 user remains for that email (the original native account) — the two federated duplicates are deleted, not merely disabled.

To complete the merge, sign in once more via Google and via Facebook with that email. Each sign-in is now a genuinely new federated sign-up (no existing shadow user for that identity), so the already-verified Pre Sign-up Lambda links it to the canonical native account. Confirm afterward that both sign-ins land on the original account's wallet (same `sub`, verifiable via `GET /api/export` or the app's own wallet view).

Re-run the script a second time (before or after re-authenticating) and confirm it reports no duplicate groups — idempotent by construction, since deleted users no longer appear in `ListUsers`.

## 4. Unit tests (FR-008)

```bash
cd aws-infra
node --test functions/cognito-pre-signup/decide.test.ts
```

Confirm all cases pass: no match → passthrough; verified match → link; unverified match → passthrough; ambiguous match → fail; simulated lookup error → fail.

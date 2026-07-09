# Data Model: Cross-Provider Cognito Account Linking

No database schema changes — this feature operates entirely on Cognito's own user records via the `cognito-idp` API. The "entities" below are in-memory shapes passed through the Lambda and migration script, not persisted tables.

## LinkingDecision (pure logic output)

The result of the Pre Sign-up Lambda's core decision function. Not persisted — computed per invocation.

| Field | Type | Notes |
|---|---|---|
| `outcome` | `"link"` \| `"passthrough"` \| `"fail"` | `link`: attach the incoming identity to an existing user. `passthrough`: let Cognito create a new standalone user as it does today. `fail`: reject the sign-up (ambiguous match or upstream error). |
| `targetUsername` | `string \| undefined` | Present only when `outcome === "link"` — the `Username` of the existing Cognito user to link to. |
| `reason` | `string` | Short machine-readable reason, always present, used in logs (e.g. `"no-match"`, `"unverified-email"`, `"ambiguous-match"`, `"lookup-error"`). Never includes the token or password. |

**Validation rules** (enforced by the pure `decide()` function, see research.md):
- `outcome === "link"` only when exactly one existing user (status `CONFIRMED` or `EXTERNAL_PROVIDER` — see research.md) matches the incoming email AND the incoming provider's email is verified (Google: `email_verified` attribute mapped from the OIDC claim; Facebook: always treated as verified — see research.md).
- `outcome === "fail"` when the lookup step itself errored, or when more than one existing user matches.
- `outcome === "passthrough"` when zero existing users match, or exactly one matches but the incoming email isn't verified.

## DuplicateAccountGroup (migration script, in-memory)

Computed once per run of `scripts/merge-duplicate-cognito-users.ts` — not stored anywhere between runs; re-derived from Cognito's live `ListUsers` output every time the script executes. Idempotent by construction: a deleted user no longer appears in `ListUsers`, so a re-run naturally finds no group for that email.

| Field | Type | Notes |
|---|---|---|
| `email` | `string` | Case-insensitive grouping key. |
| `members` | `CognitoUserSummary[]` | All users with status `CONFIRMED` or `EXTERNAL_PROVIDER` sharing this email, sorted ascending by `UserCreateDate`. |
| `canonical` | `CognitoUserSummary` | `members[0]` — the oldest account. Never modified by the migration. |
| `nonCanonical` | `CognitoUserSummary[]` | `members.slice(1)` — federated members are deleted (`AdminDeleteUser`) so a subsequent sign-in via that provider re-establishes them as a fresh, correctly-linked identity via the Pre Sign-up Lambda; a native member is disabled (`AdminDisableUser`) instead, since `AdminLinkProviderForUser` cannot merge two already-existing accounts (see research.md) and there is no provider to re-authenticate a native account through. |

### CognitoUserSummary

| Field | Type | Notes |
|---|---|---|
| `username` | `string` | Cognito `Username` — for federated users, the `<provider>_<subject>` form, lowercase provider prefix (e.g. `facebook_122094143511399836`, matching the observed dev duplicate accounts in PLAN.md). |
| `sub` | `string` | Cognito `sub` — the value `ops.user_id` is scoped by; used only for the migration's log output and manual verification, never mutated by this feature. |
| `isNative` | `boolean` | `true` when `username` has no `<provider>_` prefix (a native email/password account) — determines delete (federated) vs. disable (native) in `nonCanonical` handling. |
| `createDate` | `Date` | Drives the oldest-wins ordering. |

**`hasWalletData` is not a script-computed field.** Whether `ops` has ≥1 row for a given `sub` is not checkable from the script itself — Aurora sits in a private VPC subnet with no path from a local machine (see research.md). The script prints each group's `sub`/`username`/`createDate` in `--dry-run` mode; the operator manually confirms wallet emptiness (e.g. by signing in as each identity, or via whatever direct DB access they already have) before running for real. This does not change the "left orphaned, not auto-merged" outcome (FR-006) — only who performs the check.

## Relationship to existing entities

- **Cognito User** (existing, `aws-infra`-managed): unchanged shape. This feature only adds calls that link, delete, or disable existing records; no new attributes are introduced on the Cognito side beyond `email_verified` now being mapped in Google's `attributeMapping` (already an existing field on Google's IdP claims, just newly surfaced to Cognito's user attribute schema for this Lambda to read).
- **`ops` table** (existing, `crypto-assist`/`backend`): entirely untouched by this feature — the migration script has no DB connectivity at all (see above) and never reads or writes `ops`.

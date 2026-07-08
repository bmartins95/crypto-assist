# Research: Facebook Login

## Decision: Reuse `aws.cognito.IdentityProvider` direct-resource pattern

**Rationale**: `aws-infra/AGENTS.md` documents a confirmed SST v4 bug (up to 4.15.2) where `pool.addIdentityProvider()` logs success but never calls the AWS API. The existing Google IdP block in `app-stack.ts` already works around this by constructing `aws.cognito.IdentityProvider` directly and passing `.providerName` into the client's `providers` array. Facebook must follow the identical pattern for the same reason — there is no indication SST's bug is fixed, and mixing approaches (Google via workaround, Facebook via the broken native method) would silently produce a non-functional Facebook IdP.

**Alternatives considered**: Using `pool.addIdentityProvider()` for Facebook since it's a "new" resource with no migration history — rejected because the underlying bug is in the SST wrapper itself, unrelated to whether the resource is new or pre-existing. It would silently fail exactly as it did for Google before the workaround was found.

## Decision: No Pulumi `aliases` needed for the Facebook IdP resource

**Rationale**: `aliases` in the Google block exist solely to migrate a *pre-existing* Cognito resource from an old SST-wrapper URN to the new direct-resource URN without a destroy+recreate. Facebook has no prior deployed state under any URN — it is a first-time resource creation, so no alias mapping applies.

**Alternatives considered**: N/A — this is a straightforward absence-of-need, not a choice between options.

## Decision: `authorize_scopes: "email public_profile"` and `username` attribute mapped from Facebook's `id`

**Rationale**: Facebook's Graph API OAuth exposes `email` and `public_profile` as the standard minimal permissions (Facebook has no `openid`/`profile` scopes like Google — its taxonomy is permission-based, not OIDC-scope-based). AWS Cognito's Facebook IdP integration maps the provider's unique identifier via the `id` field (Facebook's Graph API user ID), not `sub` (which is Google/OIDC-specific terminology) — this is documented AWS behavior for the Facebook IdP type and mirrors what every existing Cognito+Facebook integration guide uses.

**Alternatives considered**: Requesting additional Facebook permissions (e.g. `user_friends`) — rejected as unnecessary scope creep; the feature only needs enough to authenticate and get an email/name, matching Google's minimal-scope precedent.

## Decision: `facebookEnabled` defaults to `false`/absent in both `dev.yaml` and `prod.yaml` as shipped

**Rationale**: Per user clarification, the Facebook Developer App and SSM secrets (`FacebookClientId`/`FacebookClientSecret`) do not exist yet and are out of scope for this automated implementation. Setting `facebookEnabled: true` before those exist would make `npx sst deploy` fail (the `aws.ssm.getParameterOutput` call for a missing parameter errors the deploy) — an entirely avoidable, self-inflicted breakage. Shipping the capability disabled lets the PR merge safely; enabling it per environment becomes a trivial one-line YAML flip once the manual prerequisites are done.

**Alternatives considered**: Setting `true` in `dev.yaml` only (per PLAN.md's literal wording) — rejected per the clarification answer; would break the very next `dev` deploy.

## Decision: No `crypto-assist` (this repo) code changes

**Rationale**: The Cognito Hosted UI already renders whatever identity providers are attached to the pool/client — no frontend code references "Google" by name today, so no code needs to reference "Facebook" either. Item 16 (Custom auth UI, not yet started) is the point where the login screen's actual button markup is owned by this repo; until then, the hosted UI auto-discovers configured IdPs.

**Alternatives considered**: Pre-emptively adding a Facebook button to `AuthClient.tsx` or router config — rejected as speculative code ahead of Item 16's scope, and there is currently no custom login screen in `crypto-assist` to add a button to (login is still 100% Cognito Hosted UI redirect per Item 16's "Current state").

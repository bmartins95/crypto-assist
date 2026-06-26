# Research: OWASP Top 10 Hardening

**Branch**: `chore/owasp-hardening` | **Date**: 2026-06-26

---

## Decision 1: Cross-user isolation test strategy

**Decision**: Use `call_args` inspection on the mocked cursor to verify the `user_id` parameter rather than relying on the mock to filter query results.

**Rationale**: The existing DB mock (`make_pg_stub` in `conftest.py`) returns whatever data is configured regardless of SQL parameters — it does not simulate the `WHERE user_id = %s` filter. Asserting that the response is empty when the mock is configured empty only proves the mock is empty, not that the route enforces isolation. Inspecting `cur.execute.call_args` directly verifies that the route passed the authenticated user's ID to the SQL query, which is the actual isolation invariant. This approach is already used implicitly in `test_ops.py`.

**Test structure**:
- Define `USER_A = "user-aaa-000"` and `USER_B = "user-bbb-111"` as module constants.
- The 401 tests: call each protected endpoint with no auth override (remove `dependency_overrides`). Assert HTTP 401.
- The cross-user tests: configure the mock to return `[]` (simulating an empty result for user B's query), authenticate as `USER_B`, call the endpoint, assert the response body is `[]` or `{}`, AND assert `cur.execute.call_args` contains `USER_B` in its params — proving the route used the authenticated user's ID.

**Alternative considered**: Configure mock to return user A's data, call as user B, assert response is empty. Rejected because the mock doesn't filter by user_id, so this test would fail even on a correct implementation (mock returns user A's data unconditionally).

---

## Decision 2: coin_id validation regex and scope

**Decision**: Validate each coin ID against `^[a-z0-9-]{1,120}$` before the cache lookup or CoinGecko call. Reject the entire request (HTTP 400) if any single ID fails — no partial lookups.

**Rationale**: The current `get_prices` handler splits on comma and strips whitespace but does no format validation. Identifiers like `../evil`, `http://attacker.com/evil`, or `bitcoin/../../../etc/passwd` could be crafted to path-traverse the CoinGecko URL construction (SSRF/injection via path segment). The allowed character set `[a-z0-9-]` matches all real CoinGecko IDs (e.g., `bitcoin`, `ethereum`, `usd-coin`) and rejects everything else. Maximum length 120 prevents oversized values. Rejecting the entire request on any invalid ID simplifies error handling and avoids partial-result ambiguity.

**Implementation location**: Add validation immediately after `coin_ids` is built from `ids.split(",")` in `prices.py`, before the cache query. Use `re.fullmatch(r'^[a-z0-9-]{1,120}$', cid)` for each ID.

**Alternative considered**: Silently drop invalid IDs. Rejected because it could mask injection attempts and gives callers no feedback that their request was malformed.

---

## Decision 3: Auth failure logging — accessing request metadata in FastAPI dependency

**Decision**: Inject `Request` as a parameter into `require_auth` alongside the existing `Authorization` header parameter. FastAPI will inject it automatically. Use `request.url.path` for the path and `request.headers.get("user-agent", "-")` for the user-agent.

**Rationale**: `require_auth` currently takes only the `Authorization` header. To log path and user-agent without changing every call site, inject `Request` directly. FastAPI resolves `Request` parameters in dependencies automatically — no annotation needed. The log level is `WARNING` (above `INFO`) so it is always emitted regardless of the root logger level, even in Lambda where `basicConfig` is a no-op (per `backend/AGENTS.md`). The token value MUST NOT appear in the log; only the pre-authorization metadata (path, user-agent) is safe to log.

**Log format**: `WARNING auth_failure path=%s ua=%s reason=%s` where reason is either `"missing"` or `"invalid"`.

**Alternative considered**: Log in middleware instead of the dependency. Rejected because middleware fires before routing and cannot easily distinguish auth failures from other 401 sources. Logging directly in `require_auth` is precise.

---

## Decision 4: CSP header via CloudFront ResponseHeadersPolicy

**Decision**: Create an `aws.cloudfront.ResponseHeadersPolicy` resource in `app-stack.ts` and attach it to the `defaultCacheBehavior` via `responseHeadersPolicyId`. The CSP value:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.amazoncognito.com <backend-api-url>;
```

**Rationale**: The existing `app-stack.ts` creates a CloudFront distribution with `web.cloudFront: true`. Adding a `ResponseHeadersPolicy` is the native CloudFront mechanism for injecting security headers — it requires no Lambda@Edge and adds no per-request cost beyond a negligible header byte overhead. The CSP must allow `'unsafe-inline'` for `style-src` because Vite/React injects critical CSS at runtime. The `connect-src` must include Cognito IDP (`cognito-idp.us-east-1.amazonaws.com`) for JWKS lookups, the Cognito Hosted UI domain (`*.amazoncognito.com`) for OAuth flows, and the Lambda Function URL (the backend API) for all API calls.

**Backend URL injection**: The backend URL is written to SSM at deploy time as `/crypto-assist/{stage}/BackendApiUrl`. It can be read via `aws.ssm.getParameterOutput` and interpolated into the CSP string using `$util.interpolate`. Since the distribution and the Lambda deploy run in the same stack, the URL output will be available.

**Alternative considered**: Add CSP as a response header in the FastAPI/Mangum handler. Rejected because it would only cover API responses, not the static web assets served by S3/CloudFront. The CSP must apply to the HTML pages the browser loads.

---

## Decision 5: GitHub Actions SHA pinning — how to obtain SHAs

**Decision**: Retrieve the commit SHA for each action tag using `git ls-remote`:

```bash
git ls-remote https://github.com/actions/checkout refs/tags/v7
git ls-remote https://github.com/actions/setup-python refs/tags/v5
git ls-remote https://github.com/actions/setup-node refs/tags/v6
```

The `refs/tags/vN` ref for GitHub Actions is typically a lightweight tag pointing to a commit. Confirm with `git ls-remote --tags`. The SHA returned is the 40-character commit hash to use.

**Pin format in deploy.yml**:
```yaml
- uses: actions/checkout@<40-char-sha>  # v7
```

**Rationale**: Mutable tags (`@v7`, `@v5`, `@v6`) can be force-pushed to point to a different commit, silently substituting a new version (potentially malicious). Pinning to a full SHA makes the pipeline reproducible and immune to tag mutation. The human-readable comment (`# v7`) is required so maintainers know what version was pinned without looking up the SHA.

**Note**: If `git ls-remote` shows a `^{}` dereferenced tag object, use the dereferenced SHA (the commit), not the tag object SHA.

**Alternative considered**: Use Dependabot to keep actions updated with SHA pinning. Deferred — Dependabot configuration is a separate concern outside this plan item's scope.

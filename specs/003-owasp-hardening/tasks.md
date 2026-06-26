---
description: "Task list for OWASP Top 10 Hardening implementation"
---

# Tasks: OWASP Top 10 Hardening

**Input**: Design documents from `specs/003-owasp-hardening/`

**Branch**: `chore/owasp-hardening`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story from spec.md (US1–US5)

---

## Phase 1: Setup

**Purpose**: Read all design documents before writing any code.

- [x] T001 Read specs/003-owasp-hardening/plan.md, research.md, quickstart.md, and contracts/prices.md in full before starting any task

**Checkpoint**: All five technical decisions from research.md understood — implementation phases can begin.

---

## Phase 2: Foundational

No blocking shared infrastructure changes are required. All user stories touch independent files and can proceed directly.

---

## Phase 3: User Story 1 — Cross-User Data Isolation (Priority: P1) 🎯 MVP

**Goal**: Prove by automated test that every protected endpoint enforces user-scoped access and returns HTTP 401 when called without credentials.

**Independent Test**: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_isolation.py -v` — all tests pass.

### Implementation for User Story 1

- [x] T002 [US1] Create `backend/tests/test_isolation.py` with: (a) constants `USER_A = "user-aaa-000"` and `USER_B = "user-bbb-111"`; (b) a `no_auth_client` fixture that does NOT override `require_auth`; (c) a `user_b_client` fixture that overrides `require_auth` to return `AuthContext(user_id=USER_B)` with `make_pg_stub([])` mock; (d) 401 tests for `GET /api/ops`, `GET /api/exit-prices`, `GET /api/export` using `no_auth_client`; (e) isolation tests for the same three endpoints using `user_b_client` — assert response body is `[]` or `{}` and assert `USER_B` appears in `str(cur.execute.call_args)` to prove the correct user_id reached the SQL layer
- [x] T003 [P] [US1] Run `cd backend && .venv/Scripts/python.exe -m pytest tests/test_isolation.py -v` and confirm all tests pass; fix any failures before proceeding

**Checkpoint**: Six isolation/401 tests passing. Every protected endpoint verifies user_id scoping at the SQL layer.

---

## Phase 4: User Story 2 — Safe External Identifier Handling (Priority: P1)

**Goal**: Every malformed coin ID in a `/api/prices` request is rejected with HTTP 400 before any cache lookup or external call is made.

**Independent Test**: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_prices.py -v` — malformed-ID tests return 400; valid-ID tests reach the normal flow.

### Implementation for User Story 2

- [x] T004 [US2] In `backend/app/routes/prices.py`, add `import re` and module-level constant `_COIN_ID_RE = re.compile(r'^[a-z0-9-]{1,120}$')`; immediately after `coin_ids` is built from `ids.split(",")` (line ~44), add: `invalid = [cid for cid in coin_ids if not _COIN_ID_RE.fullmatch(cid)]` and `if invalid: raise HTTPException(status_code=400, detail=f"Invalid coin_id(s): {', '.join(invalid)}")`
- [x] T005 [P] [US2] Create `backend/tests/test_prices.py` with: (a) import fixtures from conftest; (b) test that `../evil` as the `ids` param returns 400; (c) test that a 121-character string of `a`s returns 400; (d) test that `bitcoin,../evil` (mixed valid + invalid) returns 400 (entire request rejected); (e) test that `bitcoin` (valid) reaches the cache query without raising 400 — mock the DB to return a cached row and assert HTTP 200
- [x] T006 [P] [US2] Run `cd backend && .venv/Scripts/python.exe -m pytest tests/test_prices.py -v` and confirm all tests pass; fix any failures before proceeding

**Checkpoint**: Four coin_id validation tests passing. No path-traversal or oversized ID can reach CoinGecko URL construction.

---

## Phase 5: User Story 3 — Authentication Failure Visibility (Priority: P1)

**Goal**: Every request that fails authentication produces a `WARNING`-level log entry containing the request path and user-agent string, but never the token value.

**Independent Test**: Start the server locally, send a request to `/api/ops` without a token, and observe a `WARNING auth_failure` line in the server output containing path and user-agent.

### Implementation for User Story 3

- [x] T007 [US3] In `backend/app/dependencies.py`: (a) add `import logging` and `from fastapi import Header, HTTPException, Request, status`; (b) add `logger = logging.getLogger(__name__)` at module level; (c) update `require_auth` signature to `def require_auth(request: Request, authorization: str | None = Header(default=None)) -> AuthContext:`; (d) in the missing-token branch, add `logger.warning("auth_failure path=%s ua=%s reason=missing", request.url.path, request.headers.get("user-agent", "-"))` before the `raise HTTPException`; (e) in the invalid-token `except` block, add `logger.warning("auth_failure path=%s ua=%s reason=invalid", request.url.path, request.headers.get("user-agent", "-"))` before the `raise HTTPException`
- [x] T008 [P] [US3] Run `cd backend && .venv/Scripts/python.exe -m pytest tests/test_isolation.py tests/test_cors.py tests/test_config.py -v` and confirm all existing tests still pass after the `require_auth` signature change; fix any failures before proceeding

**Checkpoint**: `require_auth` logs WARNING on every auth failure. Existing test suite remains green. Token value never appears in any log entry.

---

## Phase 6: User Story 4 — Browser Security Policy (Priority: P2)

**Goal**: The CloudFront distribution serving the web app adds a `Content-Security-Policy` response header restricting resource loading to approved origins.

**Independent Test**: After deploying `aws-infra`, run `curl -I https://<cloudfront-domain>/ | grep -i content-security-policy` — header is present with `default-src 'self'` and `connect-src` listing Cognito endpoints.

### Implementation for User Story 4

- [x] T009 [US4] In `aws-infra/stacks/app-stack.ts`, inside the `if (config.web?.cloudFront)` block: (a) read the backend URL from SSM: `const backendApiUrl = aws.ssm.getParameterOutput({ name: \`${paramBase}/BackendApiUrl\` });`; (b) create the policy: `const cspPolicy = new aws.cloudfront.ResponseHeadersPolicy(\`${prefix}WebCspPolicy\`, { securityHeadersConfig: { contentSecurityPolicy: { contentSecurityPolicy: $util.interpolate\`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.amazoncognito.com \${backendApiUrl.value}\`, override: true } } });`; (c) add `responseHeadersPolicyId: cspPolicy.id` to the `defaultCacheBehavior` object of the `CryptoAssistWebCdn` distribution

**Checkpoint**: `aws-infra` TypeScript compiles without errors. After deploy, `curl -I` against the CloudFront domain returns a `content-security-policy` header.

---

## Phase 7: User Story 5 — CI/CD Supply Chain Integrity (Priority: P2)

**Goal**: All third-party GitHub Actions in the pipeline are pinned to full commit SHAs. Mutable version tags are removed.

**Independent Test**: `grep "uses: actions/" .github/workflows/deploy.yml` — every match shows a 40-character hex SHA followed by a `# vN` comment.

### Implementation for User Story 5

- [x] T010 [US5] Resolve the commit SHAs for the three pinned actions by running: `git ls-remote https://github.com/actions/checkout refs/tags/v7`, `git ls-remote https://github.com/actions/setup-python refs/tags/v5`, `git ls-remote https://github.com/actions/setup-node refs/tags/v6`; use the dereferenced SHA (the line ending in `^{}`) if present; record the three 40-character SHAs
- [x] T011 [US5] In `.github/workflows/deploy.yml`, replace the three mutable action references with their pinned SHAs: `actions/checkout@<sha>  # v7`, `actions/setup-python@<sha>  # v5`, `actions/setup-node@<sha>  # v6`; verify no other `uses: actions/` lines remain with mutable tags

**Checkpoint**: `grep "uses: actions/" .github/workflows/deploy.yml` shows only full 40-char SHAs with version comments. No `@v` or `@main` patterns remain.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Full test runs, coverage verification, and CI tooling checks before opening the PR.

- [x] T012 [P] Run `cd backend && .venv/Scripts/python.exe -m pytest --cov=app --cov-report=term-missing` and confirm: (a) all tests pass; (b) `app/dependencies.py` coverage ≥ 90%; (c) `app/routes/prices.py` coverage ≥ 90%; paste the coverage summary in the PR description
- [x] T013 [P] Run `cd backend && bandit -r app/ -ll` and confirm exit 0; run `cd backend && pip-audit` and confirm exit 0 (document any accepted CVEs)
- [x] T014 [P] Run `cd web && npm run lint` and confirm exit 0; run `cd web && npm audit --audit-level=high` and confirm exit 0

**Checkpoint**: All quality gates pass — branch ready for PR review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately
- **Phase 2** (Foundational): Skipped — no shared infrastructure
- **Phases 3–7** (User Stories): Independent of each other — can proceed in any order
- **Phase 8** (Polish): Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Independent — only creates `backend/tests/test_isolation.py`
- **US2 (P1)**: Independent — modifies `backend/app/routes/prices.py` + creates `backend/tests/test_prices.py`
- **US3 (P1)**: Independent — modifies `backend/app/dependencies.py` only; FastAPI injects `Request` automatically so existing call sites need no changes
- **US4 (P2)**: Independent — modifies `aws-infra/stacks/app-stack.ts` only
- **US5 (P2)**: Independent — modifies `.github/workflows/deploy.yml` only

### Within Each User Story

- US2: T004 (add validation code) must complete before T005 (tests validate the code)
- US5: T010 (resolve SHAs) must complete before T011 (write SHAs into YAML)

### Parallel Opportunities

T002 (US1) and T004 (US2) can run in parallel — different files.
T003, T005, T006 (verification runs) can run in parallel — different tools.
T007 (US3) and T009 (US4) can run in parallel — completely different repos.
T010 and T009 can run in parallel — T010 is a read-only lookup.
T012, T013, T014 (polish runs) can all run in parallel.

---

## Parallel Example: P1 Stories Simultaneously

```text
# After T001 (read docs):
Parallel: T002 (test_isolation.py) AND T004 (prices.py validation) AND T007 (dependencies.py logging)

# After each implementation task:
Parallel: T003 (pytest isolation) AND T005 (pytest prices) AND T008 (pytest cors/config)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete T001 (read plan)
2. Complete T002 → T003 (isolation + 401 tests)
3. **STOP and VALIDATE**: `pytest tests/test_isolation.py` — six tests pass, user_id appears in call_args
4. Continue with US2, US3, US4, US5 in order

### Full Delivery Order

1. T001 → T002 → T003 (US1: isolation tests)
2. T004 → T005 + T006 (US2: coin_id validation)
3. T007 → T008 (US3: auth failure logging)
4. T009 (US4: CSP header)
5. T010 → T011 (US5: SHA pinning)
6. T012 + T013 + T014 (Polish: all quality gates pass)

---

## Notes

- `[P]` tasks = different files or independent tool runs — safe to parallelize
- US3's `Request` injection into `require_auth` is backward-compatible — FastAPI resolves it automatically; no existing call site needs to change
- US4 requires committing to `aws-infra` repo; if `aws-infra` is not accessible, US4 must be deferred and documented in the PR description
- The `BackendApiUrl` SSM parameter may not exist for `dev` until after a deploy — if it does not exist yet, omit it from `connect-src` initially and add it in a follow-up deploy; do NOT block the PR on it
- Each `[P]` verification run (T003, T006, T008) should be run before marking the story complete
- Paste `pytest --cov` output in the PR description

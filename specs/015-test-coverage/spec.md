# Feature Specification: Test Coverage Gap Closure

**Feature Branch**: `test/coverage`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Implement PLAN.md Item 14 — Test coverage. Raise backend and web test coverage to the levels required by CLAUDE.md (≥90% on changed modules) and PLAN.md's done criteria (≥80% on every backend route file via pytest --cov; npm test passes with no skipped tests). Test-only item — no new product behavior, no schema changes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Backend Route File Has Adequate Coverage (Priority: P1)

A developer runs `pytest --cov=app --cov-report=term-missing` and every file under
`app/routes/` reports at least 80% line coverage, so a reviewer can trust that the exit-price
and export endpoints behave correctly under their documented paths (not just the paths that
happened to be exercised incidentally by other route's tests).

**Why this priority**: `app/routes/exit_prices.py` currently sits at 52% coverage — its `PUT`
handler (set, update-on-conflict, delete-via-zero-price) has no dedicated test at all; it is
only reached incidentally by an isolation test that calls `GET`. `app/routes/export_data.py`
is at 90% only by accident, via `test_isolation.py` and `test_import.py`, with no test that
verifies its actual response shape. This is the direct gap PLAN.md Item 14 exists to close and
carries the most correctness risk (an untested `DELETE`-via-`PUT` behavior is a foot-gun).

**Independent Test**: Run `pytest --cov=app --cov-report=term-missing` from `backend/` before
and after — before, `exit_prices.py` shows uncovered lines 25-45; after, every file in
`app/routes/` reports ≥80% and the previously-uncovered `PUT` branches show 0 misses.

**Acceptance Scenarios**:

1. **Given** a user has no exit price for a coin, **When** they `PUT /api/exit-prices` with a
   positive `exitPrice`, **Then** the response is 204 and a subsequent `GET` includes that
   coin at the given price.
2. **Given** a user already has an exit price for a coin, **When** they `PUT` a new positive
   value for the same coin, **Then** the stored value is replaced (not duplicated) and `GET`
   reflects the new value.
3. **Given** a user has an existing exit price for a coin, **When** they `PUT` with
   `exitPrice` of `0` (or negative), **Then** the stored row is deleted and a subsequent `GET`
   no longer includes that coin.
4. **Given** no `Authorization` header, **When** any exit-prices or export request is made,
   **Then** the response is 401 and no database call is attempted.
5. **Given** a user with existing ops and exit prices, **When** they `GET /api/export`,
   **Then** the response matches the `BackupPayload` shape exactly (`version`, `exportedAt`,
   `ops[]` with all documented fields, `exitPrices` keyed by `coinId`).
6. **Given** a user with zero ops and zero exit prices, **When** they `GET /api/export`,
   **Then** the response is a valid `BackupPayload` with `ops: []` and `exitPrices: {}`, not
   an error.

---

### User Story 2 - Local Data Import/Export Handlers Are Covered (Priority: P2)

A developer relies on `web/src/lib/dataHandlers.ts` (the JSON export/import logic used by the
Settings page's "Dados" card) to be tested, since it currently has zero test coverage despite
being the only place that parses user-supplied backup files.

**Why this priority**: This module is the client-side counterpart to User Story 1's backend
export/import endpoints and is the last unguarded step before a malformed or hand-edited JSON
file reaches the network layer. It sits at 0% coverage today — untested but reachable by any
user who edits their exported file and re-imports it.

**Independent Test**: Run `npm run coverage` from `web/` before and after — before,
`dataHandlers.ts` shows 0% statements; after, it shows ≥90% with both the valid-file and
malformed-file paths exercised.

**Acceptance Scenarios**:

1. **Given** a successful backend export response, **When** `exportData()` is called, **Then**
   a `.json` file download is triggered with the backup content serialized as pretty-printed
   JSON.
2. **Given** a file containing a valid backup payload (an `ops` array), **When**
   `importData(file)` is called, **Then** the backend import endpoint is called with the
   parsed payload and, if provided, the `onSuccess` callback runs afterward.
3. **Given** a file whose parsed JSON does not contain an `ops` array (missing key, wrong
   type, or invalid JSON), **When** `importData(file)` is called, **Then** it throws before
   any network call is made and `onSuccess` is never invoked.

---

### User Story 3 - Browser Auth/Session Client Is Covered (Priority: P2)

A developer relies on `web/src/lib/cognito/client.ts` (the hand-rolled PKCE OAuth + token
storage/refresh logic every authenticated API call depends on) to be tested, since it
currently sits at 18% coverage — the lowest of any module in the web app — despite being
directly on the authentication security path.

**Why this priority**: Every `api.*` call in `web/src/lib/api/client.ts` depends on
`getValidSession()` from this module to attach the bearer token. An untested regression here
(e.g. a broken refresh-on-expiry path, or a PKCE verifier mismatch) would silently break
authentication for every user, not just one feature.

**Independent Test**: Run `npm run coverage` from `web/` before and after — before,
`cognito/client.ts` shows 18% statements; after, it shows ≥90% with session-valid,
session-expired-and-refreshed, session-expired-and-refresh-failed, and malformed-stored-token
paths all exercised.

**Acceptance Scenarios**:

1. **Given** no stored tokens, **When** `getSession()` or `getValidSession()` is called,
   **Then** both return `null` without making a network request.
2. **Given** stored tokens with a future `expires_at`, **When** `getValidSession()` is called,
   **Then** it returns the stored tokens without calling the token-refresh endpoint.
3. **Given** stored tokens with a past `expires_at` and a working refresh endpoint, **When**
   `getValidSession()` is called, **Then** it calls the refresh endpoint, persists the new
   tokens, and returns them.
4. **Given** stored tokens with a past `expires_at` and a refresh endpoint that responds with
   an error, **When** `getValidSession()` is called, **Then** it returns `null` rather than
   throwing.
5. **Given** a `localStorage` value that is not valid JSON, **When** `getTokens()` is called,
   **Then** it returns `null` rather than throwing.
6. **Given** a valid ID token JWT, **When** `getEmailFromIdToken()` is called, **Then** it
   returns the `email` claim; given a malformed token, it returns an empty string rather than
   throwing.
7. **Given** `buildAuthUrl()` is called with and without an `identityProvider` argument,
   **Then** the returned URL always includes a PKCE `code_challenge`/`code_challenge_method`
   and includes `identity_provider` only when one was passed.

---

### Edge Cases

- What happens when `PUT /api/exit-prices` is called for a `coinId` that has no existing row
  and a delete (`exitPrice <= 0`) is requested? The `DELETE` affects zero rows and the
  endpoint still returns 204 (idempotent, not an error).
- What happens when `importData()` receives a file that is not valid JSON at all (parse
  failure, not just a shape mismatch)? `JSON.parse` throws synchronously and the error
  propagates the same as a shape-mismatch rejection — no network call is made either way.
- What happens when `getValidSession()`'s refresh call succeeds (200) but the backend omits
  `refresh_token` in the response body? The existing refresh token is kept (`data.refresh_token
  ?? refreshToken`) — covered by an acceptance scenario in User Story 3.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend test suite MUST cover `PUT /api/exit-prices` for creating a new
  entry, updating an existing entry, and deleting an entry via a zero/negative price.
- **FR-002**: The backend test suite MUST cover `GET /api/exit-prices` and
  `PUT /api/exit-prices` returning 401 when no `Authorization` header is present (already
  partially covered — verify and keep for regression).
- **FR-003**: The backend test suite MUST have a dedicated test module for
  `GET /api/export` asserting the full `BackupPayload` response shape for both a populated
  account and an empty account.
- **FR-004**: The web test suite MUST cover `exportData()` and `importData()` in
  `dataHandlers.ts`, including the malformed-payload rejection path.
- **FR-005**: The web test suite MUST cover `cognito/client.ts`'s session lifecycle: no
  session, valid session, expired session with successful refresh, expired session with
  failed refresh, and malformed stored-token recovery.
- **FR-006**: Every file under `backend/app/routes/` MUST report ≥80% line coverage in
  `pytest --cov=app --cov-report=term-missing`.
- **FR-007**: `dataHandlers.ts` and `cognito/client.ts` MUST report ≥90% statement coverage
  in `npm run coverage` (per CLAUDE.md's ≥90%-on-changed-modules rule, since both files are
  changed by this item).
- **FR-008**: No existing test may be skipped, marked pending, or deleted to reach these
  coverage numbers — all new coverage MUST come from genuine behavioral assertions.
- **FR-009**: This item MUST NOT change any production behavior in the files it touches —
  it adds test files only (or test-supporting fixtures), consistent with PLAN.md's
  "test-only item" framing.

### Key Entities

- **Coverage report**: The `pytest --cov` term-missing table (backend, per-file) and the
  `npm run coverage` v8 table (web, per-file) — the artifacts this item's done-criteria are
  measured against, both pasted into the PR description per CLAUDE.md.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pytest --cov=app --cov-report=term-missing` (run from `backend/`) shows every
  file under `app/routes/` at ≥80% line coverage, with zero test failures.
- **SC-002**: `npm run coverage` (run from `web/`) shows `dataHandlers.ts` and
  `cognito/client.ts` at ≥90% statement coverage, with zero test failures and zero skipped
  tests.
- **SC-003**: `npm test` (web) and `pytest` (backend) both exit 0 with no skipped tests, as
  run today plus the new test files.
- **SC-004**: A reviewer reading the new test files can identify, for each new test, which
  documented behavior (happy path, error path, or edge case) it verifies — no test exists
  solely to inflate a coverage percentage without a corresponding behavioral assertion.

## Assumptions

- PLAN.md Item 14's original file list (written before Items 10-13 landed) named
  `test_exit_prices.py`, `test_prices.py`, `test_export.py`, `test_import.py`,
  `test_coins.py`, and `test_price_history.py` as backend gaps, and `HistoryTab.test.tsx`,
  `ProfitTab.test.tsx`, `WalletTab.test.tsx`, and `portfolio.test.ts` as web gaps. Re-checking
  the actual current coverage report shows `test_prices.py`, `test_import.py`,
  `test_coins.py`, and `test_price_history.py` already exist and their routes already sit at
  90-100% coverage; the three web component test files and `portfolio.test.ts` also already
  exist at 94-100% coverage. This spec targets the gaps that actually exist today
  (`exit_prices.py`'s `PUT` handler, a dedicated `export_data.py` test file, and the
  previously-unlisted `dataHandlers.ts` / `cognito/client.ts`, both at 0-18%) rather than
  re-deriving PLAN.md's now-stale list.
- `app/cognito.py` (36%) and `app/db/postgres_client.py` (72%) are below 80% but are not
  route files and are not modified by this item, so PLAN.md's "every route file ≥80%"
  criterion does not require touching them. They are out of scope for this branch (a future
  item, if pursued, should test them directly rather than as a side effect of a route-focused
  pass).
- `web/src/lib/storage.ts` (61%) and `web/src/lib/api/client.ts` (52%) already have test
  files (`storage.test.ts`, `client.test.ts`) but partial coverage; since CLAUDE.md's ≥90%
  rule applies to *changed* modules and this item does not need to change either file's
  source to close the two identified gaps, they are left as-is rather than expanded
  speculatively. Coverage numbers for these two files should not regress as a side effect of
  this branch, but improving them further is not a done-criterion here.
- No new npm or pip package is required — `pytest-cov` and `vitest`'s `@vitest/coverage-v8`
  are already configured and used by the existing `pytest --cov` / `npm run coverage`
  commands referenced in CLAUDE.md.
- No database schema or migration changes are needed — this item adds tests against existing
  endpoints and existing fixtures (`conftest.py`) only.

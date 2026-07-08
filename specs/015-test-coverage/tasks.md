---

description: "Task list for Test Coverage Gap Closure (PLAN.md Item 14)"
---

# Tasks: Test Coverage Gap Closure

**Input**: Design documents from `/specs/015-test-coverage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: This item's deliverable *is* test files — there is no separate "write tests, then
implement" split. Each user-story phase below writes the test file(s) that close that story's
coverage gap directly.

**Organization**: Tasks are grouped by the four user stories in spec.md, in priority order.
All four stories touch disjoint files, so after the (empty) Foundational phase they can be
worked in any order or in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)
- File paths are exact, relative to repo root

---

## Phase 1: Setup

**Purpose**: One prerequisite fix needed before the CI-gate story (US4) is possible at all —
`pytest-cov` exists in `pyproject.toml`'s `dev` dependency group (used by local `uv run
pytest`) but is missing from `requirements-dev.txt`, which is what CI actually installs from.

- [ ] T001 [P] Add `pytest-cov>=7.1.0` to `backend/requirements-dev.txt`

---

## Phase 2: Foundational

**Purpose**: N/A — each user story's test file(s) are independent of one another (no shared
model, service, or fixture needs to be built first beyond what already exists in
`backend/tests/conftest.py` and `web/vitest.setup.ts`). This phase is intentionally empty.

**Checkpoint**: Setup complete — all four user stories can proceed in any order.

---

## Phase 3: User Story 1 - Every Backend Route File Has Adequate Coverage (Priority: P1) 🎯 MVP

**Goal**: `app/routes/exit_prices.py`'s `PUT` handler (create, update-on-conflict,
delete-via-zero) and `app/routes/export_data.py`'s response shape get dedicated test coverage,
bringing every file under `backend/app/routes/` to ≥80%.

**Independent Test**: `cd backend && pytest --cov=app --cov-report=term-missing` — before,
`exit_prices.py` shows 52% with lines 25-45 uncovered; after, every route file shows ≥80% with
zero test failures.

### Implementation for User Story 1

- [ ] T002 [US1] Create `backend/tests/test_exit_prices.py` with `GET /api/exit-prices`
  scenarios: empty result for a user with no rows, populated result reflecting stored rows,
  and 401 when no `Authorization` header is present (reuse `client_with_db` +
  `@pytest.mark.pgdata`, and a bare `TestClient(app)` for the 401 case, per research.md)
- [ ] T003 [US1] Add `PUT /api/exit-prices` scenarios to
  `backend/tests/test_exit_prices.py`: create (204, `cur.execute` called with the `INSERT ...
  ON CONFLICT` statement), update an existing coin's price (same statement, new value),
  delete via `exitPrice <= 0` (204, `cur.execute` called with the `DELETE FROM exit_prices`
  statement), and 401 when no `Authorization` header is present (depends on T002)
- [ ] T004 [P] [US1] Create `backend/tests/test_export.py` with `GET /api/export` scenarios:
  populated account (two-call `fetchall.side_effect` per research.md, assert the response
  matches `BackupPayload` — `version`, `exportedAt`, full `ops[]` fields, `exitPrices` keyed
  by `coinId`) and empty account (`ops: []`, `exitPrices: {}`, still 200/valid shape, not an
  error)
- [ ] T005 [US1] Run `cd backend && pytest --cov=app --cov-report=term-missing` and confirm
  every file under `app/routes/` reports ≥80% with zero failures (depends on T003, T004)

**Checkpoint**: Backend route coverage gap closed and independently verified — proceed to any
other story.

---

## Phase 4: User Story 2 - Local Data Import/Export Handlers Are Covered (Priority: P2)

**Goal**: `web/src/lib/dataHandlers.ts` (0% coverage today) gets test coverage for both
`exportData()` and `importData()`, including the malformed-payload rejection path.

**Independent Test**: `cd web && npm run coverage` — before, `dataHandlers.ts` shows 0%
statements; after, it shows ≥90% with the valid-file and malformed-file paths both exercised.

### Implementation for User Story 2

- [ ] T006 [P] [US2] Create `web/src/lib/dataHandlers.test.ts` with `exportData()` coverage:
  mock `api.exportBackup` (`vi.mock('./api/client')`) and the DOM download side effects
  (`URL.createObjectURL`, `URL.revokeObjectURL`, `HTMLAnchorElement.click`, per research.md),
  assert a `.json`-named anchor is created and clicked with the serialized backup content
- [ ] T007 [US2] Add `importData()` coverage to `web/src/lib/dataHandlers.test.ts`: a file
  with a valid `ops` array calls `api.importBackup` with the parsed payload and runs
  `onSuccess` afterward; a file whose parsed JSON has no `ops` array (missing key, wrong type,
  or invalid JSON) throws before any network call and `onSuccess` is never invoked (depends
  on T006)

**Checkpoint**: `dataHandlers.ts` coverage gap closed and independently verified.

---

## Phase 5: User Story 3 - Browser Auth/Session Client Is Covered (Priority: P2)

**Goal**: `web/src/lib/cognito/client.ts` (18% coverage today) gets test coverage for its
full session lifecycle — the module every authenticated API call depends on.

**Independent Test**: `cd web && npm run coverage` — before, `cognito/client.ts` shows 18%
statements; after, it shows ≥90% with session-valid, session-expired-and-refreshed,
session-expired-and-refresh-failed, and malformed-stored-token paths all exercised.

### Implementation for User Story 3

- [ ] T008 [P] [US3] Create `web/src/lib/cognito/client.test.ts` with baseline scenarios: no
  stored tokens → `getSession()`/`getValidSession()` both return `null` without a network
  call; `getEmailFromIdToken()` returns the `email` claim for a valid JWT and `''` for a
  malformed one; `buildAuthUrl()` always includes `code_challenge`/`code_challenge_method`
  and includes `identity_provider` only when passed (mock `fetch` and use real jsdom
  `localStorage`/`sessionStorage` cleared in `beforeEach`, per research.md)
- [ ] T009 [US3] Add session-refresh and malformed-storage scenarios to
  `web/src/lib/cognito/client.test.ts`: stored tokens with a future `expires_at` return
  without calling the refresh endpoint; stored tokens with a past `expires_at` call the
  refresh endpoint, persist the new tokens (keeping the old `refresh_token` if the response
  omits one), and return them; a refresh-endpoint error causes `getValidSession()` to return
  `null` rather than throw; non-JSON `localStorage` content causes `getTokens()` to return
  `null` rather than throw (depends on T008)

**Checkpoint**: `cognito/client.ts` coverage gap closed and independently verified.

---

## Phase 6: User Story 4 - CI Enforces the Coverage Bar Going Forward (Priority: P2)

**Goal**: Both GitHub Actions workflows fail when backend coverage drops below 80% or when
`dataHandlers.ts`/`cognito/client.ts` coverage drops below 90%, per the clarify-session
decision recorded in spec.md.

**Independent Test**: Temporarily remove a test from `test_exit_prices.py` (or
`dataHandlers.test.ts`), push, and confirm the CI test step fails on the coverage gate — not
just a missing/failing test. Revert before merging (see quickstart.md).

### Implementation for User Story 4

- [ ] T010 [US4] Change the backend test step in `.github/workflows/pr.yml` and
  `.github/workflows/deploy.yml` from `run: pytest` to
  `run: pytest --cov=app --cov-fail-under=80` (depends on T001)
- [ ] T011 [P] [US4] Add a `coverage.thresholds` block to `web/vitest.config.ts` scoping 90%
  statement/branch/function/line thresholds to `src/lib/dataHandlers.ts` and
  `src/lib/cognito/client.ts` only (per research.md — not a global threshold, since several
  other web files are intentionally below 90% and out of this item's scope)
- [ ] T012 [US4] Change the web test step in `.github/workflows/pr.yml` and
  `.github/workflows/deploy.yml` from `run: npm test` to `run: npm run coverage` (depends on
  T011)
- [ ] T013 [US4] Manually verify both gates fail on regression per quickstart.md's "CI gate
  regression check" (temporarily weaken a test, confirm the gated command exits non-zero,
  revert) (depends on T005, T007, T009, T010, T012)

**Checkpoint**: Coverage bar is enforced going forward, not just measured once.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and PR-readiness per CLAUDE.md's test rules.

- [ ] T014 Run `cd backend && pytest` and `cd web && npm test`; confirm zero failures and zero
  skipped tests (SC-003)
- [ ] T015 [P] Capture the `pytest --cov=app --cov-report=term-missing` summary table for the
  PR description
- [ ] T016 [P] Capture the `npm run coverage` summary table for the PR description
- [ ] T017 Run through `quickstart.md` end-to-end as a final check before opening the PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Empty — no blocking prerequisites beyond Setup
- **User Stories (Phase 3-6)**: US1-US3 depend only on Setup being complete and can run in any
  order/in parallel (disjoint files). US4 depends on T001 (Setup) directly and on US1-US3's
  test files existing before T013's regression check can exercise them meaningfully — but
  T010-T012 (the CI config edits themselves) only need T001.
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Parallel Opportunities

- T001 (Setup) has no dependencies
- T002/T004 (US1), T006 (US2), T008 (US3), T011 (US4) can all start in parallel once Setup
  completes — each is the first task touching a distinct new file
- T015/T016 (Polish) can run in parallel with each other once T014 passes

---

## Parallel Example: Kicking off all four stories after Setup

```bash
# Once T001 is done, these can proceed in parallel (different files):
Task: "Create backend/tests/test_exit_prices.py with GET scenarios"          # T002 (US1)
Task: "Create backend/tests/test_export.py with BackupPayload scenarios"     # T004 (US1)
Task: "Create web/src/lib/dataHandlers.test.ts with exportData() coverage"   # T006 (US2)
Task: "Create web/src/lib/cognito/client.test.ts with baseline scenarios"    # T008 (US3)
Task: "Add coverage.thresholds to web/vitest.config.ts"                      # T011 (US4)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002-T005) — this alone satisfies PLAN.md's literal
   "≥80% on every route file" done-criterion and is independently mergeable/demonstrable
3. **STOP and VALIDATE**: `pytest --cov=app --cov-report=term-missing` shows every route file
   ≥80%

### Incremental Delivery

1. Setup → US1 (backend route coverage, the highest-risk gap) → US2 (data handlers) → US3
   (auth client) → US4 (CI gate, ties it all together) → Polish
2. Each story is independently testable and does not block the others — build in priority
   order, but reorder freely if convenient (e.g. build US4's Vitest config alongside US2/US3
   since they touch adjacent areas)

---

## Notes

- No task in this item modifies application/production source behavior (constitution
  Principle IV, spec.md FR-009) — every task above touches a test file, a dependency
  manifest, or CI/coverage configuration only.
- Commit after each checkpoint (end of each phase), not after every individual task, to keep
  the branch's history readable per CLAUDE.md's PR-scope conventions.
- `backend/app/cognito.py` and `backend/app/db/postgres_client.py` remain below 80%/90% after
  this item completes — this is intentional (see spec.md Assumptions); no task exists to
  raise their coverage, since they are not route files and are not modified here.

---
description: "Task list for Security Hardening implementation"
---

# Tasks: Security Hardening

**Input**: Design documents from `specs/002-security-audit/`

**Branch**: `chore/security-audit`

**Note**: Most code changes are already on the branch. Tasks below represent the remaining
work to reach a passing CI state plus the missing FR-011 startup validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story from spec.md (US1–US4)

---

## Phase 1: Setup

**Purpose**: No new project structure needed — monorepo already structured.
All existing branch changes (CORS in main.py, CI steps, ESLint config, nosec on SELECT/RETURNING,
AGENTS.md) are in place. This phase confirms the branch baseline before story work begins.

- [ ] T001 Read specs/002-security-audit/plan.md and research.md in full before starting any task

**Checkpoint**: Branch baseline understood — story phases can begin.

---

## Phase 2: Foundational (No blocking prerequisites)

All user stories are independent. No shared infrastructure changes are required.
Proceed directly to story phases in priority order.

---

## Phase 3: User Story 1 — CORS Restricted to Known Origin (Priority: P1) 🎯 MVP

**Goal**: The API refuses cross-origin requests from unknown origins; fails at startup
with a clear error if `FRONTEND_ORIGIN` is missing or malformed (FR-001–003, FR-011).

**Independent Test**: Start the API without `FRONTEND_ORIGIN` set (but default removed) and
confirm a `ValidationError` is raised at startup. Then start it with a valid origin and send
a preflight from an unknown origin — confirm no `Access-Control-Allow-Origin` header is returned.

### Implementation for User Story 1

- [ ] T002 [US1] Add `@field_validator('frontend_origin', mode='before')` to `backend/app/config.py` per research.md Decision 1; validator must strip whitespace, reject empty string, reject missing scheme, reject trailing slash
- [ ] T003 [P] [US1] Add `backend/tests/test_config.py` with unit tests covering: valid origin passes, empty string raises, missing scheme raises, trailing slash raises, whitespace-wrapped origin is stripped and passes
- [ ] T004 [P] [US1] Add `backend/tests/test_cors.py` with two tests: (1) preflight from an unknown origin (e.g. `http://evil.com`) does NOT receive an `Access-Control-Allow-Origin` header; (2) preflight from the configured origin DOES receive the correct `Access-Control-Allow-Origin` header — covers US1 acceptance scenarios 2 and 3 (FR-001, SC-003)

**Checkpoint**: `Settings(frontend_origin='https://example.com')` passes; `Settings(frontend_origin='example.com')` raises `ValidationError`. CORS preflight from unknown origin is rejected. Existing `pytest` suite still green.

---

## Phase 4: User Story 2 — Backend CI Scanning (Priority: P1)

**Goal**: Every CI run scans the backend Python source with bandit and checks dependencies
with pip-audit; findings at MEDIUM or HIGH severity block the pipeline (FR-004–005, FR-008).

**Independent Test**: Run `cd backend && bandit -r app/ -ll` locally — must exit 0.
Run `cd backend && pip-audit` locally — must exit 0 or list accepted CVEs in PR description.

### Implementation for User Story 2

- [ ] T005 [US2] Add `# nosec B608` comment to `backend/app/routes/ops.py` line 47 (`f"INSERT INTO ops ..."`) and line 67 (`f"UPDATE ops SET ..."`) per research.md Decision 2
- [ ] T006 [P] [US2] Run `cd backend && bandit -r app/ -ll` and confirm exit 0; if new findings appear, either fix the code or add a justified nosec comment and list the suppression in the PR description
- [ ] T007 [P] [US2] Run `cd backend && pip-audit` and confirm exit 0; if any high/medium CVEs are reported with no fix available, list each CVE ID and justification in the PR description per FR-010

**Checkpoint**: `bandit -r app/ -ll` exits 0. `pip-audit` exits 0 (or accepted CVEs documented).

---

## Phase 5: User Story 3 — Frontend CI Scanning (Priority: P1)

**Goal**: Every CI run runs `eslint-plugin-security` on frontend source and checks npm
dependencies with `npm audit`; high-severity findings block the pipeline (FR-006–007).

**Independent Test**: Run `cd web && npm run lint` locally — must exit 0 with no errors.
Run `cd web && npm audit --audit-level=high` locally — must exit 0.

### Implementation for User Story 3

- [ ] T008 [US3] Add `.next/**` to the `ignores` array in `web/eslint.config.mjs` per research.md Decision 3; the `.next/` directory is a stale Next.js build artefact causing hundreds of false-positive findings
- [ ] T009 [P] [US3] Run `cd web && npm run lint` and confirm exit 0 with no errors (warnings on third-party code are acceptable)
- [ ] T010 [P] [US3] Run `cd web && npm audit --audit-level=high` and confirm exit 0; if any high CVEs are reported with no fix available, list each CVE ID and justification in the PR description per FR-010

**Checkpoint**: `npm run lint` exits 0. `npm audit --audit-level=high` exits 0 (or accepted CVEs documented).

---

## Phase 6: User Story 4 — Token Storage Risk Documented (Priority: P2)

**Goal**: `backend/AGENTS.md` contains a section explaining the localStorage token storage
risk so future contributors understand the threat model and constraints (FR-009).

**Independent Test**: Read `backend/AGENTS.md` and confirm the section covers: (1) the XSS
threat model, (2) existing mitigations (`eval`/`innerHTML` prohibition enforced by ESLint),
(3) guidance that adding `eval()` or unsafe HTML would remove the mitigation.

### Implementation for User Story 4

- [ ] T011 [US4] Verify `backend/AGENTS.md` "Token storage accepted risk" section covers the XSS threat model, current mitigations enforced by ESLint in CI, and guidance for future contributors; update the section if any of these three elements is missing or incomplete
- [ ] T012 [US4] Enumerate all `# nosec B608` suppressions (currently: `ops.py:33`, `ops.py:47`, `ops.py:49`, `ops.py:67`, `ops.py:70`, `export_data.py:18`) and add them to the PR description per SC-004

**Checkpoint**: A developer unfamiliar with the codebase can find the token storage risk
section in `backend/AGENTS.md` and understand the accepted risk within 30 seconds (SC-005).
All nosec suppressions enumerated for reviewer audit (SC-004).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full test runs and final tool verification before opening the PR.

- [ ] T013 [P] Run `cd backend && pytest` and confirm all tests pass with ≥90% coverage on all changed modules (`app/config.py`, `app/main.py`, `app/routes/ops.py`); paste the coverage summary output in the PR description
- [ ] T014 [P] Run `cd web && npm test` and confirm all tests pass; paste the coverage summary in the PR description
- [ ] T015 Verify the CI pipeline definition in `.github/workflows/deploy.yml` contains all four security steps: `bandit -r app/ -ll`, `pip-audit`, `npm run lint`, `npm audit --audit-level=high` in the correct order (after `pytest` / `npm test`)

**Checkpoint**: All tasks complete — branch ready for PR review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately
- **Phase 2** (Foundational): Skipped — no shared infrastructure
- **Phases 3–6** (User Stories): Independent — can proceed in any order
- **Phase 7** (Polish): Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories
- **US2 (P1)**: No dependencies on other stories
- **US3 (P1)**: No dependencies on other stories
- **US4 (P2)**: No dependencies on other stories

### Within Each User Story

- US1: T002 (validator code) must complete before T003 (tests validate T002); T004 [P] is independent (different file, tests pre-existing CORS middleware)
- US2: T005 (add nosec) must complete before T006 (bandit run will fail without it)
- US3: T008 (ESLint ignore) must complete before T009 (lint run will fail without it)
- US4: T011 and T012 are standalone

### Parallel Opportunities

T003 and T004 can run in parallel (different test files, T004 tests already-merged CORS code).
T006 and T007 can run in parallel (different tools, same backend).
T009 and T010 can run in parallel (different tools, same web package).
T013 and T014 can run in parallel (different projects).
Phase 3, 4, 5, 6 can all start simultaneously if working with multiple agents.

---

## Parallel Example: US2 + US3 (simultaneously)

```text
# After T005 completes:
Parallel: T006 "Run bandit -r app/ -ll" AND T007 "Run pip-audit"

# After T008 completes:
Parallel: T009 "Run npm run lint" AND T010 "Run npm audit --audit-level=high"

# Final parallel:
Parallel: T013 "Run pytest" AND T014 "Run npm test"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete T001 (read plan)
2. Complete T002, T003, T004 (FR-011 validator + tests + CORS test)
3. **STOP and VALIDATE**: `pytest` passes; `Settings` fails fast on bad origin; CORS rejects unknown origins
4. Continue to US2, US3, US4 in order

### Full Delivery Order

1. T001 → T002 → T003 + T004 (US1: CORS complete)
2. T005 → T006 + T007 (US2: bandit + pip-audit clean)
3. T008 → T009 + T010 (US3: ESLint + npm audit clean)
4. T011 + T012 (US4: docs verified + suppressions enumerated)
5. T013 + T014 → T015 (Polish: all tests pass, CI verified)
6. Open PR with: coverage summary, list of all nosec suppressions, any accepted CVEs

---

## Notes

- `[P]` tasks = different files or independent tool runs — safe to parallelize
- Each story has an Independent Test — verify it manually before marking the story done
- The `# nosec B608` suppressions must be individually listed in the PR description per SC-004 (see T012)
- If `pip-audit` or `npm audit` find CVEs with no fix, document them per FR-010 before opening the PR
- `backend/tests/test_config.py` may need to use `monkeypatch` or direct `Settings(...)` construction to test the validator without loading `.env`
- `backend/tests/test_cors.py` should use FastAPI's `TestClient` and set `FRONTEND_ORIGIN` via monkeypatch or test settings override

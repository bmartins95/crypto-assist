# Implementation Plan: Test Coverage Gap Closure

**Branch**: `test/coverage` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-test-coverage/spec.md`

## Summary

Close the two real backend coverage gaps (`exit_prices.py`'s `PUT` handler at 52%, and
`export_data.py` lacking a dedicated shape-assertion test despite incidental 90%) and the two
real web coverage gaps (`dataHandlers.ts` at 0%, `cognito/client.ts` at 18%) surfaced by
re-running `pytest --cov` and `npm run coverage` against the current codebase — not PLAN.md
Item 14's original (now partially stale) file list, most of which already has 90-100%
coverage. Per the clarify session, also wire a coverage gate into both GitHub Actions
workflows (`pr.yml`, `deploy.yml`) so the bar this item establishes is enforced going forward,
not just measured once.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5 / Node 20 (web)

**Primary Dependencies**: pytest + pytest-cov (backend, already a `dev` dependency-group
member in `pyproject.toml` but **missing from `requirements-dev.txt`**, which is what CI's
`pip install -r requirements-dev.txt` actually installs — this gap must be fixed for a CI
coverage gate to be possible at all); Vitest + `@vitest/coverage-v8` (web, already wired via
`npm run coverage`) + Testing Library

**Storage**: N/A — no schema or migration changes; reuses the existing mocked-psycopg
fixtures in `backend/tests/conftest.py`

**Testing**: This item's deliverable *is* the test suite — `pytest` (backend) and `vitest`
(web), run via `pytest --cov=app --cov-report=term-missing` and `npm run coverage`

**Target Platform**: AWS Lambda (backend) / CloudFront-served SPA (web) — unchanged; this item
touches no deployed runtime behavior, only test files and CI configuration

**Project Type**: Web application monorepo (existing `backend/` + `web/` + `shared/`
structure) — no new project or package

**Performance Goals**: N/A

**Constraints**: No application source behavior may change (FR-009). Migrations remain
additive-only and unused here (no migration needed). CI runtime should not meaningfully
increase — `--cov-fail-under` and Vitest coverage thresholds add negligible overhead to an
already-running test command.

**Scale/Scope**: 2 new backend test files (`test_exit_prices.py`, `test_export.py`) covering
~9 acceptance scenarios; 2 new web test files (`dataHandlers.test.ts`,
`lib/cognito/client.test.ts`) covering ~10 acceptance scenarios; 4 config files touched for
the CI gate (`backend/requirements-dev.txt`, `pr.yml`, `deploy.yml`, `web/vitest.config.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — N/A. This item touches `backend/` and `web/` test/CI
  files only; no `shared/` types or cross-package logic are added or changed. PASS.
- **II. Security at the Boundary** — N/A for new production code (none is added). The new
  `cognito/client.ts` tests exercise the existing auth boundary's failure paths (expired
  session, malformed stored token, failed refresh) without weakening it. PASS.
- **III. Behavior Coverage Over Line Coverage** — This is the principle this entire item
  exists to advance. Every new test in spec.md's acceptance scenarios asserts a specific
  documented behavior (not just line execution), matching this principle's letter and intent.
  PASS.
- **IV. No Speculative Code** — No abstractions, helper functions, or new packages are
  introduced. `pytest-cov` and `@vitest/coverage-v8` are already project dependencies (the
  former just needs to move into the CI-installed requirements file); no new npm/pip package
  is added. PASS.
- **V. Accessibility and Internationalisation** — N/A. No UI or user-facing strings are added
  or changed. PASS.

No violations. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/015-test-coverage/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
backend/
├── requirements-dev.txt        # add pytest-cov (present in pyproject.toml dev group,
│                                # missing here — CI installs from this file, not uv)
├── app/
│   └── routes/
│       ├── exit_prices.py      # unchanged — PUT handler already correct, just untested
│       └── export_data.py      # unchanged
└── tests/
    ├── conftest.py              # existing fixtures reused (client_with_db, no_auth_client)
    ├── test_exit_prices.py      # NEW — PUT create/update/delete-via-zero, 401s
    └── test_export.py           # NEW — BackupPayload shape, populated + empty account

web/
├── vitest.config.ts             # add per-file coverage thresholds for the two gap files
└── src/lib/
    ├── dataHandlers.ts          # unchanged
    ├── dataHandlers.test.ts     # NEW — exportData download trigger, importData valid/invalid
    └── cognito/
        ├── client.ts            # unchanged
        └── client.test.ts       # NEW — session lifecycle, refresh, malformed-token recovery

.github/workflows/
├── pr.yml                       # pytest → pytest --cov=app --cov-fail-under=80;
│                                 # npm test → npm run coverage
└── deploy.yml                   # same two changes, kept identical to pr.yml per existing
                                  # convention (both files currently mirror each other)
```

**Structure Decision**: Existing monorepo layout (`backend/`, `web/`, `shared/`) is unchanged.
This item adds test files in the existing `backend/tests/` and `web/src/lib/` directories
(matching the established one-test-file-per-source-file convention already used throughout
both suites) plus small, additive edits to two CI workflow files, one dependency manifest, and
one Vitest config file. No new directories, no new packages, no `shared/` changes.

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*

# Implementation Plan: Security Hardening

**Branch**: `chore/security-audit` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-security-audit/spec.md`

## Summary

Harden the Crypto Assist stack by: restricting CORS to the configured frontend origin (FR-001–003, FR-011), adding static analysis (bandit) and dependency scanning (pip-audit, npm audit) to CI (FR-004–007), suppressing confirmed-false-positive bandit B608 findings (FR-008), and documenting the accepted Amplify localStorage token storage risk (FR-009). The implementation is split across backend config, backend CI tooling, frontend CI tooling, and documentation. No schema changes, no new API endpoints.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x (web)

**Primary Dependencies**: FastAPI + pydantic-settings v2 (backend), Vite + React 19 + ESLint v9 (web)

**Storage**: N/A — no schema changes

**Testing**: pytest (backend), Vitest + Testing Library (web)

**Target Platform**: AWS Lambda / CloudFront; GitHub Actions CI

**Project Type**: web-service (backend) + SPA (web)

**Performance Goals**: N/A — tooling only

**Constraints**: bandit -ll exits 0; pip-audit exits 0; eslint exits 0; npm audit --audit-level=high exits 0; `FRONTEND_ORIGIN` validated at startup

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared-First Architecture | ✅ Pass | No shared/ changes; no cross-package imports added |
| II. Security at the Boundary | ✅ Pass | This plan item directly implements the principle: CORS restricted, eval/innerHTML prohibited via ESLint |
| III. Behavior Coverage Over Line Coverage | ✅ Pass | FR-011 validator is a pure function — must have a unit test covering valid origin, missing scheme, trailing slash, and whitespace |
| IV. No Speculative Code | ✅ Pass | All changes scoped to exactly what FR-001–011 require |
| V. Accessibility & i18n | ✅ Pass | No UI changes |

**Pre-Phase-0 gate**: PASSED — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-security-audit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output — running security tools locally
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

No `data-model.md` or `contracts/` — this feature has no schema changes and no new API endpoints.

### Source Code (affected files)

```text
backend/
├── app/
│   ├── config.py            # FR-011: add field_validator for frontend_origin
│   ├── main.py              # FR-001–002: CORS restricted (already done)
│   └── routes/
│       ├── ops.py           # FR-008: nosec B608 on all f-string SQL lines
│       └── export_data.py   # FR-008: nosec B608 (already done)
├── requirements-dev.txt     # bandit + pip-audit (already done)
└── AGENTS.md                # FR-009: token storage risk (already done)

web/
├── eslint.config.mjs        # FR-006: security plugin + fix .next/** ignore
├── package.json             # eslint-plugin-security + typescript-eslint (already done)
└── src/                     # no changes needed (src/ passes lint clean)

.github/
└── workflows/
    └── deploy.yml           # FR-004–007: bandit, pip-audit, lint, audit (already done)
```

## Implementation Tasks

### T1 — FR-011: Startup validation of `FRONTEND_ORIGIN` [NOT DONE]

Add a `@field_validator('frontend_origin')` to `backend/app/config.py`.
Must reject: empty string, missing scheme (`http://`/`https://`), trailing slash, surrounding whitespace.
Must include a unit test in `backend/tests/` covering each rejection case and the happy path.

### T2 — FR-008: Add nosec to all f-string SQL lines in ops.py [NOT DONE]

Lines 47 (`INSERT`) and 67 (`UPDATE`) in `backend/app/routes/ops.py` are f-strings beginning
with SQL keywords. Add `# nosec B608` to those lines as a preventive measure.
Lines 33/49/70 already have nosec; lines 18 in export_data.py already has nosec.

### T3 — ESLint: Add `.next/**` to ignores [NOT DONE]

`web/eslint.config.mjs` ignores `dist/**` but not `.next/**`. The stale `.next/` directory
from the previous Next.js setup causes hundreds of false-positive findings when `eslint` runs
without a path argument. Add `.next/**` to the `ignores` array.

### T4 — Verify all CI tools pass [NOT DONE]

After T1–T3, run each tool locally and confirm:
- `cd backend && bandit -r app/ -ll` exits 0
- `cd backend && pip-audit` exits 0 (or document any unfixable CVEs in research.md)
- `cd web && npm run lint` exits 0
- `cd web && npm audit --audit-level=high` exits 0

### T5 — Verify existing tests still pass [NOT DONE]

Run `cd backend && pytest` and `cd web && npm test`. Fix any regressions introduced by
the pydantic validator (test fixtures that construct `Settings()` without `FRONTEND_ORIGIN`
will now fail if the default is still valid but the validator rejects it).

## Already-Implemented Changes

These diffs are on the branch but not yet committed:

| File | Change | FR |
|------|--------|----|
| `backend/app/main.py` | `allow_origins=[get_settings().frontend_origin]` | FR-001–002 |
| `backend/app/config.py` | `frontend_origin` field with default | FR-003 |
| `backend/requirements-dev.txt` | bandit + pip-audit | FR-004–005 |
| `.github/workflows/deploy.yml` | bandit, pip-audit, npm lint, npm audit steps | FR-004–007 |
| `web/eslint.config.mjs` | typescript-eslint + eslint-plugin-security flat config | FR-006 |
| `web/package.json` | eslint-plugin-security, typescript-eslint devDeps | FR-006 |
| `backend/app/routes/ops.py` | nosec B608 on SELECT/RETURNING lines | FR-008 (partial) |
| `backend/app/routes/export_data.py` | nosec B608 on SELECT line | FR-008 |
| `backend/AGENTS.md` | token storage risk section | FR-009 |
| `web/src/components/WalletTab.tsx` | removed unused `storage` import | lint clean-up |

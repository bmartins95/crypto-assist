# Implementation Plan: Position Closing, Leverage, and History Day-Grouping

**Branch**: `feat/position-closing` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-position-closing/spec.md`

## Summary

Give every buy/sell operation an explicit, user-driven open/partial/closed status derived from an
explicit many-to-many "closure link" a user creates by clicking a "close" action on a History row.
Add an optional leverage multiplier (2x/3x/5x/10x) to any brand-new, non-closing buy or sell. Redesign
the History view to show day-grouped operations, a status chip per row, the close action, an animated
Buy/Sell/Trade type toggle in the operation drawer, and a realized profit/loss figure wherever a
closure link exists. Backend: an additive migration (`ops.leverage`, new `op_closures` table) plus a
new `POST /api/ops/{id}/close` endpoint that creates the counter-operation, allocates the closure
across the user's oldest open operations of the same asset/platform/currency, and freezes the
realized P/L at creation time. Frontend: `shared/src/positions.ts` for status/remaining-qty/estimate
derivation, and `HistoryTab.tsx` / `OpDrawer.tsx` changes for day-grouping, status chips, the close
action, the animated tab switch, and the P/L displays.

## Technical Context

**Language/Version**: TypeScript (web/shared, Node-less, no build step for `shared/`), Python 3.12 (backend)

**Primary Dependencies**: FastAPI + Mangum (backend), Vite + React + TanStack Router (web), pure TS (shared) — all fixed by the constitution; no new dependency is needed for this feature

**Storage**: AWS RDS Aurora (PostgreSQL) via `backend/app/db/postgres_client.py`; additive migration only

**Testing**: `pytest` (backend, `cd backend && pytest`), Vitest + Testing Library (web, `cd web && npm test`)

**Target Platform**: AWS Lambda (backend, via SST), browser SPA (web); mobile has no History screen and is unaffected beyond the shared type contract

**Project Type**: Web application (existing `backend/` + `web/` + `shared/` monorepo, no new project)

**Performance Goals**: No new performance target beyond the existing per-request Lambda budget; a close is a single transactional write, not a bulk/batch operation

**Constraints**: Additive-only migrations (constitution + `docs/PLAN.md` database rules); no new npm/pip package; `shared/` changes must not break the mobile type contract even though mobile has no consuming UI yet

**Scale/Scope**: Single-user-scoped queries (`WHERE user_id = %s`, existing pattern); closure allocation walks at most a user's own open operations for one asset+platform+currency, not a cross-user or bulk operation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture**: New cross-package logic (`computeOpStatus`, `openQtyRemaining`,
  `estimateClosePnl`, the `OpClosure` type, the `leverage` field) lands in `shared/src/` (a new
  `shared/src/positions.ts` plus additions to `shared/src/types.ts`), exported from
  `shared/src/index.ts`. `web/` consumes it; mobile is unaffected but must still build. **PASS**.
- **II. Security at the Boundary**: The new `POST /api/ops/{id}/close` endpoint validates the request
  body, is auth-gated and scoped to `user_id` exactly like existing `ops.py` routes, and rejects
  cross-platform/cross-currency/over-quantity closes server-side rather than trusting client input.
  **PASS**.
- **III. Behavior Coverage Over Line Coverage**: Plan includes explicit test tasks for the happy path
  (full close, partial close), primary error paths (over-close rejected, cross-platform/currency
  rejected, missing auth), and the edge cases named in the spec (multi-lot allocation, deleting an
  operation with closures, editing a closed operation). **PASS** (enforced in Tasks phase).
- **IV. No Speculative Code**: No new abstraction beyond what the spec requires — one new backend
  route, one new shared module, no new generic "linking" framework for entities other than ops. The
  existing `platform`-style legacy-column pattern (additive column, old column untouched) is reused
  rather than inventing a new migration style. **PASS**.
- **V. Accessibility and Internationalisation**: New UI (status chips, close action, leverage chips,
  day-group headers, P/L captions) goes through `useLocale()`/`UIText` for every string, and the close
  icon button gets an `aria-label` (it is not a `<button>` with visible text in the design reference).
  **PASS** (enforced in Tasks phase).

No violations requiring the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```text
specs/023-position-closing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── close-endpoint.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── db/
│   └── migrations/
│       └── 0NN_add_leverage_and_op_closures.sql   # new, additive
├── app/
│   ├── models.py                 # + leverage, OpClosure
│   └── routes/
│       ├── ops.py                 # existing CRUD; expose closures for status derivation
│       └── op_closures.py         # new: POST /api/ops/{id}/close
└── tests/
    └── test_op_closures.py        # new

shared/
└── src/
    ├── types.ts        # + leverage on NewOp/Op, + OpClosure
    ├── positions.ts    # new: computeOpStatus, openQtyRemaining, estimateClosePnl
    ├── positions.test.ts
    ├── i18n/
    │   ├── types.ts    # + history_status_*, history_action_close, op_leverage_label, ...
    │   └── locales/*.ts
    └── index.ts        # + new exports

web/
└── src/
    ├── components/
    │   ├── HistoryTab.tsx        # day-grouping, status chips, close action
    │   ├── HistoryTab.test.tsx
    │   ├── OpDrawer.tsx           # closingOp prop, animated tabs, leverage chips, P/L preview
    │   └── OpDrawer.test.tsx
    ├── lib/api/client.ts          # + closeOp(...)
    └── app/globals.css            # day-group, status chip, slide-transition, leverage chip styles
```

**Structure Decision**: Existing monorepo layout (`backend/` + `shared/` + `web/`), no new top-level
project. Backend gets one new route module and one migration; shared gets one new module plus
additions to existing type/i18n files; web modifies the two existing History/Drawer components — no
new components are introduced beyond what the spec requires (status chips and leverage chips are
rendered inline, not extracted into new components, since each has exactly one call site today).

## Complexity Tracking

*No violations — table omitted.*

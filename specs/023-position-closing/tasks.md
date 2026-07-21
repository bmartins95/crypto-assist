# Tasks: Position Closing, Leverage, and History Day-Grouping

**Input**: Design documents from `/specs/023-position-closing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/close-endpoint.md, quickstart.md

**Tests**: Included — this repo's constitution (Behavior Coverage Over Line Coverage) requires an
explicit test for the happy path, primary error paths, and documented edge cases for every changed
module; tests are not optional here.

**Note**: This task list was revised after `/speckit-analyze` found 3 CRITICAL + 1 HIGH coverage gaps
(delete/edit interaction with closure links had no task; aria-label wasn't propagated from plan.md's
own Constitution Check into task descriptions; Trade-mode closing's two-endpoint submit flow had no
task). All four are folded into T002, T009, T018, T019, T023 below.

**Corrections learned during implementation**:
- T026's animated tab switch was simplified from a JS `out`→`in`→`settled` timed state machine (which
  would have delayed the actual `opType` state change and broken ~15 existing OpDrawer tests that
  assert on the new fieldset immediately after a tab click) to a CSS-only approach: the type-panel
  wrapper is keyed on `opType`, so React remounts it on every switch and a `type-panel-in` keyframe
  animation plays automatically, with zero delay to the actual state change. The "ignore clicks
  mid-animation" behavior from the design mock's JS timer was dropped as inapplicable — there is no
  longer a real window to protect against, since the switch is instant and the animation is purely
  decorative.
- T034 (quickstart walkthrough) was not run against a live Postgres — Docker Desktop was not running
  in this environment. In its place: `npm run build` (web) succeeded cleanly, the full `pytest` (189
  tests) and `vitest` (567 tests) suites pass, and `bandit -ll` found no issues on the changed backend
  files. A live end-to-end walkthrough is still recommended before merging.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps to spec.md's User Story 1–5

---

## Phase 1: Setup

- [X] T001 Confirm local dev environment is up (`backend/AGENTS.md`'s Docker Postgres + `uvicorn`, `web && npm run dev`) so migration 012 applies automatically on first backend connection

---

## Phase 2: Foundational (blocking prerequisites for all user stories)

**⚠️ CRITICAL**: No user story task may start until this phase is complete.

- [X] T002 [P] Add migration `backend/db/migrations/012_leverage_and_op_closures.sql`: `ALTER TABLE ops ADD COLUMN leverage SMALLINT`; new table `op_closures` (`id`, `source_op_id` FK `ON DELETE CASCADE`, `closing_op_id` FK `ON DELETE CASCADE`, `qty_closed`, `realized_pnl`, `created_at`) with indexes on both FK columns — per data-model.md (cascade delete is deliberate: see data-model.md's "Delete and edit interactions" section and research.md)
- [X] T003 [P] Add `leverage: int | None` to `NewOp`/`Op` in `backend/app/models.py`; add an `OpClosure` model (`id`, `sourceOpId`, `closingOpId`, `qtyClosed`, `realizedPnl`); validate `leverage` is one of `{2, 3, 5, 10}` or `None`
- [X] T004 [P] Add `leverage?: number` to `NewOp`/`Op` and a new `OpClosure` interface in `shared/src/types.ts`; export both from `shared/src/index.ts`
- [X] T005 [US-shared] Create `shared/src/positions.ts` exporting `computeOpStatus(op, closures)`, `openQtyRemaining(op, closures)`, `estimateClosePnl(sourceOp, closingOp, qty)` per data-model.md's derivation rules; export from `shared/src/index.ts` (depends on T004)
- [X] T006 [P] Add new i18n keys to `shared/src/i18n/types.ts` and all 10 locale files under `shared/src/i18n/locales/`: `history_col_status`, `history_col_pnl`, `history_status_open`, `history_status_partial`, `history_status_closed`, `history_action_close`, `history_closing_banner`, `history_pnl_estimated`, `op_leverage_label` (`history_pnl_none`/`history_group_date` turned out unneeded — the "no P/L" placeholder reuses the existing bare em-dash convention, and the day header just renders the already-localized date)
- [X] T007 [P] Add `closeOp(sourceOpId, body)` and `getOpClosures()` to `web/src/lib/api/client.ts`, matching contracts/close-endpoint.md's request/response shapes

**Checkpoint**: Data model, shared derivation logic, and API client are in place — user story work can begin.

---

## Phase 3: User Story 1 - Close an open position, fully or partially (Priority: P1) 🎯 MVP

- [X] T008 [P] [US1] `backend/tests/test_op_closures.py`
- [X] T009 [P] [US1] Extend `backend/tests/test_ops.py` (cascade-delete regression + edit-block 409, plus leverage create tests)
- [X] T010 [P] [US1] `web/src/lib/positions.test.ts` (placed here per this repo's actual Vitest coverage root — see note below)
- [X] T011 [P] [US1] `web/src/components/OpDrawer.test.tsx` closing/Trade-close tests
- [X] T012 [P] [US1] `web/src/components/HistoryTab.test.tsx` close-action tests
- [X] T013 [US1] `backend/app/routes/op_closures.py`
- [X] T014 [US1] `backend/app/routes/ops.py` edit-block (409) via `NOT EXISTS` guard in the `UPDATE`
- [X] T015 [US1] Registered `op_closures.router` / `op_closures.closures_router` in `backend/app/main.py`
- [X] T016 [US1] `web/src/components/AppLayout.tsx` fetches/exposes `closures` + `closeOp`
- [X] T017 [US1] `web/src/router.tsx` threads `closures`/`onCloseOp` into `HistoryTab`
- [X] T018 [US1] `web/src/components/OpDrawer.tsx` `closingOp` mode, restricted tabs, `onSubmitClose`/`onSubmitTradeClose`
- [X] T019 [US1] `web/src/components/HistoryTab.tsx` close action (icon button, `title` + `aria-label`)

**Checkpoint**: ✅ Verified — `test_op_closures.py` (12 tests) + `OpDrawer.test.tsx`/`HistoryTab.test.tsx` closing tests all pass.

---

## Phase 4: User Story 2 - See position status and profit/loss at a glance (Priority: P1)

- [X] T020 [P] [US2] Extended `HistoryTab.test.tsx` (status/P&L tests)
- [X] T021 [US2] `HistoryTab.tsx` status chip + realized-P/L cell

---

## Phase 5: User Story 3 - Record an optional leverage multiplier on a new operation (Priority: P2)

- [X] T022 [P] [US3] Extended `OpDrawer.test.tsx` (leverage chip tests)
- [X] T023 [US3] `OpDrawer.tsx` leverage chips (Buy and Sell, per the clarified scope)
- [X] T024 [US3] `HistoryTab.tsx` leverage badge

---

## Phase 6: User Story 4 - Switch trade direction with an animated toggle (Priority: P2)

- [X] T025 [P] [US4] Extended `OpDrawer.test.tsx` (type-panel re-render test; restricted-tabs tests moved under T011 since they're closing-mode specific)
- [X] T026 [US4] `OpDrawer.tsx` — CSS-keyed `type-panel` animation (see "Corrections" above for the scope adjustment from the original JS timer design)
- [X] T027 [US4] `globals.css` — `.type-panel` / `type-panel-in` keyframe

---

## Phase 7: User Story 5 - Operations grouped by day (Priority: P3)

- [X] T028 [P] [US5] Extended `HistoryTab.test.tsx` (day-grouping tests)
- [X] T029 [US5] `HistoryTab.tsx` `groupOpsByDate` + `<th scope="colgroup">` date-section header

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T030 [P] `globals.css` — status chip, leverage badge, closing banner, static-field, leverage-chip, P/L preview styles
- [X] T031 `cd backend && pytest --cov=app --cov-report=term-missing` — 189 passed; `op_closures.py` 100%, `ops.py` 99%, `models.py` 99%
- [X] T032 `cd web && npm run coverage` — 567 passed; `HistoryTab.tsx` 93.5%, `OpDrawer.tsx` 95%, `AppLayout.tsx` 96.7%
- [X] T033 Mobile `tsc --noEmit` shows only 2 pre-existing, unrelated errors (expo-file-system API, a BackupPayload cast) — nothing referencing `leverage`/`OpClosure`/`PositionStatus`; mobile type contract intact
- [ ] T034 Not run against a live stack (Docker unavailable in this environment) — see "Corrections" above

---

## Notes on deviations from the original plan

- `shared/src/positions.test.ts` was placed at `web/src/lib/positions.test.ts` instead — this repo's
  `vitest.config.ts` has no `root`/`dir` override reaching outside `web/`, so a test file placed
  directly under `shared/src/` would silently never run under `npm test`. `AGENTS.md` explicitly
  permits either location; the one that actually executes was chosen.
- `backend/app/routes/op_closures.py` imports `_SELECT`, `_row_to_op`, `_validate_platform_pair` from
  `app.routes.ops` rather than duplicating them, avoiding ~15 lines of duplication for logic already
  shared in spirit between the two route modules.

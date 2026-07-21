# Tasks: Wallet vs. Trade Operation Refactor

**Input**: Design documents from `/specs/024-wallet-trade-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/close-endpoint-delta.md, quickstart.md

**Tests**: Included — this repo's constitution (Behavior Coverage Over Line Coverage) requires an
explicit test for the happy path, primary error paths, and documented edge cases for every changed
module; tests are not optional here.

**Note**: This task list was revised after `/speckit-analyze` found 1 CRITICAL + 1 HIGH coverage gap:
FR-025 (classification immutable on edit) had no implementing task at all, and FR-004 (block an
over-balance wallet Sell/Swap) only had a frontend task, leaving the server boundary unvalidated per
constitution Principle II. Both are folded in below (T005, T018, plus their tests in T013).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps to spec.md's User Story 1–5

---

## Phase 1: Setup

- [x] T001 Confirm local dev environment is up (`backend/AGENTS.md`'s Docker Postgres + `uv run dev.py`, `cd web && npm run dev`) so migrations 014/015 apply automatically on first backend connection

---

## Phase 2: Foundational (blocking prerequisites for all user stories)

**⚠️ CRITICAL**: No user story task may start until this phase is complete.

- [x] T002 [P] Add migration `backend/db/migrations/014_op_kind_and_side.sql`: `ALTER TABLE ops ADD COLUMN op_kind VARCHAR(10) NOT NULL DEFAULT 'wallet'`, `ADD COLUMN side VARCHAR(5)` — per data-model.md
- [x] T003 Add migration `backend/db/migrations/015_backfill_op_kind.py`: classify pre-existing ops with `leverage > 1` as `op_kind='trade'` with `side` derived from `type`; delete any `op_closures` row referencing a now-`wallet`-classified op — per data-model.md's ordered backfill steps (depends on T002 for the column names it targets)
- [x] T004 [P] `backend/app/models.py`: add `op_kind: str`, `side: str | None` to `NewOp`/`Op`; validate `leverage` is `None` when `op_kind='wallet'`; validate `side` is set iff `op_kind='trade'`; derive `side` server-side from `type` on create for trade ops (never trust a client-supplied `side`)
- [x] T005 `backend/app/routes/ops.py`: `PUT /api/ops/{id}` rejects 400 when the request's `op_kind` or `side` differs from the operation's stored value — classification and trade direction are immutable after creation (spec FR-025, contracts/close-endpoint-delta.md) (depends on T004)
- [x] T006 [P] `shared/src/types.ts`: add `kind: 'wallet' | 'trade'`, `side?: 'long' | 'short'` to `NewOp`/`Op`; export from `shared/src/index.ts`
- [x] T007 [P] `shared/src/portfolio.ts`: `computePositions`/`computeProfitByAsset` filter their input to `kind: 'wallet'` ops before computing (spec FR-023) (depends on T006)
- [x] T008 [P] Create `shared/src/walletFifo.ts`: `computeWalletBalance(ops, coinId, platformId, currency)`, `computeWalletRealizedPnl(sellOp, ops)`, `computeWalletEditImpact(ops, editedOpId, proposedOp)` per data-model.md's FIFO algorithm; export from `shared/src/index.ts` (depends on T006)
- [x] T009 [P] Create `shared/src/cycles.ts`: `computeCycles(ops, closures)` (folded from item 27, filtered to `kind: 'trade'`), `Cycle` type; export from `shared/src/index.ts` (depends on T006)
- [x] T010 [P] `shared/src/positions.ts`: extend `estimateClosePnl` to scale by the source op's `leverage` and invert sign when `side: 'short'` (depends on T006)
- [x] T011 [P] Add i18n keys to `shared/src/i18n/types.ts` and all 10 locale files: `history_action_moveWallet`, `history_action_newTrade`, `wallet_available_balance`, `wallet_max_button`, `wallet_estimated_pnl`, `trade_side_long`, `trade_side_short`, `trade_close_locked_hint`, `cycle_tag_aria`, `cycle_header`, `cycle_status_partial`, `cycle_status_closed`, `cycle_entry_label`, `cycle_exit_label`, `cycle_exit_partial_label`, `cycle_remaining_label`, `cycle_realized_label`

**Checkpoint**: Data model, shared derivation logic (FIFO, portfolio exclusion, cycles), classification-immutability guard, and i18n keys are in place — user story work can begin.

---

## Phase 3: User Story 1 - Wallet operations no longer carry a confusing trade status (Priority: P1) 🎯 MVP

**Goal**: Wallet Buy/Sell/Swap show no status/close action; Sell/Swap validate against and are computed from FIFO-derived balance, enforced at both the UI and the API boundary.

**Independent Test**: Record a Buy, Sell part of it, Swap the remainder; confirm no status/close action on any row, the Sell shows realized P/L, the Swap collapses into one row, and an over-balance Sell is rejected by both the UI and a direct API call.

### Tests for User Story 1

- [ ] T012 [P] [US1] `web/src/lib/walletFifo.test.ts` — `computeWalletBalance`/`computeWalletRealizedPnl` happy path (multiple buys at different prices/platforms, partial sell, swap consuming a lot and creating a new one)
- [x] T013 [P] [US1] Extend `backend/tests/test_ops.py` — creating a wallet op with `leverage` set is rejected 400; a plain create defaults to `op_kind='wallet'`; `PUT` rejecting a request that changes `op_kind`/`side` is rejected 400; `POST` for a wallet Sell/Swap exceeding the available FIFO balance is rejected 400
- [x] T014 [P] [US1] Extend `backend/tests/test_op_closures.py` — `POST /api/ops/{id}/close` rejects 400 when `{id}` resolves to `op_kind='wallet'`
- [ ] T015 [P] [US1] Extend `web/src/components/HistoryTab.test.tsx` — wallet rows show no status/close action; a wallet Sell row shows realized P/L; a Swap pair renders as one collapsed row
- [x] T016 [P] [US1] Extend `web/src/components/OpDrawer.test.tsx` — wallet mode shows Buy/Sell/Swap tabs with no leverage field; Sell/Swap show available balance + Max; Sell shows a live P/L footer; over-balance quantity is blocked client-side

### Implementation for User Story 1

- [ ] T017 [US1] `backend/app/routes/op_closures.py`: reject close (400) when the source op's `op_kind` is `'wallet'`
- [ ] T018 [US1] `backend/app/routes/ops.py`: `create_op` rejects 400 when a wallet Sell/Swap's `qty` exceeds `computeWalletBalance`'s available quantity for that coin/platform/currency (Python port of the shared FIFO walk from T008 — the server must not trust the client to have enforced this) (depends on T008)
- [ ] T019 [US1] `web/src/components/HistoryTab.tsx`: two header buttons ("Move wallet" / "New trade") replacing "+ Add operation"; wallet rows render with no status/close columns; wallet Sell rows show FIFO-derived realized P/L; Swap-paired rows (`tradeGroupId`-linked, `kind: 'wallet'`) collapse into a single row
- [x] T020 [US1] `web/src/components/OpDrawer.tsx`: wallet-mode fieldsets — Buy/Sell/Swap tabs (rename the existing "Trade" tab label to "Swap" in this mode only), no leverage field, available-balance + Max button on Sell/Swap (via `computeWalletBalance`), live estimated-P/L footer on Sell (via `computeWalletRealizedPnl`)
- [ ] T021 [US1] `web/src/app/globals.css`: two-button header styles, wallet available-balance card, Swap chip color (`#a78bfa` suggested)

**Checkpoint**: Wallet flow is fully de-statused and FIFO-driven, validated at both UI and API boundary; independently testable and demoable.

---

## Phase 4: User Story 2 - Open a leveraged trade position independent of wallet holdings (Priority: P2)

**Goal**: A dedicated "New trade" entry creates a leveraged long/short position with no wallet-balance check.

**Independent Test**: Open a Short for an asset with zero held balance, pick a leverage multiplier, submit; confirm it succeeds, shows Open status + leverage badge, and the wallet balance is unchanged.

### Tests for User Story 2

- [ ] T022 [P] [US2] Extend `backend/tests/test_ops.py` — creating a trade op derives `side` from `type` server-side (`Buy→long`, `Sell→short`); no wallet-balance validation occurs for a trade Sell (short)
- [ ] T023 [P] [US2] Extend `web/src/components/OpDrawer.test.tsx` — trade mode shows "Buy · Long"/"Sell · Short" tabs and leverage chips; no wallet balance shown or validated
- [ ] T024 [P] [US2] Extend `web/src/components/HistoryTab.test.tsx` — a new trade row shows Open status, its leverage badge, a Long/Short label, and the left-border marker

### Implementation for User Story 2

- [x] T025 [US2] `backend/app/routes/ops.py`: on create, when `op_kind='trade'`, derive and store `side` from `type` server-side
- [ ] T026 [US2] `web/src/components/OpDrawer.tsx`: trade-mode fieldset — "Buy · Long"/"Sell · Short" tabs, leverage chip selection (1x/2x/3x/5x/10x), no wallet-balance UI or validation
- [x] T027 [US2] `web/src/components/HistoryTab.tsx`: trade-row rendering — reuse item 26's status pill, leverage badge, add the Long/Short label and the 2px orange left-border marker
- [ ] T028 [US2] `web/src/app/globals.css`: trade-row left-border marker and Long/Short label styles

**Checkpoint**: Trade positions can be opened independently of wallet state; both US1 and US2 work together without interference.

---

## Phase 5: User Story 3 - Close an open or partial trade position (Priority: P3)

**Goal**: Closing a trade locks the type to whichever side resolves it (no tab choice), with a live, leverage-scaled P/L preview.

**Independent Test**: Open a Short, close half via its close action (type locked to Buy, no choice offered), confirm Partial + P/L; close the remainder, confirm Closed.

### Tests for User Story 3

- [x] T029 [P] [US3] Extend `backend/tests/test_op_closures.py` — closing a `side: 'short'` position with a `type: 'Sell'` closing op is rejected 400 (must be Buy); closing a `side: 'long'` position with `type: 'Buy'` is rejected 400 (must be Sell); a Swap-mode close against a trade position is rejected
- [ ] T030 [P] [US3] Extend `web/src/components/OpDrawer.test.tsx` — close mode shows a single locked segment (no tab choice) matching the position's side; no Swap option is offered; the P/L footer inverts sign for a short and scales by leverage

### Implementation for User Story 3

- [ ] T031 [US3] `backend/app/routes/op_closures.py`: enforce the locked closing type from the source op's `side` (400 on mismatch); reject a Swap/Trade-mode close (a second, `tradeGroupId`-linked receiving leg) against a `kind: 'trade'` source
- [ ] T032 [US3] `web/src/components/OpDrawer.tsx`: close mode — lock the type to a single disabled segment derived from the position's `side`, remove the Swap tab entirely in this mode, wire the P/L footer through the updated `estimateClosePnl` (T010)

**Checkpoint**: Trade positions can be fully or partially closed; the full trade lifecycle (US2 + US3) works end-to-end.

---

## Phase 6: User Story 4 - See a trade position's full history from any of its rows (Priority: P4)

**Goal**: Hovering/tapping any row belonging to a trade position shows its entry, every close, remaining quantity, and total realized P/L (folded from item 27, trade-only).

**Independent Test**: Open a trade, close it twice (partial then full), confirm interacting with any of the three rows opens the same summary.

### Tests for User Story 4

- [ ] T033 [P] [US4] `web/src/lib/cycles.test.ts` — single entry/single exit, single entry/multiple partial exits, multi-entry fallback, a wallet op resolves to no cycle
- [ ] T034 [P] [US4] `web/src/components/CyclePopover.test.tsx` — renders partial vs. closed status, entry/exit rows, remaining-qty row only when applicable

### Implementation for User Story 4

- [ ] T035 [US4] Create `web/src/components/CyclePopover.tsx` — header (`cycle_header` + partial/closed badge), entry row(s), exit rows, remaining-open row, realized-P/L footer; vertical flip near the viewport's lower half
- [ ] T036 [US4] `web/src/components/HistoryTab.tsx`: render the cycle tag next to the type chip on any row resolving to a `Cycle` via `computeCycles` (trade rows only); wire hover-open/leave-close (desktop) and tap-open/tap-outside-close (touch); keyboard-operable (`button`, opens on focus, closes on `Esc`)
- [x] T037 [US4] `web/src/app/globals.css`: cycle tag + popover styles (`#c4b5fd` cycle color, `#141418` popover surface, ~160ms transition, `overflow: visible` on the table container)

**Checkpoint**: Cycle summaries work for trade positions only; no cycle tag appears on any wallet row.

---

## Phase 7: User Story 5 - Editing or deleting a past wallet operation keeps later ones honest (Priority: P5)

**Goal**: Editing/deleting a wallet Buy, Sell, or Swap that later operations depend on recomputes, confirms, or blocks the change — at both the UI and the API boundary.

**Independent Test**: Buy, sell part of it, edit the buy's quantity below what the sell consumed — blocked by both the UI and a direct API call; a smaller edit shows a confirmation naming the affected sell before applying.

### Tests for User Story 5

- [ ] T038 [P] [US5] Extend `web/src/lib/walletFifo.test.ts` — `computeWalletEditImpact` returns the correct affected-count and first-negative-balance date across edits/deletes of Buy, Sell, and either side of a Swap
- [x] T039 [P] [US5] Extend `backend/tests/test_ops.py` — `PUT`/`DELETE /api/ops/{id}` reject 400 when the change would produce a negative wallet balance at any later date for that coin/platform/currency
- [ ] T040 [P] [US5] Extend `web/src/components/HistoryTab.test.tsx` — editing/deleting an operation with dependent later ops shows the existing `ConfirmDialog` describing the impact; an attempt that would go negative is blocked with an explanatory message and no dialog

### Implementation for User Story 5

- [ ] T041 [US5] `backend/app/routes/ops.py`: on `PUT`/`DELETE`, run the same FIFO check as `computeWalletEditImpact` (Python port, scoped to the same coin/platform/currency wallet ops) and reject 400 on a resulting negative balance
- [ ] T042 [US5] `web/src/components/HistoryTab.tsx`: call `computeWalletEditImpact` before submitting an edit or delete; show the existing `ConfirmDialog` (`web/src/components/ConfirmDialog.tsx`) when later operations are affected; block outright with a message when a negative balance would result

**Checkpoint**: All five user stories work independently and together; full feature scope complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Confirm every new symbol (`walletFifo.ts`, `cycles.ts`, new `types.ts` fields) is exported from `shared/src/index.ts`
- [ ] T044 `cd backend && pytest --cov=app --cov-report=term-missing` — verify ≥90% coverage on changed modules (`models.py`, `routes/ops.py`, `routes/op_closures.py`)
- [ ] T045 `cd web && npm run coverage` — verify coverage on changed modules (`HistoryTab.tsx`, `OpDrawer.tsx`, `CyclePopover.tsx`, `walletFifo.ts`, `cycles.ts`)
- [ ] T046 Mobile `tsc --noEmit` — confirm the `kind`/`side` additions to `Op`/`NewOp` don't break the mobile type contract
- [ ] T047 Run `specs/024-wallet-trade-refactor/quickstart.md`'s live walkthrough end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3-7)**: All depend on Foundational. US1-US4 have no dependency on each other's
  application code, but are listed in priority order (P1→P5) since that's the recommended build order.
  US5 depends on US1's FIFO machinery being wired into the wallet UI to have anything meaningful to
  recompute, so build it last even though its shared-layer function (`computeWalletEditImpact`) is
  written in Phase 2.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- Foundational: T002, T004, T006 have no dependencies on each other and can run in parallel; T007, T008,
  T009, T010, T011 each depend only on T006 (or T002, for T003) and can all run in parallel with each
  other once their single prerequisite lands; T005 depends on T004.
- All `[P]`-marked test tasks within a user story phase can run in parallel with each other.
- US1 and US2's implementation tasks touch different `OpDrawer.tsx`/`HistoryTab.tsx` sections (wallet
  mode vs. trade mode) but the same files — sequence them rather than parallelizing across stories to
  avoid merge conflicts within a single implementer's working copy.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: wallet operations show no status/close, FIFO balance/P&L is correct, and
   both the UI and the API reject an over-balance Sell/Swap.

### Incremental Delivery

1. Foundational → US1 (wallet split, MVP) → US2 (trade open) → US3 (trade close) → US4 (cycle summary)
   → US5 (edit/delete safety) → Polish.
2. Each story is independently testable per its "Independent Test" line above before moving to the next.

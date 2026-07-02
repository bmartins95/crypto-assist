---

description: "Task list for History view redesign with entry drawer (Item 9)"
---

# Tasks: History View Redesign with Entry Drawer

**Input**: Design documents from `/specs/010-history-view-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — Constitution III (Behavior Coverage Over Line Coverage) and CLAUDE.md
require ≥90% coverage plus explicit behavior tests on every changed module.

**Organization**: Grouped by user story from spec.md, in priority order (P1 → P2 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to US1–US4 from spec.md

## Path Conventions

Monorepo: `web/src/` (frontend) + `shared/src/i18n/` (translations). No `backend/` or
`mobile/` changes in this feature.

---

## Phase 1: Setup

No new project setup required — branch, spec, and plan already exist. Skipping to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The drawer shell, header, i18n copy, and CSS every user story renders on top of.

**⚠️ CRITICAL**: No user story task can begin until this phase is complete.

- [ ] T001 [P] Add `history_subtitle` key to the `UIText` interface in `shared/src/i18n/types.ts`
- [ ] T002 [P] Add a `history_subtitle` translation to all 10 locale files in `shared/src/i18n/locales/` (`pt-BR.ts`, `en-US.ts`, `es-ES.ts`, `fr-FR.ts`, `de-DE.ts`, `zh-CN.ts`, `ja-JP.ts`, `ar-SA.ts`, `hi-IN.ts`, `ru-RU.ts`) — depends on T001 (TypeScript enforces every locale satisfies `UIText`)
- [ ] T003 [P] Add `history_form_validationRequired` (generic "fill in the required fields" message for Buy/Sell/Trade) and `trade_form_sameAsset` ("source and destination cannot be the same asset") keys to the `UIText` interface in `shared/src/i18n/types.ts` — these replace the hardcoded Portuguese `alert()` strings in the current `handleAddTrade`/`handleAddOp` logic (Constitution V; closes the i18n gap identified in analysis finding C1)
- [ ] T004 [P] Add `history_form_validationRequired` and `trade_form_sameAsset` translations to all 10 locale files in `shared/src/i18n/locales/` — depends on T003
- [ ] T005 [P] Add `.btn-accent`, `.drawer`, `.drawer-backdrop`, `.drawer-head`, `.drawer-body`, `.drawer-foot`, `.drawer-grid`, `.trade-block`, `.trade-block.out`, `.trade-block.in`, `.trade-arrow`, `.fhint`, `.tag` classes to `web/src/app/globals.css`, matching `docs/design/dashboard-collapsible-sidebar.html`'s drawer markup and using `--s-surface`/`--s-border` tokens (per research.md R2 — reuse `.seg-ctrl`/`.seg-btn` for the type selector instead of adding a new segmented-control class)
- [ ] T006 Create `web/src/components/OpDrawer.tsx`: dialog shell accepting `open: boolean`, `onClose: () => void`, `onSubmit: (op: NewOp) => void`, `onSubmitTrade: (sell: NewOp, buy: NewOp) => void`, `editingOp?: Op`, `assets: Asset[]`, `apiKey?: string` props (research.md R7); render a `.drawer-backdrop` + `<aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">` with `.drawer-head` (title from `t.history_form_editOp` when `editingOp` is set, else `t.history_form_addOp`), `.drawer-body`, and `.drawer-foot` (Cancel button using `t.history_form_cancel`, Submit button); mount/render driven by the `open` prop
- [ ] T007 In `web/src/components/OpDrawer.tsx`, add the type selector: a `.seg-ctrl` with three `.seg-btn` options (`t.history_opType_buy`, `t.history_opType_sell`, `t.history_form_trade`) bound to an `opType: 'buy' | 'sell' | 'trade'` state, defaulting to `'buy'` and resetting to `'buy'` each time the drawer opens for a new entry (not editing); when the user switches away from Trade to Buy/Sell mid-session, clear the Trade-only fields (`fromCoinId`, `fromQty`, `toCoin`, `toQty`) while preserving the shared `date`/`platform` fields (spec.md Edge Cases — analysis finding M2)
- [ ] T008 In `web/src/components/OpDrawer.tsx`, implement focus trap (on `open` becoming `true`, focus the first focusable field; a `keydown` listener on the drawer root traps Tab/Shift+Tab among `input, select, button, textarea, [tabindex]`; store and restore the previously-focused element on close), body-scroll lock (`useEffect` toggling `document.body.style.overflow` to `'hidden'` while open and restoring the prior value on close/unmount), and Escape-to-close plus backdrop-click-to-close, both invoking `onClose` (research.md R5)
- [ ] T009 Rewrite `web/src/components/HistoryTab.tsx`: remove the two always-visible form JSX blocks (`op-card`, `trade-card`) and their associated state/handlers (`opDate`, `opCoin`, `opType`, `opQty`, `opPrice`, `opFee`, `opPlatform`, `priceMode`, `editingId`, `trDate`, `trFromCoinId`, `trFromQty`, `trToCoin`, `trToQty`, `trTotal`, `trFee`, `resetOpForm`, `handleAddOp`, `handleEditOp`, `syncTradeTotal`, `handleTrToCoinSelect`, `handleAddTrade` — these relocate into `OpDrawer.tsx` across Phases 3–5); add `<ContentHeader title={t.nav_history} subtitle={t.history_subtitle}>` containing a `<button className="btn btn-accent">` (`t.history_form_addOp`) that opens the drawer for a new entry; keep the operations table and `empty-state` rendering unchanged; add `drawerOpen`/`editingOp` state and render `<OpDrawer open={drawerOpen} onClose={...} onSubmit={onAddOp-or-onEditOp-dispatch} onSubmitTrade={...} editingOp={editingOp} assets={assets} apiKey={apiKey} />`
- [ ] T010 [P] Update `web/src/components/HistoryTab.test.tsx`: remove assertions tied to the deleted always-visible forms; add assertions that the content header and "Registrar operação" button render, the table (or empty state) renders with no form fields above it, and clicking the button opens the drawer (`role="dialog"` present). **Preserve unchanged** the existing `'shows the empty state when there are no operations'` and `'calls onRemoveOp when clicking the delete button on a row'` tests (analysis finding M1) — these are unrelated to the removed forms and cover spec.md FR-016 (delete keeps working, never opens the drawer)

**Checkpoint**: `/history` renders header + table + a drawer shell that opens/closes and switches type visually. No operation can be created or edited yet — that is each user story's job.

---

## Phase 3: User Story 1 - Register a Buy or Sell operation via the drawer (Priority: P1) 🎯 MVP

**Goal**: Buy/Sell fieldset with coin search, auto-calculated read-only Total, and submission that creates exactly one op via `onAddOp`, blocking on invalid input.

**Independent Test**: Open the drawer (defaults to Buy), fill date/asset/quantity/unit price, submit, and confirm exactly one new row appears in the table with correct values.

### Implementation for User Story 1

- [ ] T011 [US1] In `web/src/components/OpDrawer.tsx`, add the Buy/Sell fieldset (visible when `opType !== 'trade'`): Date, Platform, the relocated `CoinSearch` sub-component (label swaps between "moeda comprada"/"moeda vendida" phrasing based on `opType`), Quantity, Unit price, Fee, and a read-only Total field with a `.fhint` "calculado automaticamente" hint, computed as `qty * unitPrice + fee` for Buy or `qty * unitPrice - fee` for Sell (research.md R3 — replaces the old unit/total toggle)
- [ ] T012 [US1] In `web/src/components/OpDrawer.tsx`, implement submit for a new Buy/Sell entry: validate `coin` is selected, `qty > 0`, `unitPrice > 0` (data-model.md); on valid submit, build a `NewOp` with `type` from `opType` and call `onSubmit`, then reset fields and call `onClose`; on invalid submit, render `t.history_form_validationRequired` as a visible inline message and do not call `onSubmit`
- [ ] T013 [US1] In `web/src/components/HistoryTab.tsx`, wire `OpDrawer`'s `onSubmit` (new-entry path) to call the existing `onAddOp` prop
- [ ] T014 [US1] Create `web/src/components/OpDrawer.test.tsx`: test the drawer opens in Buy mode by default with focus on the first field; test submitting a valid Buy calls `onAddOp` once with `type: 'Buy'` and the drawer closes; test switching to Sell keeps the same fields and submits with `type: 'Sell'`; test submitting with a missing or zero-value required field does not call `onAddOp` and shows the `t.history_form_validationRequired` message

**Checkpoint**: A user can fully register a Buy or Sell operation through the drawer; `/history` has no always-visible form.

---

## Phase 4: User Story 2 - Register a Trade via the drawer (Priority: P2)

**Goal**: Two-block swap fieldset (sell + receive) that submits two ops sharing one date, guarded against selecting the same asset on both sides.

**Independent Test**: Switch to Trade, fill both blocks, submit, and confirm exactly two new rows appear — one Sell, one Buy — sharing the same date.

### Implementation for User Story 2

- [ ] T015 [US2] In `web/src/components/OpDrawer.tsx`, add the Trade fieldset (visible when `opType === 'trade'`): shared Date/Platform, a `.trade-block.out` block ("Você vende" / `t.trade_form_from`) with an owned-asset `<select>` sourced from the `assets` prop plus Quantity, a `.trade-arrow` divider, a `.trade-block.in` block ("Você recebe" / `t.trade_form_to`) with `CoinSearch` for the destination coin plus Quantity, and shared Fee/Total fields — porting the current `syncTradeTotal` auto-fill-from-live-price logic from `HistoryTab.tsx` unchanged (research.md R4)
- [ ] T016 [US2] In `web/src/components/OpDrawer.tsx`, implement submit for a new Trade entry: validate `fromCoinId`, `toCoin`, `fromQty > 0`, `toQty > 0`, `total > 0` (show `t.history_form_validationRequired` if any are missing/invalid), and `fromCoinId !== toCoin.coinId` (show `t.trade_form_sameAsset` if equal); on valid submit, build the sell `NewOp` (source asset, `total` as its total) and buy `NewOp` (destination asset, `total + fee` as its total, matching current `handleAddTrade` math) both dated `trDate`, and call `onSubmitTrade(sellOp, buyOp)`, then reset fields and call `onClose`
- [ ] T017 [US2] In `web/src/components/HistoryTab.tsx`, wire `OpDrawer`'s `onSubmitTrade` to call `onAddOp` twice, sell operation first then buy operation
- [ ] T018 [US2] In `web/src/components/OpDrawer.test.tsx`, add tests: switching to Trade swaps in the two-block fieldset; submitting a valid Trade calls `onSubmitTrade` once with a Sell op and a Buy op sharing the same date; submitting a Trade with identical source/destination assets is blocked, shows `t.trade_form_sameAsset`, and calls no submission handler

**Checkpoint**: Trade registration works end-to-end through the drawer, matching the current always-visible trade form's behavior.

---

## Phase 5: User Story 3 - Edit an existing operation (Priority: P2)

**Goal**: The edit icon on a table row opens the drawer pre-filled in the matching Buy/Sell mode; submitting updates the operation in place; closing without submitting discards changes.

**Independent Test**: Click a row's edit icon, confirm the drawer opens pre-filled with that row's values, change a field, submit, and confirm the table row updates rather than duplicating.

### Implementation for User Story 3

- [ ] T019 [US3] In `web/src/components/HistoryTab.tsx`, wire each table row's edit icon to set `editingOp` to that row's `Op` and open the drawer (replacing the old inline-form pre-fill behavior previously in `handleEditOp`)
- [ ] T020 [US3] In `web/src/components/OpDrawer.tsx`, when `editingOp` is present on open, initialize `opType` from `editingOp.type` (`'buy'`/`'sell'`) and pre-fill every Buy/Sell field from `editingOp`'s values; disable the Trade option in the type selector while editing (data-model.md — a stored `Op` is always a single Buy/Sell leg, never a trade pair)
- [ ] T021 [US3] In `web/src/components/OpDrawer.tsx`, implement submit while editing: call `onSubmit` with the updated fields and have `HistoryTab.tsx` route it to `onEditOp(editingOp.id, updatedOp)` instead of `onAddOp` when `editingOp` is set; closing (Escape/backdrop/Cancel) without submitting must leave the original operation untouched and clear `editingOp`
- [ ] T022 [US3] In `web/src/components/OpDrawer.test.tsx`, add tests: opening with an `editingOp` prop pre-fills every field from it; submitting in edit mode calls `onEditOp` with the original id and the updated fields (and not `onAddOp`); closing an edit session without submitting calls neither `onAddOp` nor `onEditOp`

**Checkpoint**: Editing via the drawer fully replaces the old inline-edit behavior with no functional regression.

---

## Phase 6: User Story 4 - Dismiss the drawer without side effects (Priority: P3)

**Goal**: Escape, backdrop click, and Cancel all close the drawer with no operation created or modified; Tab/Shift+Tab stay trapped inside; body scroll is locked while open and restored on close; focus returns to the trigger.

**Independent Test**: Open the drawer via each of Escape, backdrop click, and Cancel and confirm each closes it with no side effects and restores focus to the triggering control.

### Implementation for User Story 4

- [ ] T023 [US4] In `web/src/components/OpDrawer.test.tsx`, add tests: pressing Escape closes the drawer and calls neither `onSubmit`/`onAddOp` nor `onEditOp`/`onSubmitTrade`; clicking the `.drawer-backdrop` element closes the drawer with no submission call; clicking Cancel closes the drawer, discarding in-progress field values, with no submission call
- [ ] T024 [US4] In `web/src/components/OpDrawer.test.tsx`, add a focus-trap test: with the drawer open, simulate Tab from the last focusable element and assert focus wraps to the first, and Shift+Tab from the first wraps to the last, never leaving the drawer's DOM subtree
- [ ] T025 [US4] In `web/src/components/OpDrawer.test.tsx`, add a body-scroll-lock test: assert `document.body.style.overflow` is `'hidden'` while the drawer is open and is restored to its prior value once it closes
- [ ] T026 [US4] In `web/src/components/OpDrawer.test.tsx`, add a focus-restoration test: assert that after the drawer closes via any path, focus returns to the element that had focus immediately before the drawer opened

**Checkpoint**: All spec.md FR-011–FR-015 accessibility requirements are covered by dedicated tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T027 Run `cd web && npm test` and fix any failures across `HistoryTab.test.tsx` and `OpDrawer.test.tsx`
- [ ] T028 Run `cd web && npm run coverage`; confirm ≥90% on `web/src/components/OpDrawer.tsx` and `web/src/components/HistoryTab.tsx`
- [ ] T029 Walk through `quickstart.md` manually against `npm run dev` (drawer open/close, Buy/Sell/Trade submission, edit pre-fill, Escape/backdrop/Cancel, focus trap, scroll lock, empty state)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories (every story renders inside the drawer shell built here).
- **US1 (Phase 3)**: Depends on Phase 2 only.
- **US2 (Phase 4)**: Depends on Phase 2 only; touches the same `OpDrawer.tsx` file as US1 (type-selector branch vs. Trade branch) so should follow US1 to avoid merge churn, but is functionally independent.
- **US3 (Phase 5)**: Depends on Phase 2 only; the edit-open wiring in `HistoryTab.tsx` (T019) touches the same file as T009/T013/T017, so sequenced after US1/US2 for the same reason.
- **US4 (Phase 6)**: Depends on Phase 2's T008 (focus trap/scroll lock/Escape/backdrop are implemented there); this phase is dedicated regression coverage of behavior already built in Foundational, mirroring how item 8's US2 phase covered already-implemented switching logic.
- **Polish (Phase 7)**: Depends on all preceding phases.

### Parallel Opportunities

- T001–T005 (Phase 2) can run in parallel with each other (different files) before T006 starts.
- T010 can run in parallel with T011–T014 once T009 lands (different test file from `OpDrawer.tsx`).
- Within each user-story phase, the dedicated test task can be drafted in parallel with implementation once the relevant `OpDrawer.tsx` section exists, though both land in the same file so are not marked `[P]`.

---

## Implementation Strategy

### MVP First

1. Phase 2 (Foundational) — drawer shell, header, i18n, and CSS are the load-bearing pieces every story needs.
2. Phase 3 (US1) — Buy/Sell registration. This alone replaces the always-visible forms with a working drawer and is independently shippable.
3. Validate, then continue through Phases 4–7 in order.

### Incremental Delivery

Phase 2 → US1 (MVP) → US2 (Trade) → US3 (Edit) → US4 (dismissal/accessibility regression coverage) → Polish.

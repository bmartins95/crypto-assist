---

description: "Task list for Import Wallet Feedback & Price Freshness"
---

# Tasks: Import Wallet Feedback & Price Freshness

**Input**: Design documents from `/specs/021-fix-import-wallet-feedback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-interfaces.md, quickstart.md

**Tests**: Required — the constitution's Principle III (Behavior Coverage Over Line Coverage) mandates explicit tests for every user-facing behavior, not just coverage.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching `spec.md`'s priorities) so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Phase 1: Setup

Not applicable — this fix reuses the existing project structure, tooling, and dependencies unchanged. No initialization tasks are required.

## Phase 2: Foundational

Not applicable — no shared infrastructure blocks more than one story. The only cross-story note: US1's message-text fix and US3's in-app-UI rewiring both land in `settings.tsx`'s `handleImportChange`, so — since this feature ships as a single PR rather than staged releases — the fix is implemented once, directly with the final `Toast`-based UI, instead of an interim native-`alert()` version that would immediately be overwritten (see `tasks.md` revision note below).

---

## Phase 3: User Story 1 - Accurate import confirmation (Priority: P1) 🎯 MVP

**Goal**: A successful import shows a message confirming the wallet was imported — never the wallet-cleared message.

**Independent Test**: Import a valid backup via Settings and confirm the shown message text is the dedicated import-success copy, not the clear-wallet copy.

### Implementation for User Story 1

- [x] T001 [US1] Add `settings_import_success: string;` to the `UIText` interface in `shared/src/i18n/types.ts`
- [x] T002 [P] [US1] Add a `settings_import_success` translation to each of the 10 locale files in `shared/src/i18n/locales/` (`pt-BR.ts`, `en-US.ts`, `es-ES.ts`, `fr-FR.ts`, `de-DE.ts`, `zh-CN.ts`, `ja-JP.ts`, `ar-SA.ts`, `hi-IN.ts`, `ru-RU.ts`)

**Checkpoint**: The dedicated key exists and compiles across all locales. Its actual use in `handleImportChange` — and the test proving the correct message is shown — is delivered together with US3's `Toast` wiring (T017), since both changes land in the same function in the same PR; see the Revision Note below for why an interim `alert()`-based fix was deliberately not scheduled here.

---

## Phase 4: User Story 2 - Imported holdings show correct prices immediately (Priority: P1)

**Goal**: A newly-imported coin shows a real market price right after import, with no manual refresh or page reload.

**Independent Test**: Import a backup containing a coin not already held, and confirm the Wallet view shows a real price for it without any manual refresh action.

### Tests for User Story 2

- [x] T003 [P] [US2] Add a test in `web/src/components/AppLayout.test.tsx` asserting that after `reload()` resolves, `api.getPrices` was called with the coin ids from the newly-fetched ops, and the `prices` context value reflects the returned market data
- [x] T004 [P] [US2] Add a test in `web/src/components/AppLayout.test.tsx` asserting `reload()` does not call `api.getPrices` when the newly-fetched ops list is empty (e.g. after a clear-wallet)

### Implementation for User Story 2

- [x] T005 [US2] Update `reload()` in `web/src/components/AppLayout.tsx` to compute `ids` directly from the freshly-fetched `remoteOps` (not the `assets` memo) and, when non-empty, call `api.getPrices(ids)`, merge the result into `prices`/`avatarCache` state, and set `didAutoFetchPrices.current = true` in that same branch to prevent a redundant duplicate fetch from the mount-time auto-fetch effect (depends on T003, T004 existing first)

**Checkpoint**: Importing a backup with a previously-unheld coin shows its price immediately. Independently verifiable via T003/T004, with no dependency on US1 or US3.

---

## Phase 5: User Story 3 - Consistent in-app feedback for data actions (Priority: P2)

**Goal**: Export, import, and clear-wallet feedback (confirmations, success, and error messages) use the application's own UI — never a native browser alert/confirm popup. This phase also delivers US1's message fix, wired directly into the final in-app UI (see Revision Note).

**Independent Test**: Trigger export failure, import failure, import success, and both the confirm and cancel paths of clear-wallet, and confirm none of them show a native browser alert/confirm popup, and that the import-success message is the dedicated copy.

### Tests for User Story 3

- [x] T006 [P] [US3] Write `web/src/components/Toast.test.tsx`: renders the given `message` with `role="status"`, close button calls `onDismiss`, and (using fake timers) the toast auto-dismisses after its timeout
- [x] T007 [P] [US3] Write `web/src/components/ConfirmDialog.test.tsx`: renders only when `open`, Escape key and backdrop click both call `onCancel` without calling `onConfirm`, Cancel button calls `onCancel`, Confirm button calls `onConfirm`
- [x] T008 [US1][US3] Rewrite the native-dialog assertions in `web/src/pages/settings.test.tsx` (import-success, export-error, import-error, clear-wallet confirm/cancel/confirm-success/error) to query the rendered `Toast`/`ConfirmDialog` markup instead of spying on `window.alert`/`window.confirm`, asserting the import-success case shows `t.settings_import_success` (not `t.settings_clear_wallet_success`) (test should fail against current code; depends on T006, T007 existing so the test can import/query the new components)

### Implementation for User Story 3

- [x] T009 [US3] Add `common_close: string;` to the `UIText` interface in `shared/src/i18n/types.ts`
- [x] T010 [P] [US3] Add a `common_close` translation to each of the 10 locale files in `shared/src/i18n/locales/`
- [x] T011 [P] [US3] Implement `web/src/components/Toast.tsx` per `contracts/component-interfaces.md` (`kind`/`message`/`onDismiss` props, `role="status" aria-live="polite"`, auto-dismiss timer, `aria-label={t.common_close}` close button)
- [x] T012 [P] [US3] Implement `web/src/components/ConfirmDialog.tsx` per `contracts/component-interfaces.md` (`open`/`title`/`message`/`confirmLabel`/`cancelLabel`/`onConfirm`/`onCancel` props, `role="alertdialog" aria-modal="true"`, Escape/backdrop-click triggers `onCancel`, focuses Cancel button on open)
- [x] T013 [P] [US3] Add `.toast`, `.toast--success`, `.toast--error`, `.toast-msg`, `.toast-close` rules to `web/src/app/globals.css`, using the existing `--s-accent`/`--s-danger-border`/`--s-danger-dim` tokens
- [x] T014 [P] [US3] Add `.confirm-backdrop`, `.confirm-dialog`, `.confirm-dialog-title`, `.confirm-dialog-msg`, `.confirm-dialog-actions` rules to `web/src/app/globals.css`
- [x] T015 [US1][US3] In `web/src/pages/settings.tsx`, add `toast` state and rewrite `handleExport`'s and `handleImportChange`'s `alert()` calls to `setToast(...)`, using `t.settings_import_success` (not `t.settings_clear_wallet_success`) for the import-success case — this single change delivers both US1's message fix and US3's in-app-UI requirement (depends on T001, T009–T014)
- [x] T016 [US3] In `web/src/pages/settings.tsx`, split `handleClearWallet` into a click handler that opens `ConfirmDialog` (`confirmClearOpen` state) and a `confirmClearWallet` function invoked from `onConfirm`, using `setToast` instead of `alert()` for its result (depends on T009–T014)
- [x] T017 [US3] Render `<Toast>` (when `toast` is set) and `<ConfirmDialog>` in `web/src/pages/settings.tsx`'s JSX, wired to the state from T015/T016

**Checkpoint**: All three data actions on Settings use in-app UI end-to-end, including the corrected import-success message; zero native `alert`/`confirm` remain on the page. Verified via T006–T008.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T018 [P] Run `cd web && npm run coverage`; confirm ≥90% on every changed file and note the summary for the PR description
- [x] T019 Run `cd backend && pytest` to confirm no incidental breakage (no backend files changed by this feature)
- [x] T020 Walk through `specs/021-fix-import-wallet-feedback/quickstart.md`'s manual smoke test against `npm run dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- No Setup/Foundational phase blocks any story (see Phase 1/2 notes above).
- **User Story 1 (T001–T002)**: No dependency on US2/US3. Its user-facing delivery (the actual message fix) is completed as part of US3's T015 — see Revision Note.
- **User Story 2 (T003–T005)**: No dependency on US1/US3 — touches only `AppLayout.tsx`/`AppLayout.test.tsx`.
- **User Story 3 (T006–T017)**: The new component tasks (T006, T007, T009–T014) have no dependency on US1/US2. T008, T015, T016, T017 edit `settings.tsx`/`settings.test.tsx` and require T001 (the i18n key) and T006/T007/T011/T012 (the components and their tests) to exist first.
- **Polish (T018–T020)**: Depends on all three stories being complete.

### Parallel Opportunities

- T002 (10 locale files) can be done in parallel with itself across files, once T001 lands (TypeScript needs the type before the values compile).
- T003 and T004 (both in `AppLayout.test.tsx`) can be written in parallel.
- T006, T007 (new component tests) and T011, T012 (new component implementations) can all proceed in parallel with each other and with US1/US2 — they touch entirely new files.
- T010, T013, T014 are independent file edits and can run in parallel with each other.

## Implementation Strategy

### MVP First (User Story 2 first, in practice)

Because US1's user-visible fix is delivered inside US3's work (see Revision Note), the first story that is both independently completable *and* independently shippable as a standalone diff is US2 (stale prices after import) — do it first if a true incremental MVP ordering is wanted. Otherwise, implement in listed order (US1 → US2 → US3); the i18n key from US1 sits unused until US3 wires it in, which is harmless.

### Incremental Delivery

1. US1 (T001–T002) → adds the `settings_import_success` key/translations (inert until wired).
2. US2 (T003–T005) → fixes stale prices after import (fully independent, shippable on its own).
3. US3 (T006–T017) → builds `Toast`/`ConfirmDialog`, wires all Settings feedback to them, and — in the same edit — fixes the wrong success-message key. This is where US1's user-visible behavior actually ships.
4. Polish (T018–T020) → coverage, backend sanity check, manual smoke test.

## Notes

- Commit after each user story completes (single-line, conventional-prefixed commits per repo convention) rather than after every individual task.
- Verify T003, T004, T006, T007, T008 fail (or fail to compile, for the ones referencing not-yet-built components) before their corresponding implementation lands, per the constitution's behavior-coverage principle.

## Revision Note (post-`/speckit-analyze`)

An earlier draft of this task list gave US1 its own `handleImportChange` edit (an interim `alert(t.settings_import_success)` fix) with its own test, both immediately superseded a few tasks later by US3's `Toast`-based rewrite of the same function. `/speckit-analyze` flagged this as unnecessary churn (finding E1): since this feature ships as a single PR, not staged releases, there is no value in implementing and then immediately overwriting the same line. The interim task and test were removed; T001/T002 (the i18n key itself) remain under US1 since they're genuinely reusable prep, but the actual behavior change and its test are now scheduled once, under US3 (T008, T015). A second, low-severity finding (E2) — the `reload()` price-fetch and its `didAutoFetchPrices` guard were split into two tasks touching the same few lines — was also merged into one task (T005).

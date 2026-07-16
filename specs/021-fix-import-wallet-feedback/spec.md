# Feature Specification: Import Wallet Feedback & Price Freshness

**Feature Branch**: `fix/import-wallet-feedback` (spec directory `021-fix-import-wallet-feedback`)

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Fix import-wallet messaging and stale state after import (PLAN.md Item 24) — importing a backup shows the 'wallet cleared' success message instead of a dedicated import-success message; export/import/clear-wallet feedback all use native browser alert()/confirm() instead of the app's own UI; and prices for newly-imported holdings don't appear until a manual refresh or page reload."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate import confirmation (Priority: P1)

A user imports a previously exported wallet backup (or one from another device) on the Settings page. After the import completes, they see a message that clearly confirms their wallet was imported — not a message implying their wallet was just cleared.

**Why this priority**: The current message is actively misleading — a successful import currently reports "wallet cleared," which could make a user believe their operations were wiped rather than restored. This is the most user-visible and trust-damaging part of the bug.

**Independent Test**: Import a valid backup file via Settings and confirm the shown message describes an import, not a clear/wipe action.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they select and import a valid backup file, **Then** they see a message confirming the wallet was imported, distinct from the wallet-cleared message.
2. **Given** the user selects a file that is not a valid backup (malformed JSON or missing required fields), **When** the import is attempted, **Then** they see an error message describing the import failed, not the success message.

---

### User Story 2 - Imported holdings show correct prices immediately (Priority: P1)

A user imports a backup that includes a coin their wallet did not previously hold. Immediately after the import finishes, that holding's current market value is shown — without the user needing to click a refresh button or reload the page.

**Why this priority**: Without this, a user's newly imported portfolio appears incomplete or broken (missing values) right after the one action — importing — that was supposed to bring their data in. This directly affects whether the imported data is usable.

**Independent Test**: Import a backup containing at least one coin not already in the wallet, and confirm the Wallet view shows a real price for it without any manual refresh action.

**Acceptance Scenarios**:

1. **Given** a wallet with no existing holdings in a given coin, **When** the user imports a backup that includes operations for that coin, **Then** the Wallet view shows a current market price for that coin immediately after the import completes.
2. **Given** an import backup with no operations (an empty wallet backup), **When** the import completes, **Then** no unnecessary price lookups are attempted and no error is shown for having nothing to price.

---

### User Story 3 - Consistent in-app feedback for data actions (Priority: P2)

A user exports their wallet, imports a backup, or clears their wallet from the Settings page's "Dados"/"Zona de perigo" sections. Every confirmation prompt and success/failure message they see for these actions uses the application's own visual style, matching the rest of Settings — never the browser's native pop-up alert or confirmation dialog.

**Why this priority**: This is a polish/consistency improvement on top of the P1 correctness fixes above — the app already avoids native dialogs elsewhere in Settings, and these three actions are the last holdouts.

**Independent Test**: Trigger export failure, import failure, import success, and the clear-wallet flow (confirm and cancel paths), and confirm none of them ever show a native browser alert/confirm popup.

**Acceptance Scenarios**:

1. **Given** the user clicks "Limpar carteira," **When** the confirmation prompt appears, **Then** it is rendered in the application's own visual style, not a native browser confirmation popup.
2. **Given** the clear-wallet confirmation prompt is open, **When** the user cancels or dismisses it (without confirming), **Then** the wallet data remains fully intact and no message is shown.
3. **Given** the clear-wallet confirmation prompt is open, **When** the user confirms, **Then** the wallet is cleared and a success message is shown in the application's own visual style.
4. **Given** an export or import action fails, **When** the failure occurs, **Then** the resulting error message is shown in the application's own visual style, not a native browser alert.

### Edge Cases

- Import file is valid JSON but not a valid backup shape (e.g. missing an `ops` array) → error message shown, no partial state change.
- Backend rejects the import (e.g. a data constraint violation) → the specific failure reason is shown to the user, not a generic message.
- User dismisses the clear-wallet confirmation via cancel — wallet must remain untouched and no success/error message should appear.
- User imports a backup where every coin is already held (no new coins) — existing behavior (prices already present) must not regress.
- Two feedback messages could be triggered in quick succession (e.g. an import followed immediately by another action) — the most recent message should be the one visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a distinct, accurate confirmation message on a successful import that describes a wallet being imported, never the wallet-cleared message.
- **FR-002**: The system MUST show an error message describing the failure when an import fails (invalid file format or a rejected backend request), distinct from the import-success message.
- **FR-003**: The system MUST show an error message when an export fails.
- **FR-004**: The system MUST require confirmation, presented in the application's own UI (not a native browser dialog), before clearing all wallet data.
- **FR-005**: The system MUST show a success message in the application's own UI after wallet data is cleared, and an error message in the application's own UI if clearing fails.
- **FR-006**: All Settings-page feedback for export, import, and clear-wallet actions (confirmations, success messages, and error messages) MUST use the application's own visual style; none may use a native browser alert or confirm popup.
- **FR-007**: After a successful import, every newly-imported holding MUST display its current market price without requiring a manual price refresh or a page reload.
- **FR-008**: The clear-wallet confirmation MUST be dismissible without performing the destructive action, leaving all wallet data unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful imports display a message describing the import — the wallet-cleared message is never shown for an import.
- **SC-002**: After importing a backup with previously-unheld coins, the Wallet/Profit/History views show correct current prices for those coins with zero additional manual actions from the user.
- **SC-003**: Zero native browser alert/confirm popups appear anywhere in the Settings page's export, import, or clear-wallet flows.
- **SC-004**: Users who cancel the clear-wallet confirmation retain 100% of their existing wallet data.

## Assumptions

- Only the Settings page's export, import, and clear-wallet flows are in scope. Other existing native `alert()` calls elsewhere in the app (e.g. failures adding/editing/deleting a single operation) are a separate, out-of-scope concern.
- No backend/API changes are required — the existing export, import, and clear-wallet endpoints are reused as-is; this is a frontend feedback and data-freshness fix.
- The existing translated strings for the clear-wallet confirmation prompt and its success message continue to be reused as-is; only a new, dedicated import-success message needs to be added.
- This fix is web-only — the mobile app has no equivalent import/export/clear-wallet UI today, so it is unaffected.

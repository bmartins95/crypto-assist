# Feature Specification: History View Redesign with Entry Drawer

**Feature Branch**: `feat/history-view-refactor`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Item 9 — History view redesign with entry drawer (PLAN.md). Redesign the History view (/history) to match the prototype: a content header with a primary Register operation button; a full-width operations table; and a right-side slide-over drawer that replaces the two always-visible forms. The drawer has three modes: Buy, Sell, Trade. Buy/Sell show a single-asset fieldset; Trade shows a two-block swap form (sell block + receive block). Focus trap, Escape-to-close, and body-scroll lock are required."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a Buy or Sell operation via the drawer (Priority: P1)

A user viewing their operation history wants to record a new purchase or sale of an asset without the entry form permanently occupying screen space above the table.

**Why this priority**: This is the core data-entry path that replaces the always-visible forms; without it the view has no way to add data at all.

**Independent Test**: Can be fully tested by opening the drawer, selecting Buy (or Sell), filling the single-asset fieldset, submitting, and confirming exactly one new row appears in the operations table with the correct values.

**Acceptance Scenarios**:

1. **Given** the History view with the drawer closed, **When** the user clicks "Register operation", **Then** the drawer slides in from the right, defaults to Buy mode, and moves keyboard focus to the first field.
2. **Given** the drawer is open in Buy mode with valid date, asset, quantity, and unit price entered, **When** the user submits, **Then** one new operation with `type: 'Buy'` is added to the table, the drawer closes, and focus returns to the "Register operation" button.
3. **Given** the drawer is open, **When** the user switches the type selector to Sell, **Then** the fieldset label updates to reflect the asset being sold and the same fields (date, platform, asset, quantity, unit price, fee, total) remain available.
4. **Given** the drawer is open with required fields incomplete, **When** the user attempts to submit, **Then** submission is blocked and the incomplete fields are indicated — no operation is created.

---

### User Story 2 - Register a Trade (asset swap) via the drawer (Priority: P2)

A user who swapped one asset for another in a single transaction (e.g. traded ETH for SOL) wants to record both legs of the trade in one action.

**Why this priority**: Trades are a distinct, less frequent operation than simple buys/sells, but the two-always-visible-forms design this item replaces is functionally required today — parity must be preserved.

**Independent Test**: Can be fully tested by opening the drawer, selecting Trade, filling the sell block and receive block, submitting, and confirming exactly two new rows appear in the table — one Sell and one Buy — sharing the same date.

**Acceptance Scenarios**:

1. **Given** the drawer is open, **When** the user switches the type selector to Trade, **Then** the single-asset fieldset is replaced by two blocks: "You sell" (asset + quantity) and "You receive" (asset + quantity), plus shared date, platform, fee, and total fields.
2. **Given** the Trade fieldset is fully and validly filled, **When** the user submits, **Then** two operations are created (one `type: 'Sell'` for the source asset, one `type: 'Buy'` for the destination asset) using the same date, and the drawer closes.
3. **Given** the Trade fieldset has the same asset selected for both sell and receive, **When** the user attempts to submit, **Then** submission is blocked with a visible error and no operations are created.

---

### User Story 3 - Edit an existing operation (Priority: P2)

A user notices a mistake in a previously logged operation (wrong quantity, price, or platform) and wants to correct it without deleting and re-creating the entry.

**Why this priority**: Editing is existing functionality (currently via an always-visible form) that must not regress when the forms are replaced by the drawer.

**Independent Test**: Can be fully tested by clicking the edit icon on a table row, confirming the drawer opens pre-filled with that row's values, changing a field, submitting, and confirming the table row reflects the update rather than a duplicate.

**Acceptance Scenarios**:

1. **Given** an existing Buy or Sell operation in the table, **When** the user clicks its edit icon, **Then** the drawer opens in the matching mode (Buy or Sell) with all fields pre-filled from that operation.
2. **Given** the drawer is open in edit mode with a field changed, **When** the user submits, **Then** the existing operation is updated in place (row count unchanged) and the drawer closes.
3. **Given** the drawer is open in edit mode, **When** the user closes the drawer without submitting, **Then** no changes are applied to the operation.

---

### User Story 4 - Dismiss the drawer without side effects (Priority: P3)

A user opens the drawer, changes their mind, and wants a fast, predictable way to back out using the keyboard, a click outside, or an explicit cancel action.

**Why this priority**: Required for accessibility and to match the always-visible-forms' implicit "just don't submit" dismissal, but does not block the primary data-entry flows.

**Independent Test**: Can be fully tested by opening the drawer via each of three paths (Escape key, backdrop click, Cancel button) and confirming the drawer closes each time with no operation created and focus restored to the triggering control.

**Acceptance Scenarios**:

1. **Given** the drawer is open, **When** the user presses Escape, **Then** the drawer closes and no operation is created.
2. **Given** the drawer is open, **When** the user clicks the backdrop outside the drawer panel, **Then** the drawer closes and no operation is created.
3. **Given** the drawer is open, **When** the user clicks "Cancel", **Then** the drawer closes, any in-progress field edits are discarded, and no operation is created.
4. **Given** the drawer is open, **When** the user presses Tab repeatedly, **Then** keyboard focus cycles only among elements inside the drawer and never escapes to the page behind it.
5. **Given** the drawer is open, **When** the user opens it and dismisses it, **Then** the underlying page (table, sidebar) is not scrollable while the drawer is open and becomes scrollable again after it closes.

---

### Edge Cases

- What happens when the operations list is empty? The content header and "Register operation" button still render; the table area shows the existing empty-state message instead of a table.
- What happens if the user opens the drawer, switches from Trade back to Buy/Sell, and had partially filled the Trade fields? Switching modes discards fields not applicable to the newly selected mode; shared fields (date, platform) are preserved.
- What happens if the user opens the drawer to add a new operation while an edit was in progress (edit drawer closed without submitting)? The discarded edit has no effect; opening again for "add" starts from a blank form.
- What happens if required numeric fields contain zero or negative values? Submission is blocked the same way as missing fields.
- What happens if two operations are submitted from a Trade where the fee makes the receive-side total differ from the sell-side total? The existing calculation convention (fee added to the buy leg's total) is preserved unchanged from current behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The History view MUST display a content header with a title, subtitle, and a primary "Register operation" action that opens the entry drawer.
- **FR-002**: The History view MUST display all recorded operations in a full-width table (or the existing empty-state message when there are none) and MUST NOT display any always-visible entry form.
- **FR-003**: The entry drawer MUST offer three mutually exclusive modes — Buy, Sell, Trade — selectable via a visible control inside the drawer, defaulting to Buy when opened for a new entry.
- **FR-004**: In Buy or Sell mode, the drawer MUST present a single-asset fieldset (date, platform, asset, quantity, unit price, fee) with the total computed automatically from quantity and unit price and shown read-only, equivalent in captured data to the current always-visible Buy/Sell form.
- **FR-005**: In Trade mode, the drawer MUST present a two-block fieldset — a "sell" block and a "receive" block, each capturing an asset and quantity — plus shared date, platform, fee, and total fields, equivalent in captured data to the current always-visible trade form.
- **FR-006**: Submitting the drawer in Buy or Sell mode MUST create exactly one operation with the corresponding type.
- **FR-007**: Submitting the drawer in Trade mode MUST create exactly two operations sharing the same date: one Sell (source asset) and one Buy (destination asset), using the same computation rules currently used by the always-visible trade form.
- **FR-008**: The drawer MUST reject submission (without creating or modifying any operation) when required fields are missing, zero/negative where a positive value is required, or when the Trade source and destination assets are identical — and MUST indicate to the user why submission was blocked.
- **FR-009**: Clicking the edit icon on a table row MUST open the drawer in the mode matching that operation's type, with every field pre-filled from the operation's current values.
- **FR-010**: Submitting the drawer while editing an existing operation MUST update that operation in place rather than creating a new one; the operations table row count MUST remain unchanged.
- **FR-011**: The drawer MUST close, discarding any unsaved field changes, when the user presses Escape, clicks the backdrop, or clicks Cancel.
- **FR-012**: While the drawer is open, the underlying page MUST NOT scroll (body-scroll lock), and it MUST become scrollable again once the drawer closes.
- **FR-013**: While the drawer is open, Tab and Shift+Tab navigation MUST remain trapped within the drawer's focusable elements.
- **FR-014**: When the drawer opens, keyboard focus MUST move to the first focusable field inside it; when the drawer closes, focus MUST return to the control that triggered it.
- **FR-015**: The drawer MUST be exposed to assistive technology as a modal dialog (accessible role and label reflecting "Register operation" or "Edit operation").
- **FR-016**: Deleting an operation from the table MUST continue to work as it does today and MUST NOT open the drawer.

### Key Entities

- **Operation (existing)**: A single recorded transaction — date, asset identifier, symbol, name, type (Buy or Sell), quantity, unit price, fee, total, platform. The drawer creates, edits, or leaves these records unchanged; this feature does not alter the entity's shape.
- **Drawer session (new, ephemeral UI state)**: The in-progress form state while the drawer is open — selected mode (Buy/Sell/Trade), field values, and whether it represents a new entry or an edit of an existing operation. Exists only for the lifetime of the drawer being open; discarded on close without submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can register a new Buy or Sell operation in 4 interactions or fewer after opening the drawer (fill fields, submit).
- **SC-002**: A user can register a Trade (both legs) from a single drawer session without navigating away from the History view.
- **SC-003**: 100% of existing Buy/Sell/Trade/edit/delete capabilities available today via the always-visible forms remain available through the drawer, with no loss of functionality.
- **SC-004**: Keyboard-only users can complete the full add-operation flow (open drawer → fill form → submit → drawer closes → focus restored) without a mouse.
- **SC-005**: The History view's initial content (header + table) renders with zero always-visible form fields taking up vertical space above the table.

## Assumptions

- The drawer replaces both always-visible forms found in the current `HistoryTab.tsx`; no functionality is added beyond what those two forms already support (this item is a UI restructuring, not a feature addition).
- "Buy" and "Sell" are the only two simple operation types today, consistent with `Op.type` (`'Buy' | 'Sell'`) established in Item 4; Trade remains a compound operation that produces one of each.
- Coin/asset search behaves the same inside the drawer as it did in the always-visible form. The current unit/total price-entry toggle is replaced by a single unit-price field with an auto-calculated, read-only total, per `docs/design/dashboard-refactor-notes.md` §6.1 — this is the one deliberate behavior change in this redesign, not a hold-over from the old form.
- Visual styling follows `docs/design/dashboard-collapsible-sidebar.html` ("Histórico" view and drawer) and reuses `ContentHeader` and design tokens (`--s-surface`, `--s-border`, etc.) established in items 7–8, per the project's existing pattern-reuse convention.
- Only one drawer instance exists at a time (no support for multiple concurrent drawers or nested drawers).
- Mobile/responsive drawer behavior follows the same patterns already used elsewhere in the web app's dashboard shell (no new responsive breakpoints introduced by this feature).

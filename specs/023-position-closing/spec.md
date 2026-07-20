# Feature Specification: Position Closing, Leverage, and History Day-Grouping

**Feature Branch**: `feat/position-closing` (spec directory `023-position-closing`)

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Item 26 — Position closing, leverage, and history day-grouping (docs/PLAN.md). Today the app has no way to tell whether a buy or sell has been reconciled against a matching counter-operation, so 'realized profit' cannot be trusted — a buy made with money the app never tracked, or a sell never linked back to a buy, are indistinguishable from ordinary reconciled trades. Add an explicit, user-driven way to link a later operation to an earlier one as its full or partial close; support optional leverage (2x/3x/5x/10x) on operations; redesign the History view with day-grouped operations, an open/partial/closed status indicator per row, a 'close' action that pre-fills the operation drawer, an animated bidirectional buy/sell/trade toggle, and a profit/loss indicator both in the drawer and in History. Design reference: docs/design/history-position-closing.html."

## Clarifications

### Session 2026-07-20

- Q: When a single close needs to draw from multiple older open operations, should matching be scoped to the same asset AND same platform, or the same asset regardless of platform? → A: Same asset + platform only — a close never draws from open operations held on a different platform than the one being closed.
- Q: Should the leverage multiplier be selectable on any new (non-closing) operation, or on new Buy operations only? → A: Both Buy and Sell — leverage is available on any brand-new operation that is not itself a close, matching the design reference's literal behavior rather than the plan item's shorthand wording.
- Q: Should closing be restricted to same-currency operation pairs, or should the system convert across currencies? → A: Same currency only — closing across currencies is rejected; no exchange-rate conversion is introduced by this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Close an open position, fully or partially (Priority: P1)

A user has an open buy (crypto purchased with money the app never tracked as a prior sale) sitting in their History. They decide to sell part or all of it. They click a "close" action on that row, and the operation drawer opens already aimed at recording the counter-operation, with the asset, platform, and outstanding quantity pre-filled from the row they clicked. They adjust the quantity and price if needed and submit. The original row's status updates immediately to reflect how much of it is still open.

**Why this priority**: This is the core problem statement — without an explicit way to record that operation A settles operation B, "realized profit" is meaningless. Everything else in this feature exists to support or surface this action.

**Independent Test**: Register a buy with no prior context, click its close action, submit a sell for the full quantity, and confirm the buy's status changes to "closed" and a realized profit/loss figure appears on both rows. Repeat with a partial quantity and confirm the status becomes "partial" instead, with the remaining quantity still closeable.

**Acceptance Scenarios**:

1. **Given** an open buy row, **When** the user clicks its close action, **Then** the drawer opens with the asset, platform, and outstanding quantity from that row pre-filled, and a banner confirms which position is being closed.
2. **Given** the close drawer is open for a buy, **When** the user submits a sell for the row's full outstanding quantity, **Then** the row's status becomes "closed" and a realized profit/loss value is recorded and displayed for that close.
3. **Given** the close drawer is open for a buy, **When** the user submits a sell for less than the row's full outstanding quantity, **Then** the row's status becomes "partial", its outstanding quantity decreases by the closed amount, and it remains closeable for the remainder.
4. **Given** an open sell row (a sale not yet linked to any buy), **When** the user clicks its close action, **Then** the drawer opens ready to record a buy (or a trade) that closes it, symmetric to the buy case.
5. **Given** a row whose outstanding quantity has already reached zero, **When** the user views that row, **Then** no close action is shown for it.

---

### User Story 2 - See position status and profit/loss at a glance (Priority: P1)

A user opens the History view and, without clicking into anything, can immediately tell which operations are fully settled, which are partially settled, and which are still fully open — plus what profit or loss each closed or partially-closed operation has realized so far.

**Why this priority**: The status indicator is what makes the closing mechanism (Story 1) visible and trustworthy day to day; without it, users have no reason to believe the linking model is working.

**Independent Test**: With a mix of untouched, partially-closed, and fully-closed operations in History, confirm each row shows the correct status label and that closed/partial rows show a realized profit/loss figure while fully open rows show a neutral placeholder instead of a number.

**Acceptance Scenarios**:

1. **Given** an operation with no closures recorded against it, **When** it is shown in History, **Then** its status reads "open" and no profit/loss figure is shown for it.
2. **Given** an operation partially closed by one or more later operations, **When** it is shown in History, **Then** its status reads "partial" and it shows the realized profit/loss from the closures recorded so far.
3. **Given** an operation fully closed, **When** it is shown in History, **Then** its status reads "closed" and it shows its final realized profit/loss.
4. **Given** a closing operation itself (the later leg that closed something else), **When** it is shown in History, **Then** it also displays the realized profit/loss produced by that close.

---

### User Story 3 - Record an optional leverage multiplier on a new operation (Priority: P2)

A user registering a brand-new buy or sell operation (not a close) wants to record that it was a leveraged position (2x, 3x, 5x, or 10x) rather than a plain spot operation, so their History reflects the actual exposure taken.

**Why this priority**: Independently useful and independently testable without touching the closing mechanism, but secondary to the core linking problem.

**Independent Test**: Register a new buy, select a leverage multiplier, submit, and confirm the operation's row in History displays the chosen multiplier as a badge next to its type. Repeat for a new sell.

**Acceptance Scenarios**:

1. **Given** the drawer is open for a brand-new buy or sell (not a close), **When** the user selects a leverage multiplier, **Then** that choice is visually confirmed before submission.
2. **Given** a buy or sell submitted with a leverage multiplier, **When** it appears in History, **Then** its row shows a distinct badge naming the multiplier (e.g. "3x").
3. **Given** the user does not select a multiplier, **When** the operation is submitted, **Then** no leverage badge appears on that row (plain spot position).
4. **Given** the drawer is open specifically to close an existing position, **When** the user views the form, **Then** no leverage control is offered (leverage is set only when a position is first opened, not when it is closed), regardless of whether the closing operation is a buy or a sell.

---

### User Story 4 - Switch trade direction with an animated toggle (Priority: P2)

A user recording a trade (swapping one asset for another) wants to flip which side they're selling from and which side they're receiving into with a single click, and see a smooth transition rather than an abrupt jump between the buy, sell, and trade layouts.

**Why this priority**: A usability refinement to the existing drawer, valuable on its own regardless of the closing feature, but not blocking core functionality.

**Independent Test**: Open the drawer for a new operation, switch between Buy, Sell, and Trade tabs, and confirm each switch animates the panel content rather than swapping it instantly, and that data entered in one tab does not leak into another.

**Acceptance Scenarios**:

1. **Given** the drawer is open for a new (non-closing) operation, **When** the user clicks a different type tab, **Then** all three types (Buy, Sell, Trade) are available and the panel transitions with a visible slide/fade animation.
2. **Given** the drawer is open to close a buy, **When** the user views the available type tabs, **Then** only Sell and Trade are offered (Buy is not, since a buy cannot close another buy).
3. **Given** the drawer is open to close a sell, **When** the user views the available type tabs, **Then** only Buy and Trade are offered.
4. **Given** the user is mid-animation between two tabs, **When** they click another tab before the animation finishes, **Then** the interaction is ignored or queued rather than producing a broken intermediate state.

---

### User Story 5 - Operations grouped by day (Priority: P3)

A user scanning their History sees operations visually separated into sections by the day they occurred, rather than a single undifferentiated list.

**Why this priority**: A readability improvement independent of the other stories — valuable on its own, lowest priority since it doesn't change any data or capability.

**Independent Test**: With operations spanning multiple distinct days, confirm History renders a date-section header above each day's operations and that operations from the same day are visually grouped under one header.

**Acceptance Scenarios**:

1. **Given** operations recorded across three different days, **When** History is viewed, **Then** three date-section headers appear, each followed only by that day's operations.
2. **Given** multiple operations recorded on the same day, **When** History is viewed, **Then** they appear together under a single shared header, in a sensible order within the day.

### Edge Cases

- A user tries to close more quantity than a row has outstanding — the system must reject or cap the request rather than allowing the row to go negative or silently overshoot.
- A user attempts to close an operation using a counter-operation recorded in a different currency, or on a different platform, than the operation being closed — the system must reject the close rather than silently mixing currencies or platforms in the realized profit/loss calculation.
- Closing a quantity larger than the clicked row's own outstanding amount, when the user has other open positions in the same asset and platform, must be able to draw from those older open positions automatically rather than failing outright.
- A position is closed via a Trade (its sell leg closes the row; its buy leg opens a brand-new, separate position) — the new leg must start "open," not inherit any status from the row being closed.
- A user deletes an operation that has closures recorded against it (either as the source or as the closing leg) — the outstanding-quantity and status of any op still referencing it must not be left in an inconsistent state.
- Two operations on the same day, one of which closes the other — both must still render correctly within the same day's group, in an order that makes the close relationship legible (the closing operation after the one it closes).
- A brand-new plain buy or sell (created via "+ Registrar operação", not via a close action) is never auto-linked to any other operation — it starts fully open, exactly like every other operation, until a user explicitly closes it or uses it to close something else.
- Editing an operation that already has a closure recorded against it (either as a source or as a closing leg) is out of scope for this feature and must be prevented or clearly disallowed rather than silently corrupting the linkage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to record that a given operation (fully or partially) closes an earlier, still-open operation of the opposite type (a sell closing a buy, or a buy closing a sell) for the same asset.
- **FR-002**: The system MUST derive and display, for every buy or sell operation, one of three statuses: "open" (no closures recorded against it), "partial" (some but not all of its quantity has been closed), or "closed" (all of its quantity has been closed).
- **FR-003**: The system MUST NOT automatically link any operation to another — every close is an explicit action the user takes; a plain buy or sell always starts "open" regardless of whether a matching counter-operation exists elsewhere in the user's history.
- **FR-004**: History MUST offer a "close" action on every row whose status is "open" or "partial", and MUST NOT offer it on rows whose status is "closed".
- **FR-005**: Clicking a row's close action MUST open the operation drawer pre-filled with that row's asset, platform, and outstanding (not-yet-closed) quantity, and MUST clearly indicate that the drawer is in closing mode for that specific position.
- **FR-006**: When the drawer is in closing mode, it MUST restrict the selectable operation type to only those types capable of closing the row in question (a sell or a trade for closing a buy; a buy or a trade for closing a sell) — the type that matches the row's own type MUST NOT be offered.
- **FR-007**: Submitting a close MUST create the new counter-operation, record the closure link and the resulting realized profit/loss, and update the outstanding quantity and status of every affected row without requiring a page reload.
- **FR-008**: If the quantity being closed exceeds the outstanding quantity of the single row the user clicked from, the system MUST be able to draw the remainder from the user's other open operations of the same asset and platform, oldest first, rather than rejecting the request outright.
- **FR-009**: The system MUST reject an attempt to close more quantity than is currently outstanding across all eligible open operations for that asset and platform.
- **FR-009a**: The system MUST reject an attempt to close an operation using a counter-operation recorded in a different currency; eligible open operations for a close are limited to the same asset, same platform, and same currency as each other.
- **FR-010**: The system MUST display, for every operation with at least one closure recorded (as either the source or the closing leg), the realized profit/loss associated with it, both in the History row and in the drawer when relevant (e.g. while composing a close).
- **FR-011**: The system MUST display no profit/loss figure (a neutral placeholder) for operations with zero closures recorded.
- **FR-012**: The system MUST allow an optional leverage multiplier (2x, 3x, 5x, or 10x) to be set when registering any brand-new buy or sell operation (not when closing an existing position), and MUST persist and display that choice on the operation's row as a distinct badge.
- **FR-013**: An operation submitted without selecting a leverage multiplier MUST be treated as an unleveraged (1x) position and MUST NOT display a leverage badge.
- **FR-014**: The drawer MUST support switching between Buy, Sell, and Trade operation types via a single control, animating the transition between each type's layout rather than swapping instantly.
- **FR-015**: For a Trade operation being used to close an existing position, the leg matching the row's opposite type MUST be pre-filled from that row (asset, platform, quantity), and the other leg MUST represent a brand-new, independently open position with no inherited status.
- **FR-016**: The History view MUST group operations by the calendar day they occurred, showing a date-section header above each day's group, instead of a single undifferentiated list.
- **FR-017**: All new user-facing labels introduced by this feature (status names, the close action, leverage badges, profit/loss captions) MUST be delivered through the application's existing i18n layer, translated for every supported locale, not hardcoded in one language.
- **FR-018**: Deleting an operation that has one or more closure links recorded against it (as source or as closing leg) MUST be handled explicitly (e.g. by also removing the dependent closure records and recomputing affected statuses) rather than leaving other operations referencing a deleted, nonexistent link.
- **FR-019**: Editing an operation that already has a closure link recorded against it MUST be prevented or clearly disallowed, since altering its quantity or price after a close would invalidate the already-recorded realized profit/loss.

### Key Entities

- **Operation (existing)**: A single recorded buy or sell (or one leg of a trade) — asset, platform, quantity, price, date. Already exists in the system; this feature adds status and, for buys, an optional leverage multiplier to it.
- **Position status**: A derived state — open, partial, or closed — computed from how much of an operation's quantity has been accounted for by closure links referencing it.
- **Closure link**: A record that a specific later operation closes a specific earlier operation, for a specific quantity, producing a specific realized profit/loss frozen at the time the link was created. One operation may have multiple closure links against it (partial closes over time, or a single close spanning multiple older open operations).
- **Leverage multiplier**: An optional attribute of a buy operation (2x, 3x, 5x, or 10x) recorded at creation time, displayed as a badge; not applicable to closing operations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every operation in History displays a status (open, partial, or closed) that a user can identify without opening any row.
- **SC-002**: A user can fully close an open position in three interactions or fewer: click the close action, confirm/adjust the pre-filled quantity and price, submit.
- **SC-003**: 100% of operations with at least one recorded closure display a realized profit/loss figure; 0% of operations with no closures display a non-placeholder profit/loss figure.
- **SC-004**: A user attempting to close more than the currently outstanding quantity for an asset/platform is blocked from doing so, with no possibility of a position's outstanding quantity going negative.
- **SC-005**: Users can distinguish, at a glance, operations from different days in History, with 0% of operations left ungrouped.
- **SC-006**: Switching operation type in the drawer never produces a jarring instant swap — 100% of type switches animate.

## Assumptions

- This feature is additive to the existing operation-recording flow, not a replacement: plain buys and sells created via "+ Registrar operação" continue to work exactly as before and simply start "open" with no closure links, matching the existing behavior of every operation recorded before this feature shipped.
- The existing Profit tab's portfolio-wide average-cost engine is unmodified by this feature. The realized profit/loss shown in History comes solely from explicit closure links — a separate, per-position view of profit/loss that sits alongside the existing portfolio-level Profit tab; the two are not required to reconcile with each other. Leverage is stored and displayed only; feeding it into the Profit tab's P/L math is an explicit follow-up, not part of this feature (mirrors the "Done when" scoping already written in docs/PLAN.md's Item 26).
- Per the design reference, clicking "close" on a row defaults to opening the drawer on the opposite simple operation type (Sell for closing a Buy, Buy for closing a Sell) rather than always defaulting to the Trade tab; Trade remains available as an alternative when the user wants to close via a swap into a different asset. This refines the plan item's original informal description.
- Retroactively linking two operations that were both already recorded independently (i.e., without ever having gone through the "close" action at the time one of them was created) is out of scope — every closure link is created at the same time as its closing operation, never applied after the fact between two pre-existing rows.
- Leverage applies to any brand-new, non-closing buy or sell operation (matching the design reference's literal behavior, resolved during clarification); closing operations never carry their own leverage value regardless of type.
- A close's eligible source operations are scoped to the same asset, same platform, and same currency as the closing operation (resolved during clarification) — a close never spans platforms or converts between currencies, even when the user's other open holdings for the same asset exist elsewhere.
- This is a web-only redesign of the History view and its drawer. Per this repo's mobile-parity rule, mobile has no equivalent History screen with a drawer today, so it is unaffected; any shared-type changes (new status/closure/leverage fields) must not break the mobile type contract even though mobile has no UI consuming them yet.
- Closing a position updates and displays profit/loss in the currency the underlying operations were recorded in, consistent with how amounts are already displayed elsewhere in the app; no new currency-conversion behavior is introduced by this feature.

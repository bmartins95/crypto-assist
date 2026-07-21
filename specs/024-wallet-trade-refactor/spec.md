# Feature Specification: Wallet vs. Trade Operation Refactor

**Feature Branch**: `feat/wallet-trade-refactor`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Item 28 from docs/PLAN.md — wallet vs. trade operation refactor. Split wallet movement (Buy/Sell/Swap of assets the user holds) from speculative trades (leveraged long/short positions), currently mixed into the same History flow and the same per-operation Open/Partial/Closed status. Design references: docs/design/wallet-trade-refactor-handoff.md (22 product-owner-approved requirements) and docs/design/wallet-trade-refactor-wireframes.html. Builds on item 26 (position closing, leverage, day-grouped History) and folds in item 27 (cycle tag + floating summary), rescoped to trade positions only."

## Clarifications

### Session 2026-07-21

- Q: Should trade (leveraged) positions be included in the Wallet/Profit views' portfolio value and P/L calculations, or excluded since they don't represent real held assets? → A: Excluded — trade positions never contribute to Wallet (holdings) or Profit (P&L) view calculations; those views only ever reflect wallet-kind operations.
- Q: Existing operations may already have closure records from before this feature (Item 26 allowed closing any Buy/Sell, not just leveraged ones) that will now be reclassified as wallet operations. Should those legacy closure records be left in place (inert) or cleaned up? → A: Cleaned up — the migration deletes any closure record that references an operation reclassified as wallet, rather than leaving orphaned/unused rows behind.
- Q: Can an operation's classification (wallet vs. trade) be changed after creation via the edit action? → A: No — classification is fixed permanently at creation; editing can change an operation's details but never its wallet/trade classification or a trade's direction.
- Q: Should the edit/delete recompute-and-confirm protection (User Story 5) apply only to a wallet Buy, or to any wallet operation (Buy, Sell, or Swap) that later balances depend on? → A: Uniformly to any wallet operation (Buy, Sell, or either side of a Swap) whose change affects a later operation's derived balance/cost.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Wallet operations no longer carry a confusing trade status (Priority: P1)

A user records a plain purchase or sale of an asset they hold (or swaps one held asset for another). Today every such operation shows an Open/Partial/Closed status and a "close" action, which makes no sense for a simple wallet movement — there is nothing to "close." The user should see wallet operations as what they are: movements of holdings, with no status and no close action, while sells and swaps are validated against and computed from what the user actually holds.

**Why this priority**: This is the core problem statement — the status/close mechanics being applied to every operation regardless of type is the confusing behavior the whole refactor exists to fix. It delivers value on its own even before trade positions are addressed.

**Independent Test**: Can be fully tested by recording a Buy, then a Sell of part of that balance, then a Swap of the remainder to another asset, and confirming History shows no status/close action on any of the three rows, the Sell shows a realized profit/loss figure, and the Swap collapses into a single row showing the asset and platform change.

**Acceptance Scenarios**:

1. **Given** a user has no prior operations for an asset, **When** they open the wallet panel's Sell or Swap tab for that asset/platform pair, **Then** the available balance shown is zero and no quantity greater than zero can be submitted.
2. **Given** a user holds 5 units of an asset on a platform bought at an average cost, **When** they open the Sell tab for that asset/platform, **Then** the panel shows the available balance and average cost, and a "Max" action fills the quantity field with the full available balance.
3. **Given** a user is selling part of a held balance, **When** they enter a sale price different from the average cost, **Then** an estimated profit/loss figure updates live as they type, computed against the average cost.
4. **Given** a user submits a Sell for more than their available balance, **When** they attempt to submit, **Then** the system blocks the submission with a clear message.
5. **Given** a completed Buy, Sell, or Swap (wallet) operation, **When** viewed in the History table, **Then** it shows no status indicator and no close action.
6. **Given** a completed wallet Sell, **When** viewed in the History table, **Then** its row shows the realized profit or loss versus the asset's average purchase cost, colored positive or negative.
7. **Given** a completed Swap between two assets and/or platforms, **When** viewed in the History table, **Then** it appears as a single row showing both assets and quantities (e.g. "ETH→SOL", "0.5→22"), not two separate rows.

---

### User Story 2 - Open a leveraged trade position independent of wallet holdings (Priority: P2)

A user wants to speculate on an asset's price movement using leverage, in either direction (long or short), without that action touching their actual wallet balance and without needing to already hold the asset (a short does not require ownership). Today, opening such a position is not clearly separated from a plain wallet purchase.

**Why this priority**: This is the second half of the split — without it, the "trade" side of the concept has no dedicated, unambiguous entry point.

**Independent Test**: Can be fully tested by opening a new trade for an asset the user does not currently hold, selecting Short, choosing a leverage multiplier, and confirming the position is created with an Open status, a leverage badge, and no change to the user's wallet balance for that asset.

**Acceptance Scenarios**:

1. **Given** a user opens the "New trade" entry point, **When** the panel opens, **Then** it offers exactly two directional options (long via Buy, short via Sell) and a leverage multiplier selector, with no wallet balance shown or required.
2. **Given** a user selects Short for an asset they do not hold any quantity of, **When** they submit, **Then** the trade is created successfully with no balance validation.
3. **Given** a user submits a new trade, **When** it is created, **Then** it appears in History with an Open status, the chosen leverage badge, and a visual marker distinguishing it from wallet rows, and the user's wallet balance for that asset is unchanged.

---

### User Story 3 - Close an open or partial trade position (Priority: P3)

A user who has an open or partially-closed leveraged position wants to close all or part of it. The closing action should not ask them to choose a type — a short can only be closed by buying, a long only by selling — and should show them the resulting profit or loss before they confirm.

**Why this priority**: Completes the trade lifecycle; without it, User Story 2's positions could never be resolved.

**Independent Test**: Can be fully tested by opening a leveraged short position, then using its close action to close half the quantity, confirming the position becomes Partial with a realized profit/loss figure, then closing the remainder and confirming it becomes Closed.

**Acceptance Scenarios**:

1. **Given** an Open or Partial trade position, **When** the user triggers its close action, **Then** the panel opens with the closing type locked (not user-selectable) to whichever type resolves that position, shows the position's context (asset, direction, leverage, platform, remaining quantity), and defaults the quantity to the full remaining amount with an "all" shortcut.
2. **Given** the close panel is open, **When** the user changes the quantity or price, **Then** an estimated profit/loss for that closing amount updates live, with the sign appropriate to the position's direction.
3. **Given** a user closes less than the full remaining quantity, **When** the close is submitted, **Then** the position's status becomes Partial and the closed amount is no longer available to close again, while the remainder still shows a close action.
4. **Given** a user closes exactly the full remaining quantity, **When** the close is submitted, **Then** the position's status becomes Closed and no further close action is offered on it.
5. **Given** a Closed trade position, **When** viewed in History, **Then** no close action is available.

---

### User Story 4 - See a trade position's full history from any of its rows (Priority: P4)

A user looking at any row belonging to a trade position — its entry or any of its partial closes — wants to see the whole story (entry, every exit, what's left, and the total realized result) without hunting across the table.

**Why this priority**: Valuable but not required for the wallet/trade split itself to function; it is a discoverability improvement layered on top of User Stories 2–3.

**Independent Test**: Can be fully tested by opening a trade position, partially closing it twice, and confirming that interacting with any of the three resulting rows opens the same summary showing the entry, both partial closes, the remaining open quantity, and the total realized profit/loss.

**Acceptance Scenarios**:

1. **Given** a trade position with one or more closes recorded against it, **When** the user interacts with (hovers, or taps on a touch device) any row belonging to that position, **Then** a summary appears listing the entry, every close, any remaining open quantity, and the total realized result.
2. **Given** a wallet (non-trade) operation, **When** the user interacts with its row, **Then** no such summary is offered — the feature only applies to trade positions.
3. **Given** a trade position that is fully closed, **When** its summary is viewed, **Then** it is marked as closed rather than partial.

---

### User Story 5 - Editing or deleting a past wallet operation keeps later ones honest (Priority: P5)

A user edits or deletes a wallet operation (Buy, Sell, or Swap) that has already had later operations' balance or cost drawn against it (via the first-in-first-out matching that determines balance and average cost). The system must not let this silently corrupt the picture: it recomputes affected figures, warns the user when the change affects later recorded operations, and refuses a change that would leave a negative balance at any point in the history.

**Why this priority**: An important correctness safeguard, but it only matters once User Story 1's FIFO-based wallet accounting exists, and its absence does not block the primary wallet/trade split from shipping and being useful.

**Independent Test**: Can be fully tested by buying an asset, selling part of it, then attempting to edit the original buy's quantity down below what the recorded sell consumed, and confirming the system blocks the change; then attempting a smaller edit that still leaves a valid balance and confirming a confirmation dialog appears describing the affected later operations before the change is applied. Also verifiable by editing a Swap's "you give up" side that a later sell depends on, confirming the same protection applies.

**Acceptance Scenarios**:

1. **Given** a wallet operation with no later operations depending on its balance/cost, **When** the user edits or deletes it, **Then** no special warning is shown (existing edit/delete behavior applies).
2. **Given** a wallet Buy, Sell, or Swap with later operations depending on its balance/cost, **When** the user edits a value that changes the available quantity or cost, **Then** a confirmation dialog explains how many later operations are affected before the change is applied.
3. **Given** an edit or delete that would cause a negative balance on any date after it, **When** the user attempts to confirm it, **Then** the system blocks the change and explains why.

---

### Edge Cases

- What happens when a user tries to close a trade position for more than its remaining open quantity? The system must block it, matching the existing over-close protection trade positions already have.
- What happens to a trade position opened before this feature shipped (under the old model where any operation could carry a status)? It must be correctly identified as a trade (not a wallet operation) if it was leveraged, and continue showing its existing status and history correctly.
- What happens to a plain, non-leveraged operation that — under the previous behavior — already has a closing operation linked to it? It must stop being treated as closable going forward and must not show a stale status; its historical existence must not corrupt the wallet balance/average-cost calculation for that asset.
- What happens when a wallet Swap's destination platform is left blank? It defaults to the same platform as the source (a same-platform asset conversion).
- What happens when a user switches tabs mid-entry in the wallet or trade panel? Already-filled fields that apply to both tabs (e.g. date, platform) are preserved rather than cleared.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The History view MUST offer two distinct entry points for recording a new operation: one for wallet movement, one for opening a new trade.
- **FR-002**: The wallet entry point MUST offer three operation types: Buy, Sell, and Swap. It MUST NOT offer a leverage option.
- **FR-003**: For a wallet Sell or Swap, the system MUST show the user's currently available balance and average cost for the selected asset/platform, and MUST offer a one-action way to fill the quantity with the full available balance.
- **FR-004**: The system MUST prevent a wallet Sell or Swap quantity greater than the available balance for that asset/platform.
- **FR-005**: For a wallet Sell, the system MUST show a live-updating estimated profit/loss versus the average cost as the user changes quantity or price.
- **FR-006**: For a wallet Swap, the system MUST NOT show a profit/loss figure; the received asset's cost basis is inherited from the asset given up.
- **FR-007**: A wallet Swap's destination platform MUST default to the source platform when left unspecified.
- **FR-008**: Wallet operations (Buy, Sell, Swap) MUST NOT display a status indicator or a close action in the History table.
- **FR-009**: A completed wallet Sell MUST display its realized profit/loss (versus average cost, using first-in-first-out matching of prior purchases of that asset/platform) in the History table.
- **FR-010**: A completed wallet Swap MUST display as a single combined row in the History table showing both assets and both quantities, not as two separate rows.
- **FR-011**: The trade entry point MUST offer exactly two directional options (a long via Buy, a short via Sell) and a leverage multiplier selection.
- **FR-012**: Opening a trade MUST NOT validate or change the user's wallet balance for the underlying asset, including for a short position in an asset the user does not hold.
- **FR-013**: A newly opened trade MUST be created with an Open status and MUST display its leverage and direction (long/short) in the History table, visually distinguished from wallet rows.
- **FR-014**: The system MUST offer a close action only on trade positions that are Open or Partial, never on wallet operations and never on a Closed trade position.
- **FR-015**: A trade position's close panel MUST lock the closing operation type to whichever type resolves that position's direction (a short closes only via Buy, a long only via Sell) — the user MUST NOT be offered a choice.
- **FR-016**: A trade position's close panel MUST show the position's context (asset, direction, leverage, platform, remaining open quantity) and default the closing quantity to the full remaining amount, with a one-action way to select it.
- **FR-017**: A trade position's close panel MUST show a live-updating estimated profit/loss for the amount being closed, with its sign appropriate to the position's direction (long vs. short) and scaled by the position's leverage.
- **FR-018**: Closing less than a trade position's full remaining quantity MUST set its status to Partial; closing the full remaining quantity MUST set it to Closed. The system MUST reject an attempt to close more than the remaining open quantity.
- **FR-019**: The system MUST offer a way to view a trade position's full history (its entry, every close against it, remaining open quantity if any, and total realized profit/loss) by interacting with any row belonging to that position. This MUST NOT be offered for wallet operations.
- **FR-020**: Editing or deleting any wallet operation (Buy, Sell, or Swap) that has later operations depending on its balance or cost (via first-in-first-out matching) MUST recompute those later operations' derived figures and MUST show the user a confirmation describing what is affected before applying the change.
- **FR-021**: The system MUST block an edit or delete of any wallet operation if it would result in a negative balance at any point in the operation history that follows it.
- **FR-022**: Operations recorded before this feature shipped MUST be correctly classified: any operation with a leverage multiplier greater than 1x becomes a trade (direction derived from its Buy/Sell type), preserving its existing status and close history; every other pre-existing operation becomes a wallet operation with no status shown going forward.
- **FR-023**: Trade positions MUST be excluded from the existing Wallet (holdings) and Profit (P&L) views' calculations — those views MUST reflect wallet-kind operations only, so a trade position never inflates or distorts a user's actual portfolio value or realized/unrealized profit figures.
- **FR-024**: The migration that classifies pre-existing operations MUST remove any closure record that references an operation being reclassified as wallet (a record from before this feature, when any operation could be closed) — no orphaned closure record may remain for a wallet-classified operation.
- **FR-025**: An operation's classification (wallet or trade) and, for a trade, its direction (long/short), MUST be fixed at creation and MUST NOT be changeable via the edit action; edits may change other details (price, quantity, platform, date, etc.) without altering classification or direction.

### Key Entities

- **Operation**: A recorded Buy, Sell, or Swap. Gains a classification of either "wallet" (movement of held assets) or "trade" (leveraged speculative position); trade operations additionally carry a direction (long/short) and a leverage multiplier.
- **Wallet balance**: A derived (not separately stored) figure per asset/platform — available quantity and average cost — computed from the user's wallet Buy/Sell/Swap history using first-in-first-out matching.
- **Trade position**: A trade-classified operation together with zero or more later trade operations that close it (fully or partially) against it, carrying a status (Open, Partial, Closed) and a realized profit/loss for each closing portion. Trade positions are never counted toward portfolio holdings or profit/loss in the Wallet or Profit views.
- **Trade position summary**: A read-only, derived view of a trade position's entry, all of its closes, remaining open quantity, and total realized profit/loss.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user viewing the History table can, without opening any row, distinguish every wallet operation from every trade position at a glance.
- **SC-002**: 100% of attempts to sell or swap more than the currently available balance of an asset/platform are prevented before submission.
- **SC-003**: A user can open a leveraged short position in an asset with zero held balance, successfully, every time.
- **SC-004**: A trade position's status and realized profit/loss reflect a submitted close within the same interaction, with no page reload required.
- **SC-005**: A user can see a trade position's complete entry-to-exit history from a single interaction with any of its rows, in under 2 seconds.
- **SC-006**: An edit or delete of any wallet operation that would produce a negative historical balance is blocked before it is applied, 100% of the time.

## Assumptions

- Migrating a pre-existing operation's classification is based solely on whether its leverage multiplier is greater than 1x — no separate manual reclassification step is offered to users.
- Any pre-existing closure record referencing an operation that gets reclassified as "wallet" under this feature is removed as part of the migration (see Clarifications) — wallet figures going forward are derived purely from first-in-first-out matching, with no legacy closure data involved.
- The "Swap" operation type is a rename/relabel of the existing cross-asset/cross-platform trade type available in the wallet flow today; its underlying behavior (two linked legs) is unchanged, only its display as a single History row and its exclusion from trade-position status are new.
- Trade positions opened under this feature always have exactly one entry operation; the rare case of multiple entries sharing one position (a pre-existing data shape from before this feature) is preserved for viewing but is not a flow a user can newly create.
- "Current market price" quick-fill behavior for price fields, and the day-grouping of the History table, are unchanged by this feature and are out of scope.

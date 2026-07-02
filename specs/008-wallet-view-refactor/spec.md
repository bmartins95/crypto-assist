# Feature Specification: Wallet View Redesign

**Feature Branch**: `feat/wallet-view-refactor`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "PLAN.md Item 7 — Wallet view redesign: redesign the Wallet view (/wallet) to match the prototype — a content header with title, subtitle, and a refresh button; four metric cards (Invested, Current value, P/L, Return) driven by computePositions; a segmented view toggle (By asset / By platform / Asset + platform); and an improved holdings table with coin image, name, ticker, and tabular-nums alignment. Reuse the sidebar shell from item 6. Create reusable MetricCard and ContentHeader components (also for future Profit/History views). Design reference: docs/design/dashboard-collapsible-sidebar.html \"Carteira\" view."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See portfolio health at a glance (Priority: P1)

A signed-in user opens the Wallet view and immediately sees a page title, a short subtitle explaining the data source, and four summary cards — Invested, Current value, Profit/Loss, and Return — that reflect their current holdings without any extra clicks.

**Why this priority**: The metric cards are the primary value of the redesign — a user should never have to scan a table to know whether they're up or down.

**Independent Test**: Sign in with a wallet that has operations, open `/wallet`, and confirm the four cards show values consistent with the current holdings table totals (invested, current value, profit/loss colored red or green appropriately, and return percentage).

**Acceptance Scenarios**:

1. **Given** a wallet with open positions and known prices, **When** the user opens `/wallet`, **Then** the Invested and Current value cards show the sum of the holdings, the P/L card shows the difference colored green when positive and red when negative, and the Return card shows the percentage with the same color rule.
2. **Given** a wallet with positions but no price data yet, **When** the user opens `/wallet`, **Then** the Current value, P/L, and Return cards show a neutral placeholder instead of a misleading zero.
3. **Given** an empty wallet (no operations), **When** the user opens `/wallet`, **Then** the empty state is shown and no metric cards or table are rendered.

---

### User Story 2 - Refresh prices from the view header (Priority: P2)

A user wants to know how fresh the displayed prices are and refresh them without leaving the Wallet view. A content header shows the view title, a subtitle, a last-updated indicator, and a refresh action.

**Why this priority**: Price freshness materially affects trust in the numbers shown; this replaces the previous inline status text with a clearer, consistently placed control.

**Independent Test**: Open `/wallet`, note the last-updated indicator, click the refresh action, and confirm the indicator updates and the holdings/metric values reflect the new prices.

**Acceptance Scenarios**:

1. **Given** the Wallet view is open, **When** prices have just loaded, **Then** the header shows a last-updated time.
2. **Given** the Wallet view is open, **When** the user clicks the refresh action, **Then** prices are re-fetched and the last-updated time advances; the four metric cards and the table update with any new values.
3. **Given** a refresh fails (e.g. rate limited), **When** the fetch completes, **Then** the header shows a message explaining the failure instead of a stale success timestamp.

---

### User Story 3 - Compare holdings by asset, platform, or both (Priority: P3)

A user with assets spread across multiple platforms switches between three groupings — by asset, by platform, or by asset and platform combined — to answer different questions ("what do I hold in total?" vs "what's on this exchange?").

**Why this priority**: This is existing functionality being preserved and restyled, not new capability — lower priority than the visual/metric overhaul.

**Independent Test**: With a wallet holding the same asset on two platforms, switch each of the three view modes and confirm the table regroups accordingly, matching the totals shown in the metric cards.

**Acceptance Scenarios**:

1. **Given** the "By asset" view is active, **When** the user selects "By platform", **Then** the table regroups rows by platform, aggregating quantities/values across assets held on each platform.
2. **Given** the "By platform" view is active, **When** the user selects "Asset + platform", **Then** the table shows one row per asset-per-platform combination, grouped under platform headings.
3. **Given** any view mode, **When** the user selects "By asset", **Then** the table returns to one row per asset with a coin image, name, and ticker, plus an editable exit-price target.

---

### Edge Cases

- Coin has no cached image: the table shows a colored initials badge instead of a broken image.
- An asset's current price is unknown (not yet fetched): its row shows a neutral dash for current value, P/L, and return instead of `0`.
- Very large or very small numeric values: all numeric table cells and metric card values remain aligned using tabular figures.
- Balances-hidden preference is active (from Settings): all monetary metric card and table values are masked, consistent with the rest of the app.
- Long asset or platform names: table cells truncate without breaking row height or column alignment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Wallet view MUST show a content header with the view title, a subtitle describing the price data source, a last-updated indicator, and a refresh action, reusing a shared header component also usable by other views.
- **FR-002**: The Wallet view MUST show four metric cards — Invested, Current value, Profit/Loss, Return — computed from the user's current positions, using a shared metric-card component also usable by other views.
- **FR-003**: The Profit/Loss and Return metric cards MUST be visually distinguished as positive (gain) or negative (loss) using the app's existing color convention.
- **FR-004**: When current price data is unavailable for the whole wallet, the Current value, Profit/Loss, and Return metric cards MUST show a neutral placeholder rather than a numeric zero.
- **FR-005**: The Wallet view MUST retain the existing three-way grouping toggle (by asset, by platform, by asset and platform) and its current aggregation behavior.
- **FR-006**: The holdings table (by-asset mode) MUST show a coin image per row, falling back to a colored initials badge when no image is cached, alongside the asset name and ticker.
- **FR-007**: All numeric table columns and metric card values MUST use tabular number alignment so figures line up vertically.
- **FR-008**: The refresh action MUST re-fetch prices and update the header's last-updated indicator and all dependent values (metric cards, table) on success, and MUST show a clear failure message on error (including the existing rate-limit case) without leaving a stale success indicator.
- **FR-009**: The empty-wallet state (no operations) MUST be preserved: no metric cards or table are shown, only the existing empty-state message.
- **FR-010**: The redesigned view MUST render inside the existing sidebar shell from Item 6 (routed at `/wallet`, using the shared portfolio data context) — no new page shell is introduced.
- **FR-011**: When the balances-hidden preference is active, all monetary values in the metric cards and table MUST be masked, consistent with existing behavior elsewhere in the app.
- **FR-012**: All labels in the redesigned view (header title/subtitle, metric labels, grouping toggle options) MUST come from the i18n layer and render correctly in all 10 supported locales.

### Key Entities

- **Metric card**: A labeled summary value with an optional secondary line, optionally colored to indicate gain or loss. Not persisted — computed at render time from positions and prices.
- **Content header**: A per-view header with a title, subtitle, and a right-aligned actions area (last-updated text + refresh button). Not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine whether their portfolio is up or down, and by how much, within one glance at the top of the Wallet view (no scrolling or table reading required).
- **SC-002**: Refreshing prices updates all visible values (header timestamp, four metric cards, table) in a single user action.
- **SC-003**: Switching between the three grouping modes never produces a visible layout shift or broken alignment across at least 3 representative portfolio sizes (1 asset, ~5 assets across 2 platforms, ~15 assets across 4 platforms).
- **SC-004**: Zero regressions: existing Wallet behavior (grouping totals, exit-price editing, balances-hidden masking) continues to work exactly as before the redesign, verified by updated automated tests.

## Assumptions

- This item redesigns only the Wallet view's presentation and shared header/metric-card primitives; it does not change portfolio calculation logic in `shared/src/portfolio.ts` beyond what's needed to feed the metric cards (which is already exposed via `computePositions`/`collectAssets`).
- The `MetricCard` and `ContentHeader` components are built generically now so Items 8 (Profit) and 9 (History) can reuse them without rework, per the explicit instruction in the plan item — this is not scope creep since PLAN Item 7 names both components explicitly as deliverables.
- Coin images continue to come from the existing avatar cache populated by the price-fetch flow; no new image source is introduced.
- The segmented grouping toggle's exact position (inside or beside the content header) follows the prototype, which places it below the metric cards and above the table.
- Mobile app is out of scope — this is a web-only visual change to `web/src/components/WalletTab.tsx` and new shared web components; no `shared/` type contract changes are required.

# Feature Specification: Profit View Redesign

**Feature Branch**: `feat/profit-view-refactor`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Profit view redesign (Item 8 in PLAN.md, branch feat/profit-view-refactor, depends on item 6 which is merged). Redesign the Profit view (/profit) to match the prototype (docs/design/dashboard-collapsible-sidebar.html, 'Lucro' view): content header; four metric cards (Realized P/L, Unrealized P/L, Best asset, Worst asset); a chart-mode segmented control (By asset / Over time / Portfolio value) with text-only labels (no icons); a divergent bar chart for P/L by asset; horizontal allocation bars. Also remove icons from the Wallet view's segmented control (By asset / By platform / Asset + platform)."

## Clarifications

### Session 2026-07-02

- Q: How should the "Best asset" / "Worst asset" percentage be calculated when an asset has both realized and unrealized components? → A: Unrealized-only — rank only currently-open positions by unrealized % return; assets with no open position (fully closed) are excluded from the ranking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See profit summary at a glance (Priority: P1)

A user with existing operations opens the Profit view and immediately sees how much they have realized in gains/losses from closed positions, how much is unrealized in open positions, and which assets performed best and worst.

**Why this priority**: This is the core value of the Profit view — without it, the user has no reason to visit the page. It must work before any chart or breakdown is useful.

**Independent Test**: Can be fully tested by loading the Profit view with a mix of open and closed positions and verifying the four metric cards show the correct realized P/L, unrealized P/L, best asset, and worst asset values.

**Acceptance Scenarios**:

1. **Given** a portfolio with only open positions, **When** the user opens the Profit view, **Then** the realized P/L card shows zero (or the appropriate empty value) and the unrealized P/L card shows the sum of unrealized gains/losses across open positions.
2. **Given** a portfolio with at least one fully closed position and one open position, **When** the user opens the Profit view, **Then** the realized P/L card reflects only the closed position's result and the unrealized P/L card reflects only the open position's result.
3. **Given** a portfolio with at least two open positions with different unrealized returns, **When** the user opens the Profit view, **Then** the best asset card shows the ticker and unrealized percentage return of the highest-performing open position, and the worst asset card shows the ticker and unrealized percentage return of the lowest-performing open position.

---

### User Story 2 - Switch between P/L breakdown views (Priority: P2)

A user wants to understand profit from different angles: which individual assets drove the result, how the result evolved over time, and how total portfolio value has trended.

**Why this priority**: Builds on the summary in User Story 1 by letting the user drill into detail. Valuable but the page is still useful without it (metric cards alone answer "how am I doing").

**Independent Test**: Can be fully tested by clicking each option of the chart-mode segmented control and confirming the displayed chart changes to match the selected mode.

**Acceptance Scenarios**:

1. **Given** the Profit view is showing the "By asset" chart mode by default, **When** the user selects "Over time", **Then** the P/L-by-asset chart is replaced by a chart showing profit/loss over time.
2. **Given** the user is viewing the "Over time" chart, **When** the user selects "Portfolio value", **Then** the chart is replaced by a chart showing total portfolio value over time.
3. **Given** any chart mode is active, **When** the user reloads the page, **Then** the view resets to the default "By asset" mode (mode selection is not required to persist across reloads).

---

### User Story 3 - Understand P/L and allocation per asset (Priority: P2)

A user wants to see, per asset, whether it is contributing a gain or a loss, and what fraction of their invested capital sits in each asset.

**Why this priority**: This is the detailed view behind the "By asset" chart mode and the allocation panel — it's what most users spend time on after checking the summary cards, but the page functions without a user ever opening it.

**Independent Test**: Can be fully tested by loading the Profit view with several assets of mixed positive and negative P/L and verifying the bar chart shows a bar per asset, colored by sign, and the allocation panel shows a bar per asset sized by its share of total invested capital.

**Acceptance Scenarios**:

1. **Given** an asset with positive P/L, **When** the "By asset" chart renders, **Then** that asset's bar is shown in the positive (gain) color and extends upward/outward from the zero line.
2. **Given** an asset with negative P/L, **When** the "By asset" chart renders, **Then** that asset's bar is shown in the negative (loss) color and extends downward/inward from the zero line.
3. **Given** a portfolio with multiple assets of varying invested amounts, **When** the allocation panel renders, **Then** each asset's bar length is proportional to its invested amount as a fraction of total invested capital across all assets.

---

### User Story 4 - Uncluttered segmented controls (Priority: P3)

A user switching between chart modes in the Profit view, or between grouping modes in the Wallet view, sees plain text labels without icons cluttering the control.

**Why this priority**: Pure visual polish with no functional impact — the controls work identically either way. Lowest priority but explicitly requested scope for this item.

**Independent Test**: Can be fully tested by visually inspecting the segmented control in both the Profit view and the Wallet view and confirming no icon/glyph appears next to any option label.

**Acceptance Scenarios**:

1. **Given** the Profit view is open, **When** the user looks at the chart-mode segmented control, **Then** each of "Por ativo", "Lucro no tempo", and "Valor da carteira" is rendered as text only, with no icon.
2. **Given** the Wallet view is open, **When** the user looks at the grouping segmented control, **Then** each of "Por ativo", "Por Plataforma", and "Ativo + plataforma" is rendered as text only, with no icon.

---

### Edge Cases

- What happens when the user has no operations at all? All four metric cards must show a neutral/empty state (not an error, not `NaN` or `undefined`), and the charts and allocation panel must render an empty state instead of a broken chart.
- What happens when only one open position exists? The "best asset" and "worst asset" cards both show that same asset (there is no meaningful comparison).
- What happens when the user has closed positions but no currently open positions? Realized P/L reflects the closed positions, but the best/worst asset cards show a neutral/empty state since there is nothing open to rank.
- What happens when two or more open positions are exactly tied for best (or worst) unrealized return? The view picks one deterministically (the same asset every time for the same data) rather than showing an ambiguous or randomly-changing result.
- What happens when an asset's realized or unrealized P/L is exactly zero? It is treated as non-negative for coloring purposes (rendered in the gain color, not the loss color), consistent with the zero-line being the boundary. This also applies to a zero-return open position for best/worst ranking purposes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Profit view MUST display a content header showing the view title and a subtitle, consistent with the header pattern already used by the Wallet view.
- **FR-002**: The Profit view MUST display four metric cards: Realized P/L, Unrealized P/L, Best asset, Worst asset.
- **FR-003**: The Realized P/L metric MUST be computed only from closed positions (positions where all acquired quantity of the asset has been disposed of).
- **FR-004**: The Unrealized P/L metric MUST be computed only from open positions (positions with a remaining non-zero quantity).
- **FR-005**: The Best asset and Worst asset metrics MUST show the asset ticker and its unrealized percentage return, selected respectively as the highest and lowest unrealized percentage return among assets with a currently open position. Assets with no open position (fully closed) MUST be excluded from this ranking.
- **FR-006**: The Profit view MUST provide a chart-mode segmented control with three options: "By asset", "Over time", "Portfolio value". Exactly one mode is active at a time, defaulting to "By asset" on load.
- **FR-007**: When "By asset" mode is active, the view MUST render a divergent bar chart of profit/loss per asset, with a visible reference line at zero, where each bar's color indicates whether that asset's P/L is a gain (zero or positive) or a loss (negative).
- **FR-008**: When "Over time" mode is active, the view MUST render a chart of profit/loss over time, reusing the existing time-series computation already available in the codebase.
- **FR-009**: When "Portfolio value" mode is active, the view MUST render a chart of total portfolio value over time, reusing the existing time-series computation already available in the codebase.
- **FR-010**: The Profit view MUST display a horizontal allocation panel listing each asset with a bar whose length is proportional to that asset's invested amount as a fraction of total invested capital.
- **FR-011**: The chart-mode segmented control in the Profit view MUST render text-only option labels, with no icon next to any option.
- **FR-012**: The grouping segmented control in the Wallet view ("By asset" / "By platform" / "Asset + platform") MUST render text-only option labels, with no icon next to any option. No other behavior of the Wallet view changes.
- **FR-013**: When the user has no operations, the Profit view MUST show a neutral empty state for all four metric cards and for the active chart/allocation panel, without errors.

### Key Entities

- **Position**: A user's holding in a single asset, derived from their operations; has an invested amount, a current/exit value, a realized component (from closed portions), and an unrealized component (from any remaining open quantity).
- **Asset P/L entry**: Per-asset aggregate used by the "By asset" chart and the allocation panel — asset ticker, profit/loss amount, percentage return, and invested amount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine their total realized and unrealized profit/loss within 2 seconds of opening the Profit view, without needing to interact with any control.
- **SC-002**: A user can switch between all three chart modes and see the corresponding chart update, with no more than one visible interaction (a single click) per switch.
- **SC-003**: 100% of assets present in the portfolio appear in both the "By asset" chart and the allocation panel with values that reconcile with the metric cards (sum of per-asset P/L equals realized + unrealized totals).
- **SC-004**: Neither the Profit view's chart-mode control nor the Wallet view's grouping control displays an icon on any option, verified by visual inspection of both views.

## Assumptions

- "Closed position" means an asset for which the running held quantity has returned to zero at least once in the operation history; realized P/L is attributed to the closed portion(s), consistent with the existing portfolio computation logic already used by the Wallet view.
- Best/worst asset ranking uses percentage return (not absolute P/L amount) since it is the more common way users compare differently-sized positions; the ranking basis itself (unrealized-only) is resolved in Clarifications above.
- The "By asset" bar chart and allocation panel use each asset's total P/L (realized + unrealized combined) and total invested amount — a different, broader basis than the unrealized-only "Best asset"/"Worst asset" cards — since the chart's purpose is to show overall contribution per asset, not to rank open positions.
- The "Over time" and "Portfolio value" chart modes reuse the existing timeline computation used elsewhere in the app rather than introducing a new calculation, since Item 8's scope is presentation, not new portfolio math.
- Persisting the selected chart mode across reloads is out of scope; it resets to "By asset" on each visit, matching the Wallet view's existing (non-persisted) toggle behavior.
- "Icon" refers to any leading glyph, emoji, or SVG rendered inside a segmented-control option; the control's own container styling (borders, active-state background) is unaffected.

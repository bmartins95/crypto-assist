# Feature Specification: Per-Asset Charts & Enriched Tooltips

**Feature Branch**: `feat/charts-tooltips-redesign`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Item 30 — Per-asset charts & tooltip redesign, implementing the imported Claude Design handoff 'Handoff - Gráficos por Ativo e Tooltips.dc.html' (project 7de25ab4-b495-4062-bdb4-ba8895f54eef): (1) a dual-axis 'compare with one asset' overlay on the existing Profit-over-time / Portfolio-value charts, (2) a new sortable/searchable 'assets over time' list below the chart, (3) an enriched Profit-chart hover tooltip (date, cumulative profit, day delta, realized/unrealized/operations breakdown — no per-asset list), (4) an enriched Portfolio-value hover tooltip (current vs. invested + unrealized result + day variation)."

## Clarifications

### Session 2026-07-23

- Q: Component B's asset list row click: what should it do? → A: Open a dedicated full per-asset chart view (not just drive Component A's selector).
- Q: Should "remember the last compared asset per chart" (Component A) be implemented in this PR? → A: Yes, implement it now — persist the selected comparison asset per chart.
- Q: Should hovering a day on the Profit chart highlight that day's per-asset contribution in Components A/B (FR-010) in this release? → A: Yes, required now — not deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare one asset against the portfolio curve (Priority: P1)

A user viewing the Profit-over-time or Portfolio-value chart wants to know whether a swing in their overall numbers was driven by one specific holding, without that asset's price scale flattening the portfolio's R$ curve (or vice versa).

**Why this priority**: This is the core "why did my portfolio move" question the current charts cannot answer — it was the most-cited limitation prompting this redesign.

**Independent Test**: Can be fully tested by opening the Profit or Value chart, selecting an asset from the "Compare with" control, and confirming a dashed overlay with its own axis appears and can be swapped or cleared — independent of the asset list or tooltip work.

**Acceptance Scenarios**:

1. **Given** the Profit-over-time chart is displayed with no comparison selected ("Nenhum"), **When** the user selects an asset (e.g., BTC) from the "Compare with" control, **Then** a dashed overlay line showing that asset's % change over the selected period appears, plotted against its own right-hand axis, independent of the wallet's R$ axis on the left.
2. **Given** an asset overlay is active, **When** the user selects a different asset, **Then** the previous overlay is replaced (never accumulated alongside it) and the new asset's line and axis appear.
3. **Given** an asset overlay is active, **When** the user selects "Nenhum", **Then** the chart returns to today's single-axis appearance.
4. **Given** the wallet's R$ values and the asset's % values have very different magnitudes, **When** both are plotted, **Then** neither series visually flattens the other, because each axis auto-scales to its own series' min/max.

---

### User Story 2 - Scan every asset's period performance in one list (Priority: P1)

A user with any number of held assets wants a single place to see each asset's price trend and period performance, that stays usable whether they hold 3 assets or 30+.

**Why this priority**: Without this, the only per-asset breakdown today is the static allocation bars, which show weight but not trend or performance — this closes that gap and is independently valuable even without the overlay from Story 1.

**Independent Test**: Can be fully tested by loading the Profit tab with a portfolio of varying size and confirming the list renders one row per asset with sparkline/price/% change, and that search and sort work — independent of the overlay or tooltip work.

**Acceptance Scenarios**:

1. **Given** the user holds several assets, **When** they view the new list below the Profit/Value chart, **Then** each row shows an icon/name, a sparkline for the selected period, the current price, and the period % change colored green (positive) or red (negative).
2. **Given** the user holds many more assets than fit on screen, **When** they view the list, **Then** rows scroll inside a fixed-height container rather than growing the page.
3. **Given** the list is displayed, **When** the user types into the search box, **Then** only assets matching the query remain visible.
4. **Given** the list is displayed, **When** the user changes the sort control, **Then** rows reorder by the chosen criterion (biggest movement, alphabetical, or allocation).
5. **Given** the list is displayed, **When** the user changes the chart's period control (1D/1W/1M/1Y/All), **Then** the list's sparklines and % figures update to match the new period.
6. **Given** the list is displayed, **When** the user clicks a row, **Then** a dedicated full chart view for that asset opens.

---

### User Story 3 - Understand a day's profit result at a glance (Priority: P2)

A user hovering a point on the Profit-over-time chart wants the day's realized/unrealized split and operation count, not just one cumulative number.

**Why this priority**: Builds on Stories 1–2 (the tooltip deliberately excludes per-asset composition, which those components now provide) and is lower risk than the new chart/list components since it only changes an existing tooltip.

**Independent Test**: Can be fully tested by hovering points on the existing Profit chart and confirming the enriched tooltip fields, without any dependency on Stories 1 or 2 being complete.

**Acceptance Scenarios**:

1. **Given** the user hovers a point on the Profit-over-time chart, **When** the tooltip appears, **Then** it shows the date and weekday, the cumulative profit (large, colored by sign), the day's delta versus the previous point in both currency and percent, and — after a divider — Realizado, Não realizado, and Operações no dia rows.
2. **Given** a day with associated operations, **When** that day is hovered, **Then** the tooltip itself never lists which assets contributed (per-asset composition is answered by Stories 1–2's components, synced to the hovered day), keeping the tooltip to exactly the fields in Scenario 1.

---

### User Story 4 - Understand current value vs. invested at a glance (Priority: P2)

A user hovering a point on the Portfolio-value chart wants current value, invested amount, and the resulting unrealized P/L together, without doing mental math.

**Why this priority**: Same tier as Story 3 — an existing-tooltip enrichment, independently testable and lower risk than the new components.

**Independent Test**: Can be fully tested by hovering points on the existing Portfolio-value chart and confirming the enriched tooltip fields.

**Acceptance Scenarios**:

1. **Given** the user hovers a point on the Portfolio-value chart, **When** the tooltip appears, **Then** it shows "Valor atual" and "Investido" each with a swatch matching their existing series color/style, a highlighted "Resultado não realizado" block with both currency and percent colored by sign, and a "Variação no dia" row.

---

### Edge Cases

- An asset with no price history for part or all of the selected period shows the existing empty-state treatment in the overlay and list rather than an error or blank chart.
- An asset with a single data point in the period (percent change undefined) does not render "NaN%" or divide by zero in the list, overlay legend, or tooltip.
- The previously-compared asset (Story 1) was fully closed/sold and is no longer held — the control falls back to "Nenhum" rather than referencing a no-longer-valid asset.
- A hovered day has zero operations — the profit tooltip shows "Operações no dia: 0" with Realizado/Não realizado both at their carried-forward values, not blank.
- The asset list search matches nothing — an empty-state message is shown instead of an empty scroll area.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let users select at most one asset at a time to overlay on the Profit-over-time and Portfolio-value charts, replacing any prior overlay rather than accumulating multiple lines, with a "Nenhum" (none) option that restores today's single-series view.
- **FR-001a**: The system MUST remember the last-compared asset independently per chart (Profit-over-time and Portfolio-value) across page reloads, restoring it as the active overlay the next time that chart is viewed.
- **FR-002**: When an asset overlay is active, the chart MUST render the wallet series against its existing currency scale (left axis) and the selected asset's percent change over the same period against an independently-scaled axis (right axis), so neither series compresses the other regardless of relative magnitude.
- **FR-003**: The asset overlay line MUST be visually distinguished from the wallet line (dashed, colored per the asset's brand color) and MUST appear in the chart legend labeled as a period percentage.
- **FR-004**: System MUST provide a separate, persistent list of every held asset — icon/name, a sparkline for the current period, price, and period percent change — positioned below the Profit/Value chart area.
- **FR-005**: The asset list MUST support free-text search/filtering and MUST support sorting by biggest movement, alphabetical order, and allocation.
- **FR-006**: The asset list MUST scroll within a fixed-height container so its layout is identical whether the user holds a handful of assets or several dozen.
- **FR-007**: The asset list's sparklines and percent-change values MUST follow the same period control (1D/1W/1M/1Y/All) already used by the main chart, and MUST update when that period changes.
- **FR-008**: Selecting a row in the asset list MUST open a dedicated full chart view for that asset.
- **FR-009**: Hovering a point on the Profit-over-time chart MUST show a tooltip containing exactly: the date and weekday, the cumulative profit (colored by sign), the day's delta versus the previous point in both currency and percent, and a breakdown of Realizado, Não realizado, and Operações no dia. The tooltip MUST NOT list individual asset composition.
- **FR-010**: When a day is hovered on the Profit-over-time chart, the asset overlay and/or asset list MUST reflect that day's per-asset contribution, so per-asset composition stays discoverable without the tooltip listing it.
- **FR-011**: Hovering a point on the Portfolio-value chart MUST show a tooltip containing: current value and invested amount (each with a swatch matching their series' existing color/style), a highlighted unrealized-result block with currency and percent colored by sign, and the day's variation.
- **FR-012**: All new and updated chart/tooltip elements MUST reuse the existing color language (teal for wallet/current value, periwinkle for invested/profit line, green/red for positive/negative) so the change reads as a continuation of the current design.
- **FR-013**: The system MUST degrade gracefully — using the existing empty-state pattern — when price history for an asset is unavailable for part or all of the selected period, in both the overlay and the list.

### Key Entities *(include if feature involves data)*

- **Comparison selection**: the single asset (or "none") chosen for the Story 1 overlay on a given chart; remembered per chart across sessions.
- **Asset period series**: an existing held asset's price/quantity history for the selected timeframe, plus a derived period-normalized percent-change series (first point defined as 0%) used by both the overlay and the list's sparklines.
- **Day snapshot**: a point on the Profit-over-time timeline extended with the fields the enriched tooltip needs — cumulative profit, day-over-day delta, realized/unrealized split, operation count, and per-asset contribution for that day.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a single hover, a user can tell whether a day's portfolio-wide profit swing was realized or unrealized and how many operations occurred that day.
- **SC-002**: A user can compare any one held asset's period performance against the portfolio curve without either series visually flattening the other, regardless of how different their price magnitudes are.
- **SC-003**: A user holding more assets than fit on screen can locate any single asset's period performance via search in a few seconds, with the list's layout unchanged in shape from a small portfolio.
- **SC-004**: Existing Profit and Portfolio-value chart behavior (chart switching, timeframe selection, currency display) continues to work unchanged for users who never touch the new comparison or list controls.

## Assumptions

- The per-asset brand colors named in the handoff (BTC, ETH, SOL, ADA) are illustrative examples; the implementation must derive a consistent color for any held asset, not only those four.
- "Period" for the overlay, the asset list, and the profit tooltip's day delta all follow the same timeframe control (1D/1W/1M/1Y/All) already implemented for the Profit tab — no new period selector is introduced.
- The profit tooltip's realized/unrealized split and operation count are derived from the same operations/positions data that already powers the existing profit-by-asset and timeline calculations — no new backend data source is required.
- Sorting the asset list "by allocation" reuses the existing invested/current-value weighting already computed for the portfolio distribution section.
- Visual details (exact colors, spacing, radii) follow the imported design handoff and its referenced mock file; where those are silent, the existing Profit/Wallet tab visual language applies.
- The dedicated full chart view opened by an asset-list row click (FR-008) is new UI — no equivalent single-asset chart view exists anywhere in the app today.

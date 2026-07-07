# Feature Specification: Historical Charts + Timeframe Selector

**Feature Branch**: `feat/historical-prices`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Item 12 — Fix historical charts + timeframe selector (see PLAN.md). Fix computeTimeline in shared/src/portfolio.ts to use actual historical prices per date instead of applying today's prices to past operations, add a new backend endpoint GET /api/prices/history backed by a new price_history table (cache CoinGecko market_chart data), and add a TimeframeSelector (1D/1W/1M/1Y/All) to ProfitTab driving both the 'Lucro no tempo' and 'Valor da carteira' charts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate profit-over-time chart (Priority: P1)

As an investor reviewing my portfolio's profit history, I want the "Lucro no tempo" chart to show what my profit/loss actually was on each past date, using the prices that were in effect at that time, so that the chart reflects reality instead of silently re-pricing my whole history with today's prices.

**Why this priority**: This is the core data-correctness bug driving the whole item — without it, the chart is actively misleading, showing a distorted history that inflates or deflates past performance based on today's market moves.

**Independent Test**: With a portfolio that has operations spanning several months and an asset whose price has moved significantly since purchase, load the profit chart and confirm each plotted point matches the profit computed with that date's real historical price, not the asset's current price.

**Acceptance Scenarios**:

1. **Given** a buy operation on an earlier date and today's price for that asset has since doubled, **When** the "Lucro no tempo" chart renders the point for that earlier date, **Then** it shows the profit implied by the asset's price on that date, not today's doubled price.
2. **Given** the same portfolio, **When** the "Valor da carteira" chart renders, **Then** each point shows invested amount vs. portfolio value computed from that date's historical prices.
3. **Given** a date for which no exact historical price record exists, **When** the chart computes that point, **Then** it falls back to the nearest earlier available date's price (up to 7 days back) and, if none exists within that window, treats the value as zero for that asset on that date.

---

### User Story 2 - Zoom into a shorter timeframe (Priority: P2)

As an investor, I want to switch between 1D / 1W / 1M / 1Y / All windows on the profit charts so I can see recent movement in my current holdings without the shape of the multi-year history flattening the recent detail.

**Why this priority**: Builds directly on User Story 1's corrected data; without accurate historical pricing, a timeframe selector would just let users zoom into differently-wrong data. Delivers the actual UX improvement the item exists to provide once P1 lands.

**Independent Test**: With an existing multi-month portfolio, switch the timeframe selector through each option and confirm both charts reflow to show only the selected window, with data points matching the corrected historical pricing from User Story 1.

**Acceptance Scenarios**:

1. **Given** the Profit view is open on the default timeframe, **When** the user selects "1M", **Then** both the "Lucro no tempo" and "Valor da carteira" charts redraw to show only the last month of data, without a page reload.
2. **Given** the user has an asset first acquired 10 days ago and selects "1Y", **When** the chart renders, **Then** no data point before the acquisition date shows that asset contributing to the portfolio value.
3. **Given** the user switches timeframes repeatedly, **When** each new window is selected, **Then** the choice is remembered across a page reload (defaults to "1M" for a first-time visit).
4. **Given** a selected window has fewer than 2 data points (e.g. "1D" viewed immediately after a user's first-ever purchase), **When** the chart attempts to render, **Then** an explicit empty-state message is shown instead of a broken or single-point chart.

### Edge Cases

- A coin with no historical price data at all for the requested range (e.g. brand-new listing, or provider outage) — the missing dates fall back per the nearest-earlier-date rule; if nothing is available within the fallback window, that asset contributes zero to the point rather than breaking the chart.
- User has operations before the earliest date the price provider has data for — those points use the zero-fallback rule rather than failing the request.
- Selected timeframe (e.g. "All") spans a range with a very large number of days for a coin with many holdings — the fetch must still complete and render without the UI blocking indefinitely (a loading state is shown while in flight, per design reference).
- Switching timeframe while a previous fetch for a different timeframe is still in flight — the chart must end up showing the data for the most recently selected timeframe, not a stale in-flight response.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compute each point of the "Lucro no tempo" and "Valor da carteira" charts using the asset price that was in effect on that point's date, not the asset's current price.
- **FR-002**: The system MUST provide historical daily price data for the coins present in a user's operations, covering any date range the charts need to render.
- **FR-003**: When an exact historical price is unavailable for a given coin and date, the system MUST use the nearest earlier available date's price, searching back up to 7 days; if none is found within that window, the system MUST treat that coin's value as zero for that date rather than omitting the point or failing the request.
- **FR-004**: Users MUST be able to select a timeframe for the profit charts from: 1 Day, 1 Week, 1 Month, 1 Year, or All history.
- **FR-005**: Selecting a timeframe MUST update both the "Lucro no tempo" and "Valor da carteira" charts together, using one shared selection (not independent per-chart selections).
- **FR-006**: Changing the timeframe MUST update the charts without a full page reload.
- **FR-007**: The system MUST remember the user's last-selected timeframe across a page reload, defaulting to "1 Month" when no prior selection exists.
- **FR-008**: The charted range MUST never show a given asset contributing to the portfolio before the date the user actually acquired it — historical composition is derived from the user's real operations, not backfilled retroactively.
- **FR-009**: When the selected timeframe yields fewer than 2 data points to plot, the system MUST show an explicit empty-state message instead of rendering a broken or misleading chart.
- **FR-010**: The timeframe selector MUST be visible only for the two time-based chart modes ("Lucro no tempo" and "Valor da carteira") and hidden for the "Por ativo" mode, which has no timeframe concept.
- **FR-011**: The system MUST cache fetched historical price data so that repeated requests for the same coin/date do not require a fresh call to the upstream price provider.
- **FR-012**: The system MUST reject a historical-price request for a malformed coin identifier the same way the existing current-price endpoint does, to keep the outbound request safe from injection into the upstream provider's URL.

### Key Entities

- **Historical Price Record**: One coin's price on one calendar date. Attributes: coin identifier, date, price (in USD, consistent with the existing current-price storage established for multi-currency support). Uniquely identified by the (coin, date) pair.
- **Timeframe Selection**: The user's currently chosen chart window (1D / 1W / 1M / 1Y / All), persisted per device so it survives a reload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a portfolio with at least one asset whose price has changed by more than 10% since purchase, the profit-over-time chart's plotted values for past dates differ from a naive "apply today's price to every date" calculation — confirming real historical pricing is in effect.
- **SC-002**: Users can switch between any of the 5 timeframe options and see both charts reflect the new window in under 1 second of perceived wait (loading indicator shown if the underlying fetch takes longer).
- **SC-003**: Zero instances of an asset appearing in the portfolio-value chart before its actual acquisition date, verified across all supported timeframes.
- **SC-004**: A user's timeframe choice is preserved after closing and reopening the app in 100% of cases.

## Assumptions

- Historical prices are tracked and displayed in USD, consistent with the storage decision already made for current prices (Item 10 — multi-currency).
- The nearest-earlier-date fallback window is capped at 7 days, matching the existing `PLAN.md` guidance for Item 12; beyond that window a missing price is treated as zero rather than triggering an error.
- The upstream price history provider is the same one already used for current prices (CoinGecko), reused for historical `market_chart` data.
- "1 Week" and "1 Year" are calendar week/year equivalents (7 / 365 days back from today) rather than fiscal or ISO week definitions, consistent with common consumer finance app conventions.
- The timeframe selector's shared state lives in the Profit view only; other views are out of scope for this item.

# Feature Specification: Multi-currency display

**Feature Branch**: `feat/multi-currency`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Multi-currency display (PLAN.md item 10). Store crypto prices in USD as the universal reference instead of BRL, fetch exchange rates once per session, and convert at render time. Users pick their display currency (BRL, USD, EUR, GBP, JPY) in the Settings page (web) and Settings screen (mobile), wiring the currency selector placeholder left by item 5; switching currency updates all displayed monetary values immediately without reload. New ops record the currency they were entered in (default BRL for existing ops)."

## Clarifications

### Session 2026-07-07

- Q: What does an op's stored currency mean for portfolio math? → A: Amounts are entered and stored in the user's display currency; calculations convert each op's amounts to the common USD reference (current rates) before aggregating.
- Q: Which upstream source provides fiat exchange rates? → A: CoinGecko (existing key/client); rates derived from a reference asset priced in usd, brl, eur, gbp, jpy.
- Q: How is the stored crypto price reference migrated from BRL to USD? → A: Single-step column rename is acceptable because the price cache is disposable, short-lived data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch display currency (Priority: P1)

A user opens Settings, picks a display currency (BRL, USD, EUR, GBP or JPY) from the "Moeda e preços" card, and every monetary value across the app — wallet metrics, holdings table, profit metrics, charts, operation history — immediately renders in the chosen currency with the correct symbol and locale formatting. The preference survives page reloads.

**Why this priority**: This is the feature itself — everything else (USD price storage, exchange rates) exists to make this switch possible and correct.

**Independent Test**: With a portfolio loaded, change the currency in Settings and observe all visible monetary values re-render in the new currency without a page reload; reload the page and confirm the preference persisted.

**Acceptance Scenarios**:

1. **Given** a user with holdings viewing the Wallet page in BRL, **When** they switch the Settings currency selector to USD, **Then** all metric cards, table values and totals display in USD (US$ symbol, en-style formatting) without a reload.
2. **Given** a user who selected EUR, **When** they reload the page, **Then** values still display in EUR.
3. **Given** a user who has never chosen a currency, **When** they open the app, **Then** values display in BRL (the default).
4. **Given** the hide-balances toggle is on, **When** the user switches currency, **Then** values remain masked (••••••) and unmask in the new currency when toggled off.

---

### User Story 2 - Accurate conversion via exchange rates (Priority: P2)

Displayed values are converted from the USD reference prices using an exchange rate fetched from the backend once per session. Rates are cached server-side for one hour so repeated requests are cheap and resilient.

**Why this priority**: Without correct rates the P1 switch would show wrong numbers; but the mechanism is invisible to the user and depends on P1 existing.

**Independent Test**: Request the exchange-rates endpoint twice within an hour and verify the second response is served from cache (no upstream call); verify a displayed BRL value equals the USD value multiplied by the returned BRL rate.

**Acceptance Scenarios**:

1. **Given** fresh server state, **When** the exchange rates are requested, **Then** rates for BRL, EUR, GBP and JPY versus USD are returned and stored.
2. **Given** rates were fetched less than an hour ago, **When** they are requested again, **Then** the cached values are returned without calling the upstream provider.
3. **Given** the upstream rate provider is unavailable and a cached rate exists (even stale), **When** rates are requested, **Then** the stale cached rates are returned rather than an error.
4. **Given** the upstream provider is unavailable and no cache exists, **When** rates are requested, **Then** the API responds with a clear error and the app falls back to displaying USD-equivalent values in BRL at rate 1 is NOT acceptable — instead the app keeps the last known display and surfaces a visible status message.

---

### User Story 3 - Operations record their entry currency (Priority: P3)

When a user registers a new operation, the currency in effect at entry time is stored with the operation. Existing operations are treated as BRL.

**Why this priority**: Needed for future accuracy (historical cost basis), but display conversion works without it; it only changes what is persisted with new records.

**Independent Test**: Create an op while the display currency is USD and verify the stored record carries USD; verify pre-existing ops read back as BRL.

**Acceptance Scenarios**:

1. **Given** the display currency is USD, **When** the user registers a buy, **Then** the saved operation records USD as its currency.
2. **Given** operations created before this feature, **When** they are fetched, **Then** each reports BRL as its currency.

---

### User Story 4 - Mobile parity (Priority: P3)

The mobile Settings screen's currency row (placeholder from item 5) is wired to the same currency options, persists the choice on-device, and all mobile screens re-render values in the chosen currency immediately.

**Why this priority**: Mobile parity is a project rule, but web is the primary surface and the shared logic is proven by P1.

**Independent Test**: On the mobile Settings screen choose JPY and verify wallet/profit/history screens show ¥ values; restart the app and confirm persistence.

**Acceptance Scenarios**:

1. **Given** the mobile app in BRL, **When** the user picks JPY in Settings, **Then** all screens display ¥ formatted values immediately.
2. **Given** a chosen currency, **When** the app restarts, **Then** the choice is restored.

### Edge Cases

- JPY has no decimal subunits — values must render without decimal places (standard currency formatting rules per currency).
- Exchange-rate fetch fails mid-session: app continues showing the last successfully converted values and shows a status message; switching currency while rates are unavailable keeps values in the last working currency rather than showing NaN/zero.
- Crypto prices previously cached in BRL: after the change, the stored reference is USD; any stale BRL-era cached price must not be interpreted as USD (cache is keyed/renamed so old values are not misread).
- A user with no operations sees zero-value metrics correctly formatted in the selected currency.
- Very large JPY values must not overflow layout in metric cards (formatting uses compact grouping as elsewhere in the app).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store cryptocurrency reference prices in USD.
- **FR-002**: The system MUST expose exchange rates versus USD for BRL, EUR, GBP and JPY, cached server-side for one hour.
- **FR-003**: Users MUST be able to select a display currency (BRL, USD, EUR, GBP, JPY) from the web Settings page; the previously disabled selector becomes functional.
- **FR-004**: Users MUST be able to select the display currency from the mobile Settings screen.
- **FR-005**: Changing the display currency MUST update all displayed monetary values immediately, without page reload (web) or app restart (mobile).
- **FR-006**: The display currency preference MUST persist per device across sessions; the default is BRL.
- **FR-007**: All monetary formatting MUST use the correct symbol, grouping and decimal rules for the selected currency and active locale.
- **FR-008**: New operations MUST record the currency in effect when they were created, and their monetary amounts are denominated in that currency; operations without a recorded currency are treated as BRL.
- **FR-011**: Portfolio calculations (invested totals, P/L, allocation) MUST convert each operation's amounts from its recorded currency to the common USD reference before aggregating, so mixed-currency operations produce correct totals in any display currency.
- **FR-009**: When exchange rates cannot be fetched and no cache exists, the app MUST surface a visible status message and MUST NOT display incorrectly converted values.
- **FR-010**: The hide-balances feature MUST continue to mask values regardless of selected currency.

### Key Entities

- **Exchange rate**: a currency code paired with its rate versus USD and the time it was last refreshed; cached server-side.
- **Operation currency**: the currency attached to each portfolio operation at creation time; absent means BRL.
- **Display currency preference**: a per-device user choice among BRL, USD, EUR, GBP, JPY; defaults to BRL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change the display currency and see every visible monetary value update in under 1 second, with zero page reloads.
- **SC-002**: The currency preference survives 100% of page reloads and app restarts on the same device.
- **SC-003**: Converted values are arithmetically consistent: displayed value = USD reference × published rate for the selected currency (within rounding of the currency's decimal rules).
- **SC-004**: Upstream exchange-rate provider is called at most once per hour per server environment under normal operation.
- **SC-005**: All existing tests plus new coverage pass; changed backend modules retain ≥90% coverage.

## Assumptions

- Historical operations were entered in BRL; their stored amounts are not retroactively converted — the recorded currency simply defaults to BRL.
- Conversion is a display-time concern using the current exchange rate; the feature does not compute historical FX-accurate cost basis (that would require historical rates, out of scope).
- Portfolio calculations operate in the USD reference: crypto prices are already USD, and op amounts are converted from their recorded currency to USD using current rates; the final conversion to the display currency happens at render time.
- Exchange rates are derived from the existing crypto-price provider (a reference asset priced in usd, brl, eur, gbp, jpy) — no new external provider or API key.
- The existing hourly-style caching pattern used for crypto prices is acceptable for exchange rates.
- Migrating the stored crypto price reference from BRL to USD is acceptable because cached prices expire quickly and are refetched; no long-lived data depends on the old BRL values.
- Mobile uses the same five currencies and the same default as web.

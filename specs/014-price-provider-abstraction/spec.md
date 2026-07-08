# Feature Specification: Price Provider Abstraction

**Feature Branch**: `feat/price-provider-abstraction`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Item 13 — Price provider abstraction + move coin search to backend (PLAN.md). Introduce a price-provider abstraction on the backend (search, current prices, historical prices), extract existing CoinGecko logic behind it, add a stub for a second provider, and move coin search off the frontend so the CoinGecko API key is no longer exposed to the browser. Track each priced asset by both its canonical coin id and its ticker symbol so a future ticker-based provider can be swapped in without a schema change."

## Clarifications

### Session 2026-07-08

- Q: Should the new backend coin-search endpoint require Cognito auth like other protected routes, or stay public? → A: Require auth, same as other protected endpoints.
- Q: Should the additive `symbol` column be backfilled for existing price_cache/price_history rows, or left NULL until next natural refresh? → A: Backfill via a one-time migration join against `ops` by `coin_id`.
- Q: Should the second price data source be a real (network-integrated) CryptoCompare implementation, or should CoinGecko remain the only real provider for now? → A: CoinGecko remains the only real, working provider in this feature; the second provider is groundwork for a future migration only.
- Q: Given that, should a second provider file still exist in this item (a skeleton proving pluggability) or be skipped entirely? → A: Include a skeleton file — class exists, is resolvable via configuration, but every method raises a clear not-implemented outcome (no network calls, no API key).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Coin search never exposes the API key to the browser (Priority: P1)

Today, searching for a coin when registering a buy/sell/trade operation calls the price data vendor directly from the browser, which requires shipping the vendor API key to every client. A user (or anyone inspecting network traffic in their browser) should never be able to see that key, and the app should keep working exactly the same from their point of view — they type a coin name, they get matching results.

**Why this priority**: This is the security-driving reason for the whole feature (credential exposure to untrusted clients). It is also the only user-visible behavior in this feature, so it is the one thing that must not regress.

**Independent Test**: Open DevTools → Network while using the coin search box in the operation entry drawer. Confirm no request is made to the price vendor's domain and no API key appears in any request the browser sends. Confirm search results still appear as the user types.

**Acceptance Scenarios**:

1. **Given** the operation entry drawer is open, **When** the user types a coin name or ticker into the search field, **Then** matching coins are returned and displayed exactly as before.
2. **Given** the browser's network traffic is inspected during a search, **When** the search request is captured, **Then** it is sent only to this application's own backend, never to the price vendor directly, and contains no vendor API key.
3. **Given** the user searches for a query with no matches, **When** results come back empty, **Then** the search UI shows the existing "no results" state (unchanged from today).

---

### User Story 2 - Price data source is swappable via configuration, proven by a second provider slot (Priority: P2)

The system currently has exactly one source of truth for coin prices and search results, wired directly into the routes that need it. An operator should be able to select which price data source is active via configuration, without rewriting the routes or business logic that consume prices, search results, or historical prices. CoinGecko remains the only fully working source in this feature; a second provider slot exists to prove the configuration switch works and to give a future real second provider somewhere to land, but it does not need to be functional yet.

**Why this priority**: This is the architectural goal of the item, but it has no independent user-facing behavior today (CoinGecko is the only working source) — its value is future flexibility and testability, so it ranks below the concrete security fix.

**Independent Test**: With the price source configuration pointed at the default vendor, confirm all current price/search/history behavior is unchanged (regression check). Then point the configuration at the second provider slot and confirm the backend resolves it (no crash, no fallback to the default) and that calling any of its capabilities surfaces a clear "not implemented" outcome rather than crashing or returning silently wrong data.

**Acceptance Scenarios**:

1. **Given** the backend is configured to use the default price data source, **When** any price, search, or history request is made, **Then** behavior and response shape are identical to before this feature existed.
2. **Given** the backend configuration is pointed at the second provider slot, **When** any price, search, or history request is made, **Then** the backend resolves to that provider (proving the configuration switch works) and each capability surfaces a clear "not implemented" outcome rather than crashing or silently falling back to the default.
3. **Given** a price data source does not support a given capability (e.g. historical prices), **When** a request for that capability is routed to it, **Then** the system reports a clear "not supported" error rather than crashing or returning silently wrong data.

---

### User Story 3 - Priced assets carry both their canonical id and their ticker (Priority: P3)

Every operation a user records already has both a canonical coin identifier and a ticker symbol. Cached and stored price data should retain both, so that a future price source which looks up assets by ticker (rather than by the current vendor's internal id) can be introduced later without a data migration.

**Why this priority**: This is a forward-looking data-shape change with no user-visible effect today; it only pays off when/if a ticker-based source is added later, so it is the lowest priority of the three.

**Independent Test**: Trigger a price fetch and a historical-price fetch for an asset already known to the system (has both a canonical id and a ticker on file). Confirm the cached/stored record for that asset includes both fields, and that existing lookups by canonical id are unaffected.

**Acceptance Scenarios**:

1. **Given** a price is fetched for an asset with a known canonical id and ticker, **When** the result is cached, **Then** the cached record includes both the canonical id and the ticker.
2. **Given** historical prices are fetched for an asset, **When** the results are stored, **Then** each stored daily price record includes both the canonical id and the ticker.
3. **Given** an existing cached price record created before this feature (ticker not yet recorded), **When** it is read, **Then** the system does not error and treats the missing ticker as unknown rather than failing the request.

---

### Edge Cases

- What happens when the coin search query is empty or missing? The backend rejects it with a clear error, matching the existing frontend validation behavior for empty queries.
- What happens when the price data source itself is unreachable or rate-limited during a search or price lookup? The user sees the existing degraded-state behavior (stale cache/backoff), not a raw error.
- What happens when a coin has no ticker on record (data gap)? The system still returns/stores its canonical-id-keyed price; the ticker is simply absent rather than blocking the operation.
- What happens when two unrelated assets share the same ticker (symbol collision)? The canonical id remains the authoritative identity for all lookups the system itself performs; ticker is carried only as auxiliary data for possible future use, not used to disambiguate today.
- What happens when the backend is configured to use the second (not-yet-working) provider slot? Every request that would reach it surfaces a clear "not implemented" outcome; the system never silently falls back to the default provider or returns fabricated data.
- What happens to a coin_id in price_cache/price_history that has no matching row in the operations table at backfill time? It keeps a NULL ticker symbol rather than blocking the migration or the rest of the backfill.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a coin search capability served entirely by the backend, so the browser never needs a price-vendor API key to search for coins.
- **FR-002**: The system MUST reject a coin search request that has an empty or missing query with a clear, actionable error.
- **FR-003**: The system MUST expose current-price lookups, coin search, and historical-price lookups behind a single internal abstraction, such that the concrete price data source in use is a configuration choice, not a code change at each call site.
- **FR-004**: The system MUST support configuring which price data source is active without modifying the routes/business logic that request prices, search results, or history.
- **FR-005**: The system MUST allow a price data source to satisfy the interface without yet having a working implementation of any capability (every method surfaces a clear "not implemented" outcome), proving the interface can be swapped in via configuration alone ahead of a real second provider being built.
- **FR-006**: The system MUST retain both the canonical coin identifier and the ticker symbol for every asset it fetches a current or historical price for.
- **FR-007**: The system MUST continue to treat the canonical coin identifier as the sole authoritative key for identity and lookups; the ticker is auxiliary data only and MUST NOT be used to resolve ambiguity between assets that share a ticker.
- **FR-008**: The system MUST NOT regress any existing price, search, or history behavior for users of the current, default price data source.
- **FR-009**: The frontend MUST no longer hold or transmit the price-vendor API key for coin search after this feature ships.
- **FR-010**: The coin search endpoint MUST require the same authentication (a valid session token) as other protected API endpoints, consistent with the rest of the API surface.
- **FR-011**: The migration that introduces the ticker-symbol column MUST backfill it for existing cached/stored price records where a matching canonical identifier is found among recorded operations, rather than leaving all historical rows permanently without a ticker.

### Key Entities

- **Priced Asset Reference**: The pairing of a canonical coin identifier (unique, authoritative) and a ticker symbol (auxiliary, not guaranteed unique) used to look up a coin's price or search for it, across current-price, historical-price, and search operations.
- **Price Data Source**: A swappable source of coin search results, current prices, and (optionally) historical prices, selected by configuration; may support a partial set of capabilities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero direct browser requests to the price vendor's domain are observed during any coin search, across 100% of search interactions.
- **SC-002**: 100% of existing coin search, current-price, and historical-price behaviors continue to pass their existing test coverage unchanged after the abstraction is introduced.
- **SC-003**: The active price data source can be changed via configuration alone, verified by a second provider slot that the backend resolves correctly and whose every capability surfaces a clear "not implemented" outcome, without any route code changes.
- **SC-004**: 100% of newly cached or stored current-price and historical-price records include both the canonical identifier and the ticker symbol, for assets where the ticker is known; 100% of pre-existing cached/stored records receive a backfilled ticker symbol wherever a matching canonical identifier exists among recorded operations.

## Assumptions

- The current price vendor (CoinGecko) remains the only fully-working price data source shipped in this feature. A second provider slot is included purely as groundwork for a future migration (per clarification) — it is registered and selectable via configuration, but every one of its capabilities (search, current price, history) surfaces a clear "not implemented" outcome rather than doing real work.
- No crosswalk/mapping table between the canonical identifier and other vendors' own internal ids is built in this feature; the ticker symbol already stored on each operation is the only additional signal carried forward, and ticker collisions across unrelated assets are an accepted, documented limitation rather than something this feature resolves.
- This is a backend-and-adjacent-frontend refactor of an existing, already-shipped capability (coin search, prices, history) — no new user-facing feature is being introduced, so success is measured primarily by parity plus the security fix, not by new functionality.
- "Frontend" here refers to the web app only (per PLAN.md item 13 file list); mobile does not currently perform coin search directly against the vendor and is unaffected.
- The coin search endpoint sits behind the same authentication as the rest of the protected API surface; an unauthenticated request is rejected the same way other protected endpoints reject one.
- The migration backfilling the ticker-symbol column runs once, at deploy time, as part of the additive schema change; it does not require a separate manual data-fix step afterward.

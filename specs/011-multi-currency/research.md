# Research: Multi-currency display

## R1 — Exchange-rate source

- **Decision**: Derive fiat cross-rates from one CoinGecko call: `/simple/price?ids=bitcoin&vs_currencies=usd,brl,eur,gbp,jpy`, then `rate_vs_usd[c] = btc_price_in_c / btc_price_in_usd` (USD = 1.0).
- **Rationale**: Confirmed in clarification. The backend already holds a CoinGecko demo key in SSM and an httpx + DB-cache pattern in `prices.py`. Cross-rates through a single liquid asset are arithmetically exact for display purposes and avoid a second provider, key, and failure mode.
- **Alternatives considered**: exchangerate-api.com (extra provider + key), Frankfurter/ECB (keyless but daily-only updates, extra provider). Rejected per clarification.

## R2 — Where conversion happens

- **Decision**: Normalize op amounts to USD once via `convertOpsToUsd(ops, rates)` in `shared/src/portfolio.ts`; keep every existing portfolio function unchanged; convert USD results to the display currency only at the `fmt()` call boundary.
- **Rationale**: Confirmed in clarification ("convert at render"). Changing `computePositions`/`computeProfitByAsset`/`computeTimeline` signatures would churn every test and both frontends; a boundary conversion gives one auditable conversion point.
- **Alternatives considered**: threading a `rates` param through every compute function (wide churn); normalizing to USD at save time (loses the user's entered value — rejected in clarification).

## R3 — price_cache migration

- **Decision**: Single-step `ALTER TABLE price_cache RENAME COLUMN price_brl TO price_usd`, plus `UPDATE price_cache SET updated_at = to_timestamp(0)` in the same migration to force-expire all BRL-era rows.
- **Rationale**: Approved in clarification. Rows expire after 5 minutes anyway; the force-expire removes even the tiny window where a BRL value could be read as USD.
- **Alternatives considered**: strictly additive add/backfill/drop (two migrations for disposable data); truncate+rename (equivalent effect; expiring keeps images cached).

## R4 — JPY (zero-decimal) formatting

- **Decision**: Remove the hardcoded `minimumFractionDigits: 2, maximumFractionDigits: 2` from `fmt()` and rely on `Intl.NumberFormat` per-currency defaults.
- **Rationale**: Intl already knows JPY uses 0 fraction digits and BRL/USD/EUR/GBP use 2 — existing output for BRL is byte-identical, verified by existing `format.test.ts`.
- **Alternatives considered**: a currency→digits lookup table (duplicates data Intl ships with).

## R5 — Client rate lifecycle & failure handling

- **Decision**: `CurrencyContext` (web) / `CurrencyContext` (mobile) fetches `/api/exchange-rates` once on mount, exposes `{ currency, setCurrency, rates, ratesStatus }`, persists the selected currency and the last good rates to localStorage/AsyncStorage. On fetch failure: reuse persisted rates and set `ratesStatus='stale'`; with no persisted rates, `ratesStatus='unavailable'` and consumers render a visible status message instead of converted values (FR-009).
- **Rationale**: "Once per session" from the spec; persisted last-good rates satisfy the "keep the last known display" clarified behavior; mirrors the `BalanceContext` provider pattern already in both apps.
- **Alternatives considered**: fetching rates in the dashboard data layer (couples rates to price fetching; Settings page also needs them); silent rate=1 fallback (explicitly forbidden by spec US2-4).

## R6 — Exit prices scope

- **Decision**: `exit_prices` keeps no currency column; exit prices are user targets interpreted in the display currency at render time. Documented limitation: switching display currency changes the interpretation of previously entered targets.
- **Rationale**: Item 10 does not list exit prices; existing data is BRL-denominated and the default display is BRL, so current users see no change. Adding a currency column here would expand the migration and UI surface beyond the plan item (Constitution IV).
- **Alternatives considered**: currency column on exit_prices (out of scope); converting stored values (guesswork about original currency).

## R7 — Ops entry currency UX

- **Decision**: The op drawer's monetary inputs are denominated in the current display currency; the created/updated `NewOp` carries `currency`. History rows and totals convert each op from its stored currency to the display currency (via USD) like every other value.
- **Rationale**: Matches user mental model ("I typed what I paid, in the currency I see"); confirmed in clarification.
- **Alternatives considered**: fixed BRL entry regardless of display (confusing when UI shows USD); per-op currency picker in the form (extra UI not required by the spec).

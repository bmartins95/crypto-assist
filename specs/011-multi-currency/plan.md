# Implementation Plan: Multi-currency display

**Branch**: `feat/multi-currency` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-multi-currency/spec.md`

## Summary

Move the crypto price reference from BRL to USD, add a backend exchange-rates endpoint (CoinGecko-derived, cached 1 h in a new `exchange_rates` table), record each new op's entry currency, and let users pick a display currency (BRL, USD, EUR, GBP, JPY) in Settings on web and mobile. All conversion happens at render time: op amounts are normalized to USD via `convertOpsToUsd()` before portfolio math, and USD results are multiplied by the display-currency rate at the formatting boundary.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5 (shared/web/mobile)

**Primary Dependencies**: FastAPI + Mangum + psycopg v3 + httpx (backend); React 19 + Vite + TanStack Router (web); Expo SDK 54 (mobile). No new dependencies.

**Storage**: PostgreSQL (Aurora Serverless v2). Migration 005: rename `price_cache.price_brl`→`price_usd` (user-approved deviation from additive rule — disposable cache), create `exchange_rates`, add `ops.currency` (additive, default `'BRL'`).

**Testing**: pytest (backend), Vitest + Testing Library (web)

**Target Platform**: AWS Lambda (backend), browser via CloudFront (web), Expo (mobile)

**Project Type**: Monorepo web + mobile + shared + backend

**Performance Goals**: Currency switch re-renders all values < 1 s (pure client-side re-render, no fetch). Upstream rate provider called ≤ 1×/hour per environment.

**Constraints**: Conversion math must be consistent: display = USD × rate[display]; op→USD = amount ÷ rate[op.currency]. Rates are "units of currency per 1 USD" (`rate_vs_usd`), USD = 1.0.

**Scale/Scope**: 5 currencies, 1 new endpoint, 1 new table, 1 new column, 2 new contexts (web + mobile), ~6 components touched.

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| I. Shared-First | PASS | `Currency`, `ExchangeRates`, `convertOpsToUsd` live in `shared/src`; exported from `index.ts`; mobile build verified before PR |
| II. Security at Boundary | PASS | `/api/exchange-rates` requires auth; no client-supplied input beyond the authenticated request; CoinGecko key stays in SSM |
| III. Behavior Coverage | PASS | New tests: exchange-rates route (fresh/cache/stale-fallback/401), ops currency roundtrip, `convertOpsToUsd`, JPY formatting, CurrencyContext, settings selector |
| IV. No Speculative Code | PASS | Only the 5 currencies from the spec; no provider abstraction (that is item 13); one conversion helper with two call sites (web+mobile) |
| V. A11y & i18n | PASS | Currency selector gets a `<label>`/`aria-label`; new UI strings go through `UIText` in all 10 locales |
| DB migrations additive | JUSTIFIED DEVIATION | `price_brl`→`price_usd` rename approved in clarification: cache rows expire in 5 min, no durable data at risk. `ops.currency` is additive. |

## Project Structure

### Documentation (this feature)

```text
specs/011-multi-currency/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── exchange-rates.md
│   └── ops-currency.md
└── tasks.md            (created by /speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models.py                    # + currency on NewOp/Op; ExchangeRatesResponse
│   ├── main.py                      # register exchange_rates router
│   └── routes/
│       ├── prices.py                # vs_currency=usd; price_brl→price_usd
│       ├── exchange_rates.py        # NEW: GET /api/exchange-rates
│       ├── ops.py                   # currency column in CRUD
│       └── export_data.py           # currency in export rows
├── db/
│   ├── schema.sql                   # price_usd; exchange_rates; ops.currency
│   └── migrations/005_usd_prices_and_currency.sql   # NEW
└── tests/
    ├── test_exchange_rates.py       # NEW
    ├── test_prices.py               # updated column name
    └── test_ops.py                  # currency roundtrip

shared/src/
├── types.ts                         # Currency, ExchangeRates, NewOp.currency
├── format.ts                        # fmt: per-currency decimal rules (JPY=0)
├── portfolio.ts                     # convertOpsToUsd()
└── index.ts                         # new exports

web/src/
├── context/CurrencyContext.tsx      # NEW: currency + rates + persistence
├── lib/api/client.ts                # getExchangeRates()
├── pages/settings.tsx               # wire currency selector
├── components/{WalletTab,ProfitTab,HistoryTab}.tsx  # convert + fmt via context
├── router.tsx                       # provider wiring if needed
└── main.tsx                         # CurrencyProvider wrap

mobile/
├── src/context/CurrencyContext.tsx  # NEW: AsyncStorage-backed
├── src/lib/api/client.ts            # getExchangeRates()
├── app/settings.tsx                 # wire currency row
└── app/(tabs)/{wallet,profit,history}.tsx  # convert + fmt via context
```

**Structure Decision**: Follow existing patterns exactly — context module per concern (mirrors `BalanceContext`), route module per resource (mirrors `prices.py`), shared types/logic in `shared/src`.

## Design decisions (from research)

1. **Conversion boundary**: a single exported `convertOpsToUsd(ops, rates)` maps each op's `price`, `fee`, `total` from `op.currency ?? 'BRL'` to USD. All existing portfolio functions (`computePositions`, `computeProfitByAsset`, `computeTimeline`, `computePositionsByAssetAndPlatform`) stay signature-unchanged and operate on USD ops + USD prices. Rationale: one conversion point, zero churn in tested math.
2. **Display conversion**: components compute in USD and convert only at format time: `fmt(usdValue * rates[currency], locale, currency)`. Ops history rows display converted to the display currency like everything else.
3. **Rate derivation**: one CoinGecko call `/simple/price?ids=bitcoin&vs_currencies=usd,brl,eur,gbp,jpy`; `rate_vs_usd[c] = price_in_c / price_in_usd`; `USD = 1.0`. Reuses the existing key + httpx pattern; exact cross-rates from a single request.
4. **Rate caching**: `exchange_rates` table, 1 h TTL, stale-fallback on upstream failure (same pattern as `prices.py`). Client additionally caches last good rates in localStorage/AsyncStorage so a dead backend still renders with a visible warning (FR-009).
5. **`fmt()` decimals**: drop the hardcoded `minimumFractionDigits/maximumFractionDigits: 2` and let `Intl.NumberFormat` apply per-currency defaults (BRL/USD/EUR/GBP → 2, JPY → 0). Existing BRL output is unchanged.
6. **Exit prices**: remain display-currency values entered by the user, compared against display-converted market prices at render. No currency column added (out of item 10 scope); documented limitation — a user who switches currency should re-enter targets. Existing BRL data + BRL default = unchanged behavior for current users.
7. **Op entry**: the drawer's price/total fields are denominated in the current display currency; the created `NewOp` carries `currency: <display currency>`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Column rename (not additive) | PLAN.md item 10 prescribes it; cache data is disposable (5-min TTL) | Additive add-then-drop needs two migrations and a dead column for data nobody keeps |

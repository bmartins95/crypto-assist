# Implementation Plan: Historical Charts + Timeframe Selector

**Branch**: `feat/historical-prices` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-historical-prices/spec.md`

## Summary

`computeTimeline` currently applies **today's** prices to every past operation date, so the
"Lucro no tempo" and "Valor da carteira" charts show a distorted history. This item (a) fixes
`computeTimeline` to walk day-by-day using the price actually in effect on each date (with a
7-day look-back fallback, then zero), (b) adds a `price_history` table and a
`GET /api/prices/history` endpoint that caches CoinGecko `market_chart` data, and (c) adds a
`TimeframeSelector` (1D/1W/1M/1Y/All) to `ProfitTab` that drives both time-based charts from one
shared selection, per `docs/design/timeframe-chart-design.html` and
`docs/design/item-12-design-notes.md`.

## Technical Context

**Language/Version**: TypeScript 5 (shared/web), Python 3.12 (backend)

**Primary Dependencies**: FastAPI + Mangum + psycopg v3 (backend, existing); React 19 + Chart.js
`chart.js/auto` + TanStack Router (web, existing); no new dependency required for either package

**Storage**: PostgreSQL (Aurora Serverless v2) — new `price_history` table, additive migration

**Testing**: `pytest` (backend/tests), Vitest + Testing Library (web/src), plain unit tests for
`shared/src/portfolio.ts` colocated at `web/src/lib/portfolio.test.ts` (existing project layout —
`shared/` has no build/test step of its own; its logic is tested from the `web/` package)

**Target Platform**: AWS Lambda (backend), browser via Vite build (web)

**Project Type**: Web application (existing `backend/` + `web/` + `shared/` monorepo)

**Performance Goals**: Timeframe switch reflows both charts in <1s perceived wait (loading
overlay covers any longer fetch, per SC-002); the `price_history` cache means a repeat view of
the same coin/date range never re-hits CoinGecko

**Constraints**: CoinGecko free/demo tier rate limits (429) — endpoint must fall back to
whatever is already cached rather than failing outright, mirroring `routes/prices.py`. Historical
close prices for past dates are immutable once cached (no TTL needed, unlike `price_cache`'s
5-minute TTL for the live current-price endpoint); only "today"'s row may be re-fetched on a
later day once it stops being "today" — acceptable staleness for a historical chart, since the
live current-price panel is unaffected (it uses `/api/prices`, not this endpoint)

**Scale/Scope**: Single-user personal portfolios; day-granularity range spans at most a few years
(`All` = from the user's first-ever op to today) across a handful of coins — no pagination or
streaming needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — `computeTimeline`'s new logic stays in
  `shared/src/portfolio.ts`; `ProfitTab` (web) is the only consumer touched. Nothing here is used
  by `mobile/`, so no mobile parity check is required, matching how items 6–9's view redesigns
  were also web-only. **PASS**.
- **II. Security at the Boundary** — the new `/api/prices/history` endpoint validates `ids`
  against the same `^[a-z0-9-]{1,120}$` pattern `routes/prices.py` already uses, and validates
  `from`/`to` as `YYYY-MM-DD` before building the CoinGecko URL. Auth via existing `require_auth`.
  **PASS**.
- **III. Behavior Coverage Over Line Coverage** — tasks include: cache-hit, cache-miss, partial-hit,
  and malformed-input tests for the new route; `computeTimeline` tests for the fallback rule,
  windowed range, and the "no asset before acquisition" invariant; `TimeframeSelector` option
  switching and persistence tests. **PASS** (tracked as explicit tasks, not just coverage %).
- **IV. No Speculative Code** — no new npm/pip package; `TimeframeSelector` is a single small
  controlled component (mirrors existing segmented controls in `WalletTab`/`ProfitTab`); the
  `_COIN_ID_RE` regex is duplicated into the new route file rather than extracted into a shared
  module, consistent with `exit_prices.py`/`prices.py` already not sharing that check. **PASS**.
- **V. Accessibility and Internationalisation** — `TimeframeSelector` labels come from new i18n
  keys (`timeframe_1d`…`timeframe_all`) added to all 10 locale files; buttons use
  `aria-pressed`, consistent with existing segmented controls. **PASS**.

No violations to record in Complexity Tracking.

**Post-Phase-1 re-check**: `data-model.md` and `contracts/prices-history-api.md` introduce no new
dependency, no cross-package duplication of shared logic, and no untested surface beyond what
Principle III already requires as tasks. Gates still **PASS** unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/013-historical-prices/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── prices-history-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── db/
│   ├── schema.sql                         # add price_history table (idempotent)
│   └── migrations/
│       └── 006_price_history.sql          # new — additive, mirrors schema.sql
├── app/
│   ├── main.py                             # register price_history router
│   └── routes/
│       └── price_history.py               # new — GET /api/prices/history
└── tests/
    └── test_price_history.py              # new — cache hit/miss/partial, validation

shared/
└── src/
    └── portfolio.ts                        # computeTimeline signature + algorithm change

web/
├── src/
│   ├── lib/
│   │   ├── api/client.ts                   # add api.getPriceHistory(ids, from, to)
│   │   └── portfolio.test.ts               # update existing computeTimeline tests
│   └── components/
│       ├── TimeframeSelector.tsx           # new
│       ├── TimeframeSelector.test.tsx      # new
│       ├── ProfitTab.tsx                   # wire selector + historical fetch
│       └── ProfitTab.test.tsx              # update for new data flow
shared/src/i18n/
├── types.ts                                 # timeframe_1d..timeframe_all keys
└── locales/*.ts                             # all 10 locales
```

**Structure Decision**: Existing monorepo layout (`backend/` FastAPI service, `web/` Vite+React
app, `shared/` pure-TS package) is reused as-is; this item adds one backend route + table, one
shared function change, and one new web component — no new top-level directories.

## Complexity Tracking

*No violations — table intentionally omitted.*

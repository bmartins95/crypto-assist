# Implementation Plan: Price Provider Abstraction

**Branch**: `feat/price-provider-abstraction` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-price-provider-abstraction/spec.md`

## Summary

Coin search currently runs client-side against `api.coingecko.com` directly (full
15k-coin list fetch + local fuzzy filter, with the vendor's own `/search` as a fallback),
which is a direct third-party dependency from the browser and has already broken once in
production via a CSP block. This feature moves coin search entirely behind a new backend
endpoint (`GET /api/coins/search`), and generalizes the backend's existing CoinGecko-only
price/history fetching behind a `PriceProvider` abstraction so the vendor is a
configuration choice, not something wired into every route. A second provider slot
(`CryptoCompareProvider`) is added as a structural skeleton only — CoinGecko remains the
only working implementation in this feature. Both `price_cache` and `price_history` gain
an additive, backfilled `symbol` column so a future ticker-based provider has the data it
needs without another migration.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript (web, Vite + React 19)

**Primary Dependencies**: FastAPI, Mangum, psycopg v3, httpx (backend); TanStack Router,
Vitest + Testing Library (web)

**Storage**: AWS RDS Aurora (PostgreSQL) — additive migration on `price_cache` and
`price_history`

**Testing**: pytest (backend, `cd backend && pytest`), Vitest (web, `cd web && npm test`)

**Target Platform**: AWS Lambda (backend, via SST/Mangum), static web app served via
CloudFront/S3

**Project Type**: Web application (existing `backend/` + `web/` + `shared/` monorepo split)

**Performance Goals**: No new performance target — parity with existing `/api/prices` and
`/api/prices/history` latency/caching behavior (SC-002)

**Constraints**: No new npm/pip dependency (CryptoCompare skeleton makes no HTTP calls, so
no HTTP client dependency is needed for it); additive-only migration (Constitution /
Technology Standards — Aurora migrations are additive only)

**Scale/Scope**: Backend: 1 new route module, 1 new abstraction module, 2 new provider
modules, 1 migration. Web: delete 1 module (`coingecko.ts`), edit 2 components
(`OpDrawer.tsx`, `AppLayout.tsx`), add 1 api client method.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — No `shared/` types change (coin search result and
  price shapes are already backend/web-only concerns, not shared portfolio logic). PASS.
- **II. Security at the Boundary** — New endpoint validates `q` at the boundary (empty
  rejected) and requires the same auth as every other endpoint (per clarification). No
  secrets added to source; `CryptoCompareProvider` needs no API key since it does no real
  network I/O. PASS.
- **III. Behavior Coverage Over Line Coverage** — Plan requires updating existing
  `test_prices.py`/`test_price_history.py` patch targets (research.md §10) plus new
  `test_coins.py` and provider-level tests covering happy path, empty query (400), missing
  auth (401), and the "not implemented" provider-swap path. PASS (verified again after
  Phase 1 design below).
- **IV. No Speculative Code** — The second provider is deliberately reduced to a
  no-network skeleton per clarification, specifically to avoid building unused
  CryptoCompare integration code ahead of need. The `symbol` column is additive and
  scoped to what FR-006/FR-011 require, not a general crosswalk table (explicitly ruled out
  in PLAN.md and the spec's Assumptions). PASS.
- **V. Accessibility and Internationalisation** — No new UI strings; `CoinSearch`'s
  existing markup/labels are unchanged, only its data source moves. PASS.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-price-provider-abstraction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── coins-search.md  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── config.py                    # + price_provider setting
│   ├── price_provider.py            # NEW — PriceProvider ABC, PricedAsset, get_provider()
│   ├── providers/
│   │   ├── coingecko.py             # NEW — CoinGeckoProvider (extracted from routes/*.py)
│   │   └── cryptocompare.py         # NEW — CryptoCompareProvider skeleton
│   └── routes/
│       ├── coins.py                 # NEW — GET /api/coins/search
│       ├── prices.py                # MODIFIED — delegates to get_provider(), resolves symbols
│       └── price_history.py         # MODIFIED — delegates to get_provider(), resolves symbols
├── db/
│   ├── schema.sql                   # MODIFIED — symbol column on price_cache/price_history
│   └── migrations/
│       └── 007_price_symbol.sql     # NEW — additive column + backfill
└── tests/
    ├── test_coins.py                # NEW
    ├── test_prices.py               # MODIFIED — patch target moves to providers.coingecko
    └── test_price_history.py        # MODIFIED — same

web/
└── src/
    ├── lib/
    │   ├── coingecko.ts             # DELETED
    │   └── api/client.ts            # MODIFIED — + searchCoins(query)
    └── components/
        ├── OpDrawer.tsx             # MODIFIED — CoinSearch uses api.searchCoins + api.getPrices
        ├── OpDrawer.test.tsx        # MODIFIED — mocks api client instead of coingecko.ts
        └── AppLayout.tsx            # MODIFIED — drop getCoinList prefetch
```

**Structure Decision**: Existing `backend/app/routes/` + new `backend/app/providers/`
package (mirrors the existing flat-module-per-concern layout; a `providers/` subpackage is
warranted here specifically because there will be ≥2 provider implementations plus the
ABC, unlike every other single-file route concern). No new top-level project — this is a
refactor within the existing `backend/` and `web/` structure.

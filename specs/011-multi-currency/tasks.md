# Tasks: Multi-currency display

**Input**: Design documents from `/specs/011-multi-currency/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the constitution mandates behavior coverage (≥90% on changed modules).

## Phase 1: Setup

No setup tasks — the monorepo, toolchains and test suites already exist; no new dependencies are introduced.

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: USD reference prices, shared currency types, and the schema every story builds on.

- [X] T001 Add `Currency`, `ExchangeRates` types and optional `NewOp.currency` in shared/src/types.ts
- [X] T002 Export new symbols from shared/src/index.ts
- [X] T003 [P] Remove hardcoded 2-decimal override in `fmt()` so Intl applies per-currency decimals in shared/src/format.ts
- [X] T004 [P] Add JPY (0-decimal) and BRL-unchanged formatting tests in web/src/lib/format.test.ts
- [X] T005 Create migration backend/db/migrations/005_usd_prices_and_currency.sql (rename price_brl→price_usd + force-expire cache, create exchange_rates, add ops.currency) and update backend/db/schema.sql — **PAUSE: present SQL for user approval before committing (DB change)**
- [X] T006 Add `currency` field to NewOp/Op models and `ExchangeRatesResponse` in backend/app/models.py
- [X] T007 Switch CoinGecko call to vs_currency=usd and all price_brl references to price_usd in backend/app/routes/prices.py
- [X] T008 [P] Update cached/fetched price assertions to price_usd in backend/tests/test_prices.py

**Checkpoint**: `pytest` green with USD price cache; shared types compile in web and mobile.

## Phase 3: User Story 2 — Accurate conversion via exchange rates (P2, blocks US1 display math)

**Goal**: `/api/exchange-rates` returns USD-referenced rates, cached 1 h, stale-fallback on upstream failure.

**Independent Test**: two requests within an hour → one upstream call; rates match contract shape; 401 without token.

- [X] T009 [US2] Implement GET /api/exchange-rates per contracts/exchange-rates.md in backend/app/routes/exchange_rates.py
- [X] T010 [US2] Register the exchange_rates router in backend/app/main.py
- [X] T011 [P] [US2] Tests: fresh fetch, cache hit (no upstream call), stale fallback on 429/error, 502 when no cache, 401 unauthenticated in backend/tests/test_exchange_rates.py
- [X] T012 [P] [US2] Add `getExchangeRates()` to web/src/lib/api/client.ts

**Checkpoint**: endpoint verifiable with curl per quickstart step 1.

## Phase 4: User Story 1 — Switch display currency (P1, MVP)

**Goal**: Settings selector switches every displayed value on web instantly; preference persists.

**Independent Test**: quickstart steps 2–4.

- [X] T013 [US1] Add `convertOpsToUsd(ops, rates)` in shared/src/portfolio.ts (+ export in shared/src/index.ts)
- [X] T014 [P] [US1] Tests for convertOpsToUsd (BRL default, mixed currencies, USD passthrough) in web/src/lib/portfolio.test.ts
- [X] T015 [US1] Create CurrencyContext (currency + setCurrency + rates + ratesStatus, localStorage persistence, one fetch per session, last-good-rates fallback) in web/src/context/CurrencyContext.tsx
- [X] T016 [P] [US1] CurrencyContext tests (default BRL, persistence, fetch failure→stale, no cache→unavailable) in web/src/context/CurrencyContext.test.tsx
- [X] T017 [US1] Wrap the app with CurrencyProvider in web/src/main.tsx
- [X] T018 [P] [US1] Add currency + rates-status UI strings to shared/src/i18n/types.ts and all 10 shared/src/i18n/locales/*.ts
- [X] T019 [US1] Wire the currency selector (replace disabled placeholder, label + a11y) in web/src/pages/settings.tsx
- [X] T020 [US1] Convert USD values to display currency at fmt() boundary (metrics, table, exit-price semantics per research R6) in web/src/components/WalletTab.tsx
- [X] T021 [US1] Same conversion for profit metrics, charts and allocation in web/src/components/ProfitTab.tsx
- [X] T022 [P] [US1] Update settings tests for the working selector in web/src/pages/settings.test.tsx
- [X] T023 [P] [US1] Update WalletTab/ProfitTab tests for converted values and rates-status message in web/src/components/WalletTab.test.tsx and web/src/components/ProfitTab.test.tsx

**Checkpoint**: MVP — currency switch works end-to-end on web.

## Phase 5: User Story 3 — Operations record their entry currency (P3)

**Goal**: new ops persist the display currency at entry; legacy ops read back as BRL; history renders converted.

**Independent Test**: quickstart step 5.

- [X] T024 [US3] Persist/return `currency` in ops CRUD (INSERT/UPDATE/SELECT) in backend/app/routes/ops.py
- [X] T025 [US3] Include `currency` in export rows in backend/app/routes/export_data.py (import path covered by model default)
- [X] T026 [P] [US3] Tests: currency roundtrip, invalid currency 422, legacy default BRL, export/import currency in backend/tests/test_ops.py and backend/tests (import/export suites)
- [X] T027 [US3] Set `currency` from display currency on create/edit in web OpDrawer and convert history rows/summary in web/src/components/HistoryTab.tsx (and web/src/components/OpDrawer.tsx)
- [X] T028 [P] [US3] Update drawer/history tests for currency capture and converted display in web/src/components/HistoryTab.test.tsx and web/src/components/OpDrawer.test.tsx

**Checkpoint**: mixed-currency ops produce consistent totals in any display currency.

## Phase 6: User Story 4 — Mobile parity (P3)

**Goal**: mobile settings currency row works; all screens convert; choice persists in AsyncStorage.

**Independent Test**: quickstart-equivalent on Expo per spec US4.

- [ ] T029 [US4] Create AsyncStorage-backed CurrencyContext in mobile/src/context/CurrencyContext.tsx
- [ ] T030 [P] [US4] Add `getExchangeRates()` to mobile/src/lib/api/client.ts
- [ ] T031 [US4] Wrap navigator root with CurrencyProvider in mobile/app/_layout.tsx
- [ ] T032 [US4] Wire the currency row picker (replace placeholder) in mobile/app/settings.tsx
- [ ] T033 [US4] Convert values via context + convertOpsToUsd in mobile/app/(tabs)/wallet.tsx, mobile/app/(tabs)/profit.tsx, mobile/app/(tabs)/history.tsx (set op currency on create)
- [ ] T034 [US4] Verify mobile type contract + build (npx tsc / expo export) before PR

**Checkpoint**: constitution Principle I satisfied (mobile builds, screens render).

## Phase 7: Polish

- [ ] T035 Run backend coverage (pytest --cov=app) and web coverage (npm run coverage); ensure ≥90% on changed modules; fix gaps
- [ ] T036 Execute quickstart.md verification steps 1–6 end-to-end and fix anything broken

## Dependencies

- Phase 2 blocks everything (types, USD prices, schema).
- US2 (Phase 3) blocks US1 (Phase 4): display conversion needs rates.
- US1 blocks US3's web half (T027 uses CurrencyContext) and US4 (mobile reuses convertOpsToUsd + patterns).
- US3 backend (T024–T026) is independent of US1 and can run parallel to Phase 4.

## Parallel execution examples

- After T001–T002: T003+T004 ∥ T005 ∥ T006.
- After T009–T010: T011 ∥ T012.
- Within US1: T014 ∥ T016 ∥ T018 ∥ T022 ∥ T023 once their implementation tasks land.
- US3 backend (T024–T026) ∥ US1 frontend (T015–T023).

## Implementation strategy

MVP = Phases 2–4 (foundational + rates + web switch). Then US3 (op currency), US4 (mobile), polish. Single PR per plan-item rule; commits grouped per phase.

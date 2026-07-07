---

description: "Task list for Item 12 — Historical Charts + Timeframe Selector"
---

# Tasks: Historical Charts + Timeframe Selector

**Input**: Design documents from `/specs/013-historical-prices/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/prices-history-api.md, quickstart.md

**Tests**: Included — required by Constitution Principle III (Behavior Coverage Over Line
Coverage) and `PLAN.md`'s pre-PR gate (`pytest`, `npm test` must pass with new coverage).

**Organization**: Tasks are grouped by user story. User Story 2 depends on User Story 1's
corrected data (the spec explicitly calls this out — it is not an independent-in-parallel story
like the template default assumes), so the two phases run sequentially, not in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 or US2

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The `price_history` table must exist before the US1 backend endpoint can be built
against it. Nothing else is shared/blocking between the two stories.

- [ ] T001 Add `price_history` table to `backend/db/schema.sql` (`CREATE TABLE IF NOT EXISTS price_history (coin_id text NOT NULL, date date NOT NULL, price_usd numeric(30,10) NOT NULL, PRIMARY KEY (coin_id, date))`, per `data-model.md`)
- [ ] T002 [P] Add `backend/db/migrations/006_price_history.sql` mirroring T001's `CREATE TABLE IF NOT EXISTS` for already-deployed databases (same pattern as `005_usd_prices_and_currency.sql`'s `exchange_rates` table)

**Checkpoint**: `price_history` table exists on fresh and already-deployed databases.

---

## Phase 2: User Story 1 - Accurate profit-over-time chart (Priority: P1) 🎯 MVP

**Goal**: "Lucro no tempo" and "Valor da carteira" price every past date with the price actually
in effect on that date (with the 7-day-back-then-zero fallback), across the full operation
history — no timeframe selector yet.

**Independent Test**: With a portfolio spanning several months and an asset whose price has
moved significantly since purchase, load `/profit`, switch to each of the two time-based chart
modes, and confirm plotted values match that date's real historical price, not today's.

### Tests for User Story 1 ⚠️

> Write these first; confirm they fail before implementing.

- [ ] T003 [P] [US1] `backend/tests/test_price_history.py` — cache hit (no CoinGecko call when all dates cached), cache miss (CoinGecko `market_chart` called, rows upserted into `price_history`), partial hit (some dates cached, some fetched), malformed `coin_id` → 400, malformed/missing `from`/`to` or `to < from` → 400, no auth header → 401, CoinGecko 429/failure with some cache present → falls back to cached subset (200, coin present), CoinGecko failure with nothing cached for a coin → that coin omitted from response (200, not 502), CoinGecko failure with nothing cached for *any* requested coin → 502
- [ ] T004 [P] [US1] `web/src/lib/portfolio.test.ts` — rewrite/extend `computeTimeline` tests for the new signature: a date priced from `historicalPrices` (not `prices`/today), nearest-earlier-date fallback within 7 days, zero fallback beyond 7 days or with no history at all, an asset never contributing before its first `Buy` date, omitted `from`/`to` defaulting to earliest-op-date..today

### Implementation for User Story 1

- [ ] T005 [US1] `backend/app/routes/price_history.py` — new `GET ""` route: validate `ids` against `^[a-z0-9-]{1,120}$` (own copy of the regex, matching `prices.py`'s existing per-route convention), validate `from`/`to` as `YYYY-MM-DD` with `to >= from`; query `price_history` for cached `(coin_id, date)` rows in range; for coins with gaps, call `GET https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={N}&interval=daily` once per coin (reusing the demo-key query param pattern from `prices.py`'s `_fetch_from_coingecko`), upsert results (`ON CONFLICT (coin_id, date) DO UPDATE`); on CoinGecko 429/failure fall back to whatever is cached, omitting a coin entirely only if it has zero cached data, and raising 502 only if the merged result is empty across every requested coin; return `Record<coinId, Record<date, price>>` filtered to `[from, to]`
- [ ] T006 [US1] `backend/app/main.py` — `app.include_router(price_history.router, prefix="/api/prices/history")` (depends on T005)
- [ ] T007 [US1] `shared/src/portfolio.ts` — change `computeTimeline` to `computeTimeline(ops: Op[], historicalPrices: Record<string, Record<string, number>>, from?: string, to?: string): TimelinePoint[]`: sort ops ascending; replay ops dated before `from` (default: date of earliest op) into a starting `holdings` map without emitting points; then for each calendar day from `from` to `to` (default: today) inclusive, apply that day's ops in order, price each held coin via `historicalPrices[coinId][day]` else nearest earlier date within 7 days else `0`, and push one `TimelinePoint`
- [ ] T008 [US1] `web/src/lib/api/client.ts` — add `getPriceHistory: (ids: string[], from: string, to: string) => request<Record<string, Record<string, number>>>(`/api/prices/history?ids=${ids.join(',')}&from=${from}&to=${to}`)` to the `api` object
- [ ] T009 [US1] `web/src/components/ProfitTab.tsx` — when `activeChart` is `over-time` or `value`, derive the full op date range (earliest op date → today), call `api.getPriceHistory` for the distinct `coinId`s in `ops` over that range, and pass the result plus the range into `computeTimeline` instead of `prices`; show the chart-area-only loading overlay from `docs/design/item-12-design-notes.md` while the fetch is in flight, keeping axes in place
- [ ] T010 [US1] `web/src/components/ProfitTab.test.tsx` — update existing chart tests to mock `api.getPriceHistory` and assert the "Lucro no tempo"/"Valor da carteira" charts are built from its response rather than the live `prices` map

**Checkpoint**: Both time-based charts are date-correct across full history. No selector control
exists yet — this alone is a shippable correctness fix.

---

## Phase 3: User Story 2 - Zoom into a shorter timeframe (Priority: P2)

**Goal**: A `TimeframeSelector` (1D/1W/1M/1Y/All) in the chart panel header narrows both
time-based charts to one shared window, persisted per device, hidden on "Por ativo".

**Independent Test**: With a multi-month portfolio (already date-correct per US1), switch the
timeframe selector through each option and confirm both charts reflow to the selected window
without a reload, an asset acquired mid-window never appears before its acquisition date, and a
window with <2 points shows the empty state.

**Depends on**: Phase 2 (US1) complete — this story reuses `computeTimeline`'s `from`/`to`
parameters and `ProfitTab`'s `api.getPriceHistory` wiring from US1 rather than duplicating them.

### Tests for User Story 2 ⚠️

> Write these first; confirm they fail before implementing.

- [ ] T011 [P] [US2] `web/src/components/TimeframeSelector.test.tsx` — renders all 5 options with i18n labels, clicking an option calls `onChange` with that option's value, the option matching the `value` prop has `aria-pressed="true"`, left/right arrow keys move focus/selection between options
- [ ] T012 [US2] `web/src/components/ProfitTab.test.tsx` — add: selecting a timeframe option narrows the `from`/`to` passed to `api.getPriceHistory`/`computeTimeline`; the selector is rendered for `over-time`/`value` modes and absent for `by-asset`; a selection with <2 resulting points renders the empty-state message instead of a chart; the selected timeframe is written to and read back from `localStorage['profit_timeframe']`

### Implementation for User Story 2

- [ ] T013 [P] [US2] `shared/src/i18n/types.ts` — add `timeframe_1d`, `timeframe_1w`, `timeframe_1m`, `timeframe_1y`, `timeframe_all` to `UIText`
- [ ] T014 [US2] `shared/src/i18n/locales/*.ts` (all 10 locale files) — add translations for the 5 new keys (`pt-BR`: `1D`/`1S`/`1M`/`1A`/`Tudo`, per `docs/design/item-12-design-notes.md`; other locales use the equivalent short abbreviation) (depends on T013)
- [ ] T015 [US2] `web/src/components/TimeframeSelector.tsx` — new controlled component: `value: '1d' | '1w' | '1m' | '1y' | 'all'`, `onChange: (v) => void`; compact segmented control per `item-12-design-notes.md` (`.tf` / `.tf button` / `.tf button.on` classes), `aria-pressed` per option, arrow-key navigation between options
- [ ] T016 [US2] `web/src/app/globals.css` (or the existing shared stylesheet already holding `.chart-switcher`/`.chart-btn`) — add `.tf` / `.tf button` / `.tf button.on` rules from `item-12-design-notes.md`
- [ ] T017 [US2] `web/src/components/ProfitTab.tsx` — add `timeframe` state initialized from `localStorage['profit_timeframe']` (default `'1m'`), persisted on change; render `<TimeframeSelector>` right-aligned in the chart panel header, visible only for `over-time`/`value`; compute `from`/`to` from the selection (today minus 1/7/30/365 days, or earliest op date for `'all'`) and pass to the existing `api.getPriceHistory` + `computeTimeline` call from US1 instead of the full-history default; render the `item-12-design-notes.md` empty state (`Sem dados no período` via i18n) when the resulting timeline has fewer than 2 points (depends on T015)

**Checkpoint**: All user stories independently functional; full item done-criteria in `PLAN.md`
Item 12 satisfied.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T018 Run `cd backend && pytest --cov=app --cov-report=term-missing` and confirm `app/routes/price_history.py` is ≥90% covered
- [ ] T019 Run `cd web && npm test` and confirm all updated/new suites pass
- [ ] T020 Walk the `quickstart.md` manual verification checklist against a local dev environment (SC-001 through SC-004)
- [ ] T021 Tick Item 12's checkbox in `PLAN.md` (separate `chore:` commit per repo workflow — not bundled into this feature's PR)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. Blocks Phase 2 (the backend
  route needs the table to exist).
- **User Story 1 (Phase 2)**: Depends on Phase 1. This is the MVP — a correctness fix shippable
  on its own.
- **User Story 2 (Phase 3)**: Depends on Phase 2 (reuses its endpoint wiring and `computeTimeline`
  parameters) — **not** parallelizable with Phase 2, unlike the usual independent-stories default.
- **Polish (Phase 4)**: Depends on Phase 2 and, if included in this PR, Phase 3.

### Within Each Phase

- Tests (T003/T004, T011/T012) are written and confirmed failing before their corresponding
  implementation tasks.
- T005 (route) before T006 (registration) before T009 (frontend call site).
- T007 (`computeTimeline`) is independent of T005/T006/T008 (different package) and can proceed
  in parallel with them once T004's tests exist.
- T013 (i18n type) before T014 (locale translations) before T015 (component using the keys).

### Parallel Opportunities

- T002 (migration file) can run alongside T001 (schema.sql) — different files, same content.
- T003 (backend tests) and T004 (shared tests) can run in parallel — different packages.
- T007 (`computeTimeline`) can proceed in parallel with T005/T006/T008 (backend route + client) —
  different packages, no shared file.
- T011 (`TimeframeSelector` test) can start in parallel with T013 (i18n keys) — different files.

---

## Parallel Example: User Story 1

```bash
# Tests, in parallel (different packages):
Task: "backend/tests/test_price_history.py — cache hit/miss/partial, validation, fallback"
Task: "web/src/lib/portfolio.test.ts — computeTimeline historical pricing + fallback rules"

# Implementation, in parallel once tests exist (different packages):
Task: "backend/app/routes/price_history.py — GET /api/prices/history"
Task: "shared/src/portfolio.ts — computeTimeline day-walk rewrite"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Foundational): `price_history` table.
2. Phase 2 (US1): backend endpoint + `computeTimeline` fix + `ProfitTab` wiring, full history,
   no selector.
3. **STOP and VALIDATE**: SC-001 manually (an asset that moved >10% shows a different past chart
   than a naive "today's price everywhere" calculation).
4. This alone is mergeable — it fixes the core data-correctness bug PLAN.md Item 12 exists for.

### Incremental Delivery

1. Foundational → US1 (correctness fix, MVP) → validate → optionally ship.
2. US2 (timeframe selector UX) on top → validate SC-002/SC-003/SC-004 → ship.
3. Polish (coverage, PLAN.md tick) last.

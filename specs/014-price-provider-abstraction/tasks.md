---

description: "Task list for Price Provider Abstraction (PLAN.md item 13)"
---

# Tasks: Price Provider Abstraction

**Input**: Design documents from `/specs/014-price-provider-abstraction/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/coins-search.md, quickstart.md

**Tests**: Included in every phase — the project constitution (III. Behavior Coverage Over
Line Coverage) requires an explicit test for every user-facing behaviour, the happy path,
primary error paths, and documented edge cases; this supersedes the generic "tests are
optional" default.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) after a
shared Foundational phase that builds the abstraction itself.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

## Path Conventions

Existing monorepo layout: `backend/app/`, `backend/tests/`, `web/src/`. See plan.md
"Project Structure" for the exact file list.

---

## Phase 1: Setup

- [X] T001 Create empty `backend/app/providers/__init__.py` package.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the `PriceProvider` abstraction and extract existing CoinGecko logic
behind it. Required before any user story's acceptance scenarios can be verified.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Define `PricedAsset` dataclass and `PriceProvider` ABC (`search_coins`,
      `get_prices`, `get_history` per data-model.md) plus `get_provider()` factory in
      `backend/app/price_provider.py`; factory reads `settings.price_provider` and
      currently resolves only `"coingecko"` (the `"cryptocompare"` branch is added in US2).
- [X] T003 [P] Add `price_provider: str = "coingecko"` field to `Settings` in
      `backend/app/config.py`.
- [X] T004 Create `backend/app/providers/coingecko.py` with `CoinGeckoProvider`:
      - `get_prices` — move `_fetch_from_coingecko` out of `backend/app/routes/prices.py`
        unchanged (same URL, same 429/502 handling), reading only `.coin_id` off each
        `PricedAsset`.
      - `get_history` — move `_fetch_market_chart` out of
        `backend/app/routes/price_history.py` unchanged, same treatment.
      - `search_coins` — new: calls `https://api.coingecko.com/api/v3/search?query=...`
        (same `x_cg_demo_api_key` pattern as the other two), returns
        `{id, symbol, name, market_cap_rank}` entries per contracts/coins-search.md.
- [X] T005 Update `backend/app/routes/prices.py` to delegate to
      `get_provider().get_prices([PricedAsset(coin_id=cid, symbol=None) for cid in
      stale_ids])` instead of calling `_fetch_from_coingecko` directly (symbol resolution
      itself is US3's job — pass `None` for now). Remove the now-dead
      `_fetch_from_coingecko` and the direct `httpx` import.
- [X] T006 Update `backend/app/routes/price_history.py` to delegate to
      `get_provider().get_history(PricedAsset(coin_id=cid, symbol=None), ...)` instead of
      `_fetch_market_chart`. Remove the now-dead function and direct `httpx` import.
- [X] T007 [P] Update `backend/tests/test_prices.py`: change the `_mock_httpx` patch
      target from `app.routes.prices.httpx.Client` to
      `app.providers.coingecko.httpx.Client` (research.md §10). No assertion changes.
- [X] T008 [P] Update `backend/tests/test_price_history.py` with the equivalent patch
      target change.

**Checkpoint**: `cd backend && pytest` passes with the exact same behavior as before this
phase (SC-002) — the abstraction exists but nothing user-visible has changed yet.

---

## Phase 3: User Story 1 - Coin search never exposes the API key to the browser (Priority: P1) 🎯 MVP

**Goal**: Coin search is served entirely by the backend; the browser never calls
`api.coingecko.com` directly.

**Independent Test**: Open DevTools → Network while searching for a coin in the operation
entry drawer. Confirm the only request is to this app's own backend and results still
populate as before.

### Tests for User Story 1

- [X] T009 [P] [US1] `backend/tests/test_coins.py`: search with a valid `q` returns results
      (mock `get_provider().search_coins`); empty/missing `q` → 400; missing
      `Authorization` header → 401.

### Implementation for User Story 1

- [X] T010 [US1] Create `backend/app/routes/coins.py`: `GET ""` endpoint behind
      `require_auth`, rejects empty/missing `q` with 400, default `limit=7`, calls
      `get_provider().search_coins(q)[:limit]` per contracts/coins-search.md.
- [X] T011 [US1] Register the router in `backend/app/main.py`:
      `app.include_router(coins.router, prefix="/api/coins/search")`.
- [X] T012 [US1] Add `searchCoins(query: string): Promise<CoinSearchResult[]>` to
      `web/src/lib/api/client.ts` calling `GET /api/coins/search?q=...`.
- [X] T013 [US1] Update `web/src/components/OpDrawer.tsx`: `CoinSearch` calls
      `api.searchCoins(query)` instead of `getCoinList`/`filterCoinList`/`searchCoins` from
      `@/lib/coingecko`; keep the debounce/sequence-guard logic in `runSearch` as-is; move
      the small local fuzzy-filter used for the `restrictTo` (owned-assets) seed into an
      inline helper in this file; replace `fetchSinglePrice(coin.coinId, apiKey)` calls
      with `api.getPrices([coin.coinId])`; remove the `apiKey` prop from `Props` and
      `CoinSearch`'s params.
- [X] T014 [US1] Update `web/src/components/AppLayout.tsx`: remove the `getCoinList('')`
      prefetch call on mount and its `@/lib/coingecko` import.
- [X] T015 [US1] Delete `web/src/lib/coingecko.ts`.
- [X] T016 [US1] Update `web/src/components/OpDrawer.test.tsx`: replace the
      `vi.mock('@/lib/coingecko', ...)` block with mocks of `api.searchCoins` and
      `api.getPrices` from `@/lib/api/client`; keep the same scenario coverage (empty
      results, race-guard on rapid typing, price auto-fill, price-fetch failure).
- [X] T017 [US1] Grep `web/src/components/HistoryTab.tsx` and
      `HistoryTab.test.tsx` for leftover `apiKey`/`coingecko` references and remove any
      that remain (the prop is already unused at the router level per research.md §1).

**Checkpoint**: User Story 1 fully functional — coin search works end-to-end through the
backend, no direct `api.coingecko.com` calls from the browser.

---

## Phase 4: User Story 2 - Price data source is swappable via configuration, proven by a second provider slot (Priority: P2)

**Goal**: `PRICE_PROVIDER=cryptocompare` resolves to a distinct provider that the backend
can select purely by configuration, proving the abstraction without a working second
integration.

**Independent Test**: Set `PRICE_PROVIDER=cryptocompare` and confirm search/price/history
requests resolve to the second provider and surface a clear "not implemented" error rather
than crashing or silently using CoinGecko.

### Tests for User Story 2

- [X] T018 [P] [US2] `backend/tests/test_price_provider.py`: `get_provider()` returns
      `CoinGeckoProvider` by default and `CryptoCompareProvider` when
      `settings.price_provider == "cryptocompare"`; each `CryptoCompareProvider` method
      raises `NotImplementedError`.
- [X] T019 [P] [US2] Extend `backend/tests/test_coins.py` and `test_prices.py`: with
      `get_provider` overridden/patched to return a `CryptoCompareProvider`, each route
      responds with a clear "not implemented" error status (not a 500, not CoinGecko data).

### Implementation for User Story 2

- [X] T020 [US2] Create `backend/app/providers/cryptocompare.py`: `CryptoCompareProvider`
      implementing `PriceProvider`; every method (`search_coins`, `get_prices`,
      `get_history`) raises `NotImplementedError("CryptoCompareProvider is not yet
      implemented")`. No HTTP client, no API key setting (research.md §8).
- [X] T021 [US2] Wire the `"cryptocompare"` branch into `get_provider()` in
      `backend/app/price_provider.py`.
- [X] T022 [US2] In `backend/app/routes/coins.py`, `prices.py`, and `price_history.py`, add
      an `except NotImplementedError as e: raise HTTPException(status_code=501,
      detail=str(e))` clause at the `get_provider()` call site in each route. This clause
      MUST be ordered so it runs before — and is not shadowed by — the existing
      CoinGecko-specific fallback handling: `prices.py`'s `except HTTPException:` /
      `except Exception:` stale-cache fallback (lines ~97-110) and `price_history.py`'s
      per-coin `except HTTPException: continue` best-effort loop (line ~109) do NOT catch a
      bare `NotImplementedError` today, so without this ordering the error would either
      surface as an uncaught 500 (`price_history.py`) or get misreported as a generic
      upstream 502 (`prices.py`) instead of the clear 501 "not implemented" outcome FR-005
      and User Story 2 Acceptance Scenario 3 require.

**Checkpoint**: Both user stories independently pass; switching `PRICE_PROVIDER` changes
behavior without touching route code (SC-003).

---

## Phase 5: User Story 3 - Priced assets carry both their canonical id and their ticker (Priority: P3)

**Goal**: Every current/historical price fetch retains the coin's ticker symbol alongside
its canonical id, including a one-time backfill of existing cached rows.

**Independent Test**: Fetch a price/history for a coin the requesting user has an existing
op for; confirm the cached/stored row includes both `coin_id` and `symbol`. Confirm a
pre-existing row with no matching op keeps `symbol IS NULL` without erroring.

### Tests for User Story 3

- [X] T023 [P] [US3] `backend/tests/test_prices.py`: a cache-miss fetch for a coin_id with
      a matching `ops` row upserts `price_cache.symbol`; a coin_id with no matching `ops`
      row upserts with `symbol IS NULL` and does not error. The route now issues two
      distinct SELECTs against the same mocked connection (the `ops` symbol lookup, then
      the existing `price_cache` lookup) — `conftest.make_pg_stub` returns one static
      `fetchall()` result regardless of which SQL ran, so it cannot disambiguate them.
      Build the cursor mock directly with `cur.execute.side_effect` (or `cur.fetchall.
      side_effect`) keyed off the SQL text/call order to return the `ops` rows for the
      first `execute` and the `price_cache` rows for the second, rather than reusing
      `make_pg_stub` as-is.
- [X] T024 [P] [US3] `backend/tests/test_price_history.py`: equivalent coverage for
      `price_history.symbol`, with the same two-distinct-queries mocking approach as T023.

### Implementation for User Story 3

- [X] T025 [US3] Create `backend/db/migrations/007_price_symbol.sql`: additive
      `ALTER TABLE ... ADD COLUMN IF NOT EXISTS symbol text` on both `price_cache` and
      `price_history`, followed by the one-time backfill join against `ops` (research.md
      §9). **Pause here for explicit user approval before this migration is applied to any
      real environment** — database schema changes require sign-off per project policy.
      *(Migration file written and verified by applying it to the local disposable dev
      Postgres container only — NOT applied to dev/staging/prod; that requires the
      deploy pipeline, gated by PR review/merge.)*
- [X] T026 [US3] Update `backend/db/schema.sql` to include `symbol text` on `price_cache`
      and `price_history` so fresh installs match the migrated shape.
- [X] T027 [US3] Update `backend/app/routes/prices.py`: resolve `coin_id → symbol` for the
      requesting user's own `ids` via
      `SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops WHERE user_id = %s AND coin_id
      = ANY(%s)` (research.md §6); build real `PricedAsset(coin_id, symbol)` values for the
      provider call; upsert `price_cache` with
      `symbol = COALESCE(EXCLUDED.symbol, price_cache.symbol)` (research.md §7).
- [X] T028 [US3] Apply the equivalent change to `backend/app/routes/price_history.py` for
      `price_history`.

**Checkpoint**: All three user stories independently functional (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Update `web/AGENTS.md`'s "External APIs and CSP" section: remove the
      "until PLAN item 13" caveat, note `coingecko.ts` no longer exists, and note that
      `https://api.coingecko.com` can be removed from the CloudFront CSP `connect-src` in
      `aws-infra` as a follow-up (a separate repo/infra change, not performed by this
      branch).
- [ ] T030 [P] Update `backend/AGENTS.md`'s route/structure listing to include
      `price_provider.py`, `providers/`, and `routes/coins.py`.
- [ ] T031 Run `cd backend && pytest --cov=app --cov-report=term-missing`; confirm ≥90% on
      every changed module (constitution III) and paste the summary into the PR
      description.
- [ ] T032 [P] Run `cd web && npm run coverage`; paste the summary into the PR description.
- [ ] T033 Walk through `quickstart.md` manually: DevTools network check for zero
      `api.coingecko.com` requests during search, and the `PRICE_PROVIDER=cryptocompare`
      manual check. Additionally run `grep -r "api.coingecko.com" web/src` and confirm it
      returns no matches — a cheap, automatable stand-in for SC-001 alongside the manual
      DevTools check.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: blocks everything below.
- **US1 (Phase 3)**: depends only on Foundational. Ships the MVP.
- **US2 (Phase 4)**: depends only on Foundational (not on US1) — can run in parallel with
  Phase 3 if staffed separately.
- **US3 (Phase 5)**: depends only on Foundational (not on US1/US2) — touches the same two
  route files as Foundational's T005/T006, so in practice run after those land, but has no
  logical dependency on US1 or US2's own changes.
- **Polish (Phase 6)**: after all desired stories are complete.

## Parallel Example: Foundational

```bash
Task: "Define PricedAsset + PriceProvider ABC in backend/app/price_provider.py"
Task: "Add price_provider setting to backend/app/config.py"
```

(T004–T006 must follow T002/T003 since they import from `price_provider.py`.)

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1). This alone removes the direct browser →
CoinGecko dependency (the concrete security/reliability fix) and is independently
demonstrable. US2 and US3 are architecture/data-shape groundwork with no further
user-visible change — land them in the same PR (this is a single-PR plan item per
PLAN.md/constitution "PR scope") but they can be validated as separate checkpoints in the
order above.

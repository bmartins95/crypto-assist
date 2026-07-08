# Research: Price Provider Abstraction

## 1. Current architecture (as of this branch, post-Item 9)

PLAN.md item 13 was written against an older file layout (`HistoryTab.tsx` owning the coin
search form). Item 9 (`feat/history-view-refactor`) already extracted that into
`web/src/components/OpDrawer.tsx`. This research corrects the file list against the
codebase as it actually stands today.

**Decision**: Treat `web/src/components/OpDrawer.tsx` (not `HistoryTab.tsx`) as the real
frontend integration point, and `web/src/components/AppLayout.tsx` as the coin-list
prefetch site to also update.

**Rationale**: Grepping the current tree shows `HistoryTab.tsx` no longer imports anything
from `@/lib/coingecko`; `OpDrawer.tsx` does (`searchCoins`, `fetchSinglePrice`,
`getCoinList`, `filterCoinList`). `AppLayout.tsx` calls `getCoinList('')` on mount to warm
the cache.

**Alternatives considered**: Following PLAN.md's file list literally would silently no-op
(editing a component that has no relevant imports) and miss the actual integration.

## 2. What "coin search" currently means client-side

`web/src/lib/coingecko.ts` exposes four functions, three of which participate in "search":

- `getCoinList(apiKey)` — fetches CoinGecko's full `/coins/list` (~15k entries), cached 1h.
- `filterCoinList(list, query, limit)` — pure client-side fuzzy filter over that list
  (exact symbol match > prefix match > substring match), used both against the full list
  and against a small `restrictTo` seed of the user's own already-owned assets.
- `searchCoins(query, apiKey)` — calls CoinGecko's real `/search` endpoint; used only as a
  fallback when `getCoinList` itself fails to fetch (not as the primary search path).
- `fetchSinglePrice(coinId, apiKey)` — one-off current-price lookup for a newly-selected
  coin not already present in the `prices` map the drawer was given as a prop.

`apiKey` is threaded through all of these as a prop (`OpDrawer` → `CoinSearch`), but every
call site in the app (`router.tsx`, `AppLayout.tsx`) passes an empty string — no
`VITE_COINGECKO*` env var exists anywhere in `web/`. The vendor key was never actually
shipped to the browser after Item 1 (Google Drive removal) took the old
`coingeckoApiKey` config field out.

**Decision**: The real, already-documented pain this item fixes is not "a key leaks" (none
does today) but that the browser calls `api.coingecko.com` directly at all — which (a) is a
network-inspectable dependency on a third party, and (b) has already broken once in
production because CloudFront's CSP `connect-src` didn't allowlist it, silently degrading
search to "owned coins only" with no visible error (see prior incident notes). Moving the
call server-side removes both the direct dependency and, per that incident's own follow-up
note, lets `https://api.coingecko.com` be removed from CSP `connect-src` again (a change to
`aws-infra`, a separate repository — noted as a follow-up, not performed by this branch).

**Rationale**: FR-009 in the spec ("frontend MUST no longer hold or transmit the
price-vendor API key") is satisfied as a side effect of deleting `coingecko.ts` outright;
the substantive fix is FR-001 (search served entirely by the backend).

**Alternatives considered**: Keeping the client-side full-list-fetch-and-filter mechanism
and merely adding a backend fallback was rejected — it would keep the direct
`api.coingecko.com` dependency alive for the common case, which is exactly what this item
exists to remove.

## 3. Replacing client-side search with the backend endpoint

**Decision**: `CoinSearch` in `OpDrawer.tsx` calls a single new `api.searchCoins(query)`
(debounced client-side exactly as today — the existing 2-character minimum and
sequence-number race-guard in `runSearch`/`handleInput` are UI concerns, unrelated to the
data source, and are kept as-is). `getCoinList`, `filterCoinList` (against the full remote
list), and `searchCoins`/`fetchSinglePrice` from `coingecko.ts` are all removed from
`OpDrawer.tsx`; `web/src/lib/coingecko.ts` is deleted entirely per PLAN.md.

The small local fuzzy-filter used for `restrictTo` (filtering the user's own already-owned
assets, a small in-memory list — no network call, no vendor dependency) is kept, but as a
tiny inline helper local to `OpDrawer.tsx` rather than importing it from the deleted
`coingecko.ts` module (it has nothing to do with the price vendor; it's a pure array
filter over data already in memory).

`fetchSinglePrice` (current-price lookup for a newly-selected coin) is replaced by
`api.getPrices([coinId])`, which already exists and already goes through the backend's
cache — no new backend capability needed for this part.

**Rationale**: A real backend `/search` call (see §5) returns the same
market-cap-ranked, relevance-sorted result CoinGecko's own `/search` endpoint gives
today (already used as the client's fallback path), so behavior parity (spec User Story 1)
holds without needing to replicate the "fetch 15k coins, filter client-side" mechanism
server-side.

**Alternatives considered**: Proxying `/coins/list` + filtering server-side per request
was rejected as unnecessary work — CoinGecko's own `/search` endpoint already does
relevance ranking; re-deriving that client-side was a historical workaround for needing a
*fallback*, not a better primary mechanism.

## 4. Auth on the new search endpoint

**Decision** (per clarification): `GET /api/coins/search` requires the same `require_auth`
dependency as every other route under `/api/*`.

**Rationale**: Keeps one consistent auth policy across the whole API surface (Constitution
II — Security at the Boundary) and gets the A09 failed-auth WARNING logging path
(`dependencies.py`) for free, rather than carving out an unauthenticated exception.

## 5. Provider interface shape

**Decision**: `backend/app/price_provider.py` defines:

```python
@dataclass(frozen=True)
class PricedAsset:
    coin_id: str
    symbol: str | None

class PriceProvider(ABC):
    def search_coins(self, query: str) -> list[dict]: ...
    def get_prices(self, assets: list[PricedAsset]) -> list[dict]: ...
    def get_history(self, asset: PricedAsset, from_date: date, to_date: date) -> dict[str, float]: ...

def get_provider() -> PriceProvider: ...  # reads settings.price_provider
```

`get_prices`/`get_history` take `PricedAsset` (both identifiers) rather than a bare
`coin_id`, per PLAN.md's "Coin identifier mapping" note — `CoinGeckoProvider` only ever
reads `.coin_id`; a future ticker-based provider reads `.symbol` instead. `search_coins`
does not need this pairing — it's the reverse direction (discovering both identifiers from
free text).

**Rationale**: This is the one interface-shape decision PLAN.md explicitly calls for
("thread it through the method signatures rather than each provider re-deriving it").

**Alternatives considered**: Passing bare `coin_id` strings and having each provider
re-derive the symbol itself (e.g. a second DB round-trip inside the provider) was rejected
— it would require every provider to know about the `ops` table, coupling the price-vendor
abstraction to application persistence for no reason, when the caller (the route) already
has this data available.

## 6. Where the symbol comes from, and how it's threaded

**Decision**: Routes (`prices.py`, `price_history.py`) resolve `coin_id → symbol` for the
*requesting user's own* `ids` via a query already scoped by `user_id`:

```sql
SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops
WHERE user_id = %s AND coin_id = ANY(%s)
```

This is safe under Item 3's cross-user isolation hardening because it is scoped to the
caller's own `user_id` — it never reads another user's ops. In practice `ids` passed to
`/api/prices` and `/api/prices/history` already come from the requesting user's own asset
list (`collectAssets(ops)` in `shared/`), so a match is expected in the overwhelming
majority of calls; a miss (edge case — id not found among the caller's own ops) simply
yields a `None` symbol, per spec Edge Cases.

**Rationale**: Avoids widening the wire contract of `/api/prices`/`/api/prices/history`
(no new query params, no frontend changes needed for this part) and reuses the existing
"scope every query by `user_id`" pattern the isolation tests already exercise, rather than
inventing a new one.

**Alternatives considered**:
- *Have the frontend pass `symbols` alongside `ids` in the query string* — rejected: adds
  a wire-contract change and a second source of truth (client-derived) for data the backend
  can already resolve itself from data the same request's caller already owns.
- *An unscoped, global `SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops WHERE coin_id
  = ANY(%s)`* (no `user_id` filter) — rejected: `coin_id → symbol` is deterministic in
  practice, so this would "work", but it introduces the one unscoped query against `ops` in
  a codebase where Item 3 established that every `ops` query is `user_id`-scoped; not worth
  the inconsistency for a lookup the scoped version already satisfies.

## 7. Cache upsert: not clobbering a known symbol with a later unknown one

**Decision**: The `price_cache`/`price_history` upserts use
`symbol = COALESCE(EXCLUDED.symbol, price_cache.symbol)` (and the `price_history`
equivalent) instead of a bare overwrite.

**Rationale**: A coin_id's symbol, once recorded, does not change. A later refresh
triggered by a request where the *symbol lookup happened to miss* (edge case in §6) must
not erase a symbol a previous request already recorded.

## 8. Second provider slot scope (per clarification)

**Decision**: `backend/app/providers/cryptocompare.py` defines `CryptoCompareProvider`
implementing the `PriceProvider` ABC; every method (`search_coins`, `get_prices`,
`get_history`) raises `NotImplementedError` with a message identifying it as an
unimplemented provider slot. No HTTP client, no API key, no `CryptoCompareApiKey` setting.
It is registered in `get_provider()`'s config-driven switch (`price_provider ==
"cryptocompare"` resolves to it) so the configuration switch itself is provably real.

**Rationale**: Per clarification — CoinGecko remains the only working provider in this
feature; the second slot exists only to prove pluggability (SC-003) and give a future
migration somewhere to land, not to ship a second working integration.

## 9. Migration: additive `symbol` column + backfill

**Decision**: One migration file, `backend/db/migrations/007_price_symbol.sql`:

```sql
BEGIN;
ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS symbol text;
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS symbol text;

UPDATE price_cache pc SET symbol = o.symbol
FROM (SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops ORDER BY coin_id, created_at) o
WHERE pc.coin_id = o.coin_id AND pc.symbol IS NULL;

UPDATE price_history ph SET symbol = o.symbol
FROM (SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops ORDER BY coin_id, created_at) o
WHERE ph.coin_id = o.coin_id AND ph.symbol IS NULL;
COMMIT;
```

**Rationale**: Per clarification — backfill via a one-time join against `ops`, matching
migration numbering (`006_price_history.sql` was the last one) and the existing
`BEGIN`/`COMMIT` + `IF NOT EXISTS` idempotency convention. This backfill is intentionally
*global* (not `user_id`-scoped) because `price_cache`/`price_history` are themselves global
caches (not per-user data) — there is no cross-user isolation concern in reading `ops` here
for a one-time schema migration, unlike the per-request lookup in §6 which does run inside
a request handler and so is held to that request's own auth scope.

## 10. Test-file impact (SC-002: no regression in existing coverage)

**Decision**: `test_prices.py` and `test_price_history.py` currently patch
`app.routes.prices.httpx.Client` / the equivalent in `price_history.py` directly, because
today's `_fetch_from_coingecko` / `_fetch_market_chart` live in those route modules. Once
that logic moves into `app/providers/coingecko.py`, those tests are updated to patch
`app.providers.coingecko.httpx.Client` instead — same behavior asserted, new patch target.
This is required, not optional, for the move to compile with passing tests.

**Rationale**: SC-002 promises unchanged *behavior*, not unchanged *test file contents* —
the assertions and scenarios carry over unchanged; only the mock's import path moves with
the code.

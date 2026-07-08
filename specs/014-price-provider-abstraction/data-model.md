# Data Model: Price Provider Abstraction

## PricedAsset (new, in-memory only)

Not persisted as its own row — a value object passed into `PriceProvider.get_prices` /
`get_history` so a provider implementation can choose which identifier it looks the asset
up by.

| Field    | Type          | Notes |
|----------|---------------|-------|
| coin_id  | str           | Canonical CoinGecko slug (e.g. `bitcoin`). Authoritative identity. |
| symbol   | str \| None   | Ticker (e.g. `BTC`). Auxiliary only; `None` when no match was found (see research.md §6). Never used to disambiguate identity. |

## price_cache (existing table, additive column)

| Column      | Type            | Change |
|-------------|-----------------|--------|
| coin_id     | text PK         | unchanged |
| price_usd   | numeric(30,10)  | unchanged |
| image_url   | text            | unchanged |
| updated_at  | timestamptz     | unchanged |
| **symbol**  | text, nullable  | **new** — additive column, migration `007_price_symbol.sql`; backfilled from `ops` where a match exists (see research.md §9); upsert uses `COALESCE(EXCLUDED.symbol, price_cache.symbol)` so a later miss never erases a previously-recorded symbol (research.md §7). |

## price_history (existing table, additive column)

| Column      | Type            | Change |
|-------------|-----------------|--------|
| coin_id     | text            | unchanged (part of composite PK) |
| date        | date            | unchanged (part of composite PK) |
| price_usd   | numeric(30,10)  | unchanged |
| **symbol**  | text, nullable  | **new** — same additive/backfill/COALESCE treatment as `price_cache.symbol`. |

## PriceProvider (new abstraction, `backend/app/price_provider.py`)

Abstract base class. No persisted state of its own; a stateless strategy object.

| Method | Signature | Contract |
|--------|-----------|----------|
| `search_coins` | `(query: str) -> list[dict]` | Returns `{id, symbol, name, market_cap_rank}` entries, most relevant first. Raises on unsupported/failure per implementation. |
| `get_prices` | `(assets: list[PricedAsset]) -> list[dict]` | Returns `{id, price, image}` entries for whichever assets the provider could price; omits ones it can't. |
| `get_history` | `(asset: PricedAsset, from_date: date, to_date: date) -> dict[str, float]` | Returns `{ "YYYY-MM-DD": price }` for the inclusive range; may return a partial map. |

Implementations:
- **`CoinGeckoProvider`** (`backend/app/providers/coingecko.py`) — the current, only
  fully-working implementation; extracted unchanged from `prices.py` / `price_history.py`.
  Uses `.coin_id` from `PricedAsset`, ignores `.symbol`.
- **`CryptoCompareProvider`** (`backend/app/providers/cryptocompare.py`) — skeleton; every
  method raises `NotImplementedError`. Exists to prove `get_provider()` can resolve a
  second, config-selected provider (research.md §8).

`get_provider() -> PriceProvider` reads `Settings.price_provider` (`"coingecko"` default,
`"cryptocompare"` the only other recognized value) and returns the matching singleton
instance.

## Settings (`backend/app/config.py`, additive field)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `price_provider` | str | `"coingecko"` | Selects the active `PriceProvider`. New field, additive to existing `Settings`. |

## No changes

- `ops` table — read-only source for the symbol backfill/lookup; no schema change.
- `Op` / `NewOp` Pydantic models — unchanged; `symbol` already exists there.
- `PriceInfo` response model — unchanged; the API response shape for `/api/prices` does
  not expose the new `symbol` column (it's cache/provider-internal plumbing, not
  user-facing data — no requirement calls for surfacing it in the response).

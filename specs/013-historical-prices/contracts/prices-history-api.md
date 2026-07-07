# Contract: `GET /api/prices/history`

Mirrors the existing `GET /api/prices` contract (`backend/app/routes/prices.py`) in auth,
validation style, and error shape.

## Request

```
GET /api/prices/history?ids=bitcoin,ethereum&from=2026-01-01&to=2026-03-01
Authorization: Bearer <cognito access token>
```

| Query param | Required | Format                     | Notes                                   |
|-------------|----------|-----------------------------|-------------------------------------------|
| `ids`       | yes      | comma-separated coin ids    | Each validated against `^[a-z0-9-]{1,120}$` |
| `from`      | yes      | `YYYY-MM-DD`                | Inclusive start of range                  |
| `to`        | yes      | `YYYY-MM-DD`                | Inclusive end of range; must be `>= from` |

## Success response — `200`

```json
{
  "bitcoin": { "2026-01-01": 42000.12, "2026-01-02": 42500.50 },
  "ethereum": { "2026-01-01": 2200.00, "2026-01-02": 2215.75 }
}
```

- A coin present in `ids` MAY be entirely absent from the response body if no price could be
  found or fetched for any date in range (caller applies the zero-fallback rule itself, per
  `data-model.md`).
- Dates with no available price for a given coin are simply absent from that coin's map — the
  endpoint does not backfill zeros; `computeTimeline` owns the fallback-to-zero decision.

## Error responses

| Status | Condition                                              | `detail` example                          |
|--------|---------------------------------------------------------|--------------------------------------------|
| 400    | `ids` missing/empty                                     | `Query param "ids" is required.`            |
| 400    | malformed coin id                                       | `Invalid coin_id(s): ../evil`               |
| 400    | malformed `from`/`to`, or `to < from`                    | `Invalid date range.`                        |
| 401    | missing/invalid auth token                               | (existing `require_auth` behavior)          |
| 502    | CoinGecko unreachable/non-200 and nothing cached to fall back on | `Failed to fetch price history from CoinGecko.` |

On CoinGecko `429` or transport failure, the endpoint falls back to whatever subset is already
cached in `price_history` for the requested range (same pattern as `prices.py`'s stale-cache
fallback) rather than failing the whole request, unless the cache has nothing at all for a coin —
in that case that coin is simply omitted from the response (not a 502), matching the
"omit rather than fail" rule above; a 502 is reserved for total fetch failure with zero usable
data across all requested coins.

## Caching behavior

- Checks `price_history` for existing `(coin_id, date)` rows across the requested range first.
- For any coin with missing dates in range, calls CoinGecko
  `GET /coins/{id}/market_chart?vs_currency=usd&days={N}&interval=daily` once per coin (not once
  per missing date), where `N` covers from the earliest missing date to today.
- Upserts fetched rows into `price_history` (`ON CONFLICT (coin_id, date) DO UPDATE` — needed only
  because "today"'s row may be re-fetched; all other rows are new).
- Returns the merged cached + freshly-fetched set, filtered to `[from, to]`.

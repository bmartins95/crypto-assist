# Contract: GET /api/coins/search

New endpoint. Mounted with `app.include_router(coins.router, prefix="/api/coins/search")`
(a leaf router with a single `@router.get("")`, matching the existing `redirect_slashes`
convention documented in `backend/AGENTS.md`).

## Request

| Part | Field | Type | Required | Notes |
|------|-------|------|----------|-------|
| Header | `Authorization` | `Bearer <token>` | Yes | Same `require_auth` dependency as every other `/api/*` route (per clarification). |
| Query | `q` | string | Yes | Search text. Empty/missing → 400. |
| Query | `limit` | int | No | Default 7 (matches current client-side `.slice(0, 7)` behavior). |

## Response — 200

```json
[
  { "id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1 }
]
```

Same shape the frontend's `CoinSearchResult` already expects (`id`, `symbol`, `name`,
`market_cap_rank?`) — no frontend type change needed beyond the fetch call itself.

## Errors

| Status | Condition | Body |
|--------|-----------|------|
| 400 | `q` empty or missing | `{"detail": "Query param \"q\" is required."}` |
| 401 | Missing/invalid auth token | `{"detail": "Missing authentication token."}` / `{"detail": "Invalid or expired token."}` |
| 429 | Provider rate-limited | `{"detail": "CoinGecko rate limit exceeded."}` |
| 502 | Provider upstream failure / unexpected shape | `{"detail": "Failed to search coins."}` |

## Behavior notes

- No caching layer for search results (unlike `/api/prices`'s 5-minute cache) — out of
  scope for this feature; not required by any FR/SC.
- Delegates entirely to `get_provider().search_coins(q)` (see data-model.md); does not
  itself know which vendor answered the request.

# Contract: GET /api/platforms/exchanges

New endpoint. Mounted with `app.include_router(platforms.router, prefix="/api/platforms/exchanges")`, matching the `redirect_slashes=False` leaf-router convention (`@router.get("")`) documented in `backend/AGENTS.md`.

## Request

| Part | Field | Type | Required | Notes |
|------|-------|------|----------|-------|
| Header | `Authorization` | `Bearer <token>` | Yes | Same `require_auth` dependency as every other `/api/*` route. |

No query parameters — the full (cached, refreshed) exchange list is always returned; filtering/grouping happens client-side in `usePlatformCatalog.ts`, same division of responsibility as the curated seed list.

## Response — 200

```json
{
  "exchanges": [
    { "id": "binance", "name": "Binance", "logoUrl": "/api/platforms/logo/binance" }
  ],
  "updatedAt": "2026-07-11T12:00:00+00:00"
}
```

`logoUrl` is a same-origin path to this feature's own logo proxy (see `contracts/platforms-logo.md`), not CoinGecko's raw image URL — the browser never receives a third-party image URL (spec FR-008).

## Errors

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing/invalid auth token | `{"detail": "Missing authentication token."}` / `{"detail": "Invalid or expired token."}` |
| 429 | CoinGecko rate-limited *and* no cached row exists yet to fall back to | `{"detail": "CoinGecko rate limit exceeded."}` |
| 502 | CoinGecko upstream failure/unexpected shape *and* no cached row exists yet | `{"detail": "Failed to fetch exchanges from CoinGecko."}` |

## Behavior notes

- Cache-first, 24h TTL, stale-on-upstream-failure — identical shape to `GET /api/exchange-rates` (see research.md §2). A 429/502 is only ever surfaced to the client if `platform_cache` is completely empty (first-ever cold call in an environment); any existing cached data is served instead, matching `exchange_rates.py`'s `except HTTPException: if have_all: ...` branch.
- `logoUrl` values are rewritten to same-origin `/api/platforms/logo/{id}` paths before this endpoint responds — see `contracts/platforms-logo.md` for the proxy route itself (research.md §3).
- Curated wallet/DeFi platforms are **not** included in this response — they ship with the web bundle (`shared/src/platforms/seed.json`) and are merged client-side in `usePlatformCatalog.ts`.

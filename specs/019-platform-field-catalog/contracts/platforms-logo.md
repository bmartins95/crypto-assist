# Contract: GET /api/platforms/logo/{id}

New endpoint. Mounted as its own router — `app.include_router(platforms.logo_router, prefix="/api/platforms/logo")` — separate from `platforms.router` because, unlike every other `/api/*` route, it does **not** depend on `require_auth`. See research.md §3 for why: an `<img src>` request cannot carry a Bearer token, and this route serves nothing but a small, non-sensitive brand-mark image.

## Request

| Part | Field | Type | Required | Notes |
|------|-------|------|----------|-------|
| Path | `id` | string | Yes | A `platform_cache.id` value (e.g. `binance`). Not validated against `require_auth` — validated instead against the known `platform_cache` row set (404 if absent), so this cannot be used as an arbitrary open image-fetch proxy. |

## Response — 200

Raw image bytes, `Content-Type` taken from the upstream CoinGecko response (`image/png`, `image/jpeg`, etc.), with a long-lived `Cache-Control: public, max-age=604800` (7 days) so the browser and any CDN in front of the API cache it — the underlying `platform_cache.logo_url` itself only changes on the (already daily) exchange-list refresh, so a week-long client cache is safe and cuts repeat Lambda invocations for the same logo.

## Errors

| Status | Condition | Body |
|--------|-----------|------|
| 404 | `id` not present in `platform_cache` | `{"detail": "Unknown platform id."}` |
| 502 | The stored `logo_url` fetch to CoinGecko fails or returns a non-image response | `{"detail": "Failed to fetch platform logo."}` |

On any error, the frontend's existing `onError` → initials-avatar fallback (FR-007, `PlatformLogo.tsx`) handles it the same way it handles any other broken image — no special-casing needed in the frontend for this route specifically.

## Behavior notes

- No `require_auth` dependency — this is a deliberate, narrow, documented exception (research.md §3, plan.md Constitution Check §II). Every other route in this codebase remains auth-gated.
- Does not re-fetch CoinGecko on every request: reads the already-cached `logo_url` from `platform_cache` (populated/refreshed by `GET /api/platforms/exchanges`'s 24h cache cycle) and proxies that single URL's bytes through. If `platform_cache` has no row for `id`, this is a 404, not a fallback CoinGecko lookup — the exchange must already be known.
- `GET /api/platforms/exchanges`'s `logoUrl` field in its response is this route's own path (`/api/platforms/logo/<id>`), not CoinGecko's raw URL — the rewrite happens server-side in `platforms.py`, so `PlatformLogo.tsx` never needs to know a proxy exists.

# Research: Platform Field Catalog

## 1. Where does the curated wallet/DeFi seed list live?

**Decision**: A single JSON file, `shared/src/platforms/seed.json`, is the source of truth for curated wallet/DeFi platforms. `shared/src/platforms.ts` imports it, types it (`Platform[]`), and re-exports it plus `Platform`/`PlatformKind` through `shared/src/index.ts`. The one-time backend backfill script (`backend/scripts/backfill_platform_fields.py`, run locally by a developer, not deployed) reads the same JSON file directly off disk via a repo-relative path, so wallet/DeFi matching during migration uses the exact same list the UI shows — no duplicated, driftable list in two languages.

**Rationale**: The constitution's Shared-First Architecture principle requires cross-package data to live in `shared/`. A plain JSON file (not a `.ts` module with logic) is trivially readable from both a bundler (`import seed from './seed.json'`, Vite supports this natively) and a plain Python script (`json.load`) without adding a build step or a new dependency in either direction.

**Alternatives considered**:
- Duplicate the list in Python (`backend/app/platform_seed.py`) and TypeScript separately — rejected: guaranteed drift the first time someone adds a wallet without touching both files, and the constitution favors avoiding that class of duplication.
- Have the backend serve the curated list too (`GET /api/platforms/wallets`) — rejected as speculative: nothing about this feature requires the curated list to be fetched over the network (it's small, static, and ships with the web bundle already); a backend round-trip would only add latency and complexity to something that's just data.

## 2. How are exchange platforms fetched, cached, and refreshed?

**Decision**: `GET /api/platforms/exchanges` mirrors `backend/app/routes/exchange_rates.py` exactly: read `platform_cache` first; if every cached row is younger than a TTL, serve it; otherwise call CoinGecko's `GET /api/v3/exchanges?per_page=250` once, upsert the results into `platform_cache` (`id`, `name`, `logo_url`, `updated_at`), and serve the fresh data — falling back to stale cached data (never a hard failure) if the upstream call itself fails, exactly like `exchange_rates.py`'s `except HTTPException` fallback branch.

**TTL**: 24 hours (`_CACHE_TTL_S = 60 * 60 * 24`), longer than `exchange_rates.py`'s 1 hour, because exchange identity/branding (name, logo) changes far less often than a fiat exchange rate — refreshing daily is more than sufficient and keeps CoinGecko call volume low.

**Rationale**: This is the exact caching shape the codebase already has twice (`exchange_rates.py`, `prices.py`), so reusing it needs no new abstraction, dependency, or pattern — directly satisfies the "No Speculative Code" principle (`httpx` is already a dependency; no `PriceProvider`-style abstraction is warranted since CoinGecko is the sole, permanent exchange source per the spec's Assumptions — unlike coin prices, which already had a swappable-provider need established in Item 13).

**Alternatives considered**: Wrapping this behind the existing `PriceProvider` abstraction (Item 13) — rejected: that abstraction exists because coin/price data genuinely has (and uses) a second provider (`CryptoCompareProvider` skeleton). Nothing about platform/exchange data has a second-provider requirement in this spec; adding the abstraction here would be speculative generality with no current caller.

## 3. Are exchange logo images proxied through the backend, or linked directly to CoinGecko?

**Decision**: Linked directly. `platform_cache.logo_url` stores CoinGecko's own image URL; the frontend's `<img>` tag in `PlatformLogo` points straight at it, with `onError` falling back to the initials avatar — this is the exact same pattern already shipped for coin logos (`WalletTab.tsx`'s `CoinBadge`, backed by `price_cache.image_url`, called out as working as-is in Item 7's "Done when": *"Coin images load from CoinGecko ... and fall back to the colored initials badge when absent"*).

**Rationale**: The design reference doc's note ("proxy/cache it, or the list breaks when they rotate URLs") is satisfied by the *metadata* cache-with-refresh already decided in §2 above — a stale/rotated URL self-heals on the next 24h refresh, and any transient failure in between is already covered by the existing, required `onError` → initials-avatar fallback (spec FR-007). Building a second mechanism — a binary image proxy/re-hosting endpoint — would duplicate a problem this codebase has already solved once for coin logos, with no precedent anywhere in the repo and no requirement in the spec beyond "don't show a broken-image icon," which the existing fallback pattern already guarantees. This is the "No Speculative Code" call: build the thing the spec requires, not the more elaborate thing the phrase could theoretically imply.

**Alternatives considered**: A `GET /api/platforms/logo/{id}` streaming proxy (fetch-and-relay image bytes through the Lambda) — rejected as unrequested complexity with no existing precedent; revisit only if broken/CSP-blocked platform logos turn out to be a real, observed problem in practice (same "don't fix it before it's proven broken" judgment call already applied to coin logos).

## 4. How is a "custom" platform's identity computed, and how does per-user privacy hold without new schema?

**Decision**: `platform_id = 'custom:' + slugify(trim(name))` (lowercase, non-alphanumerics replaced with `-`), `platform_name = trim(name)`. No new table and no per-user namespacing in the id itself — privacy comes for free from the fact that every query against `ops` is already scoped by `user_id` (Item 3's cross-user isolation). Two different users typing "Sodex" both get `platform_id = 'custom:sodex'`, but neither can ever see the other's row, so there is no cross-user leak; each user's own custom platforms render consistently (same id → same name/avatar) across their own History and Wallet views, which is all FR-002 requires.

**Rationale**: Satisfies the clarification answer (custom platforms are private per-user) using the isolation mechanism the codebase already enforces everywhere else, instead of introducing a new per-user-scoped identity scheme (e.g. `custom:<user_id>:<slug>`) that no other entity in this codebase uses and that FR-002 doesn't actually require (it requires *invisibility* across users, not *uniqueness* of the identifier string across users).

## 5. How does the legacy free-text `platform` field get resolved to `platform_id`/`platform_name`, and where does that logic live so both the migration and JSON import can share it?

**Decision**: A single function, `backend/app/platform_resolve.py::resolve_platform(raw: str, user_id: str, conn) -> tuple[str | None, str | None]`, implements the "exact/trimmed/case-insensitive match against the catalog, else custom" rule from the Assumptions and FR-010/FR-014. It queries `platform_cache` for an exchange match and the loaded `shared/src/platforms/seed.json` list (loaded once, module-level) for a wallet/DeFi match; if neither matches, it returns the custom id/name pair from §4. Both `backend/scripts/backfill_platform_fields.py` (one-time historical-ops migration) and `backend/app/routes/import_data.py` (whenever an incoming op has a legacy `platform` string but no `platformId`) call this same function.

**Rationale**: Directly implements the clarification answer for FR-014 ("resolve it the same way as the migration") without duplicating the matching rule in two places, which would risk the two paths silently diverging over time.

## 6. Keyboard navigation for the new combobox

**Decision**: `PlatformSelect` implements its own `open`/`highlightedIndex` state and a `keydown` handler (↑/↓/Enter/Esc) rather than extending `OpDrawer.tsx`'s inline `CoinSearch`. `CoinSearch` is left untouched.

**Rationale**: `CoinSearch` (inline in `OpDrawer.tsx`, lines ~50-130) has no keyboard handling today — it's a separate, existing component with its own tests and callers; retrofitting arrow-key navigation onto it is out of scope for this item (the spec only requires it for the *new* platform picker) and would risk regressing a component nothing in this feature needs changed. `PlatformSelect` is a new, purpose-built component per the design doc's own file list (`web/src/components/platform/PlatformSelect.tsx`), so its keyboard handling has no existing behavior to preserve.

# Data Model: Platform Field Catalog

## Platform (new, `shared/src/platforms.ts`)

Client-side / in-memory shape. Not a database table on its own — catalog entries are assembled at read time from `platform_cache` (exchanges) + `seed.json` (wallets/DeFi); custom entries are derived on the fly from an operation's `platformId`/`platformName`.

| Field      | Type            | Notes |
|------------|-----------------|-------|
| id         | string          | Stable identifier. `'binance'` (exchange, from `platform_cache.id`), `'metamask'` (wallet/DeFi, from `seed.json`), or `'custom:<slug>'` (custom, derived from name — see research.md §4). |
| name       | string          | Display name, e.g. `'Binance'`, `'MetaMask'`. |
| kind       | `PlatformKind`  | `'exchange' \| 'wallet' \| 'defi' \| 'custom'`. |
| subtitle   | string \| undefined | e.g. `'Carteira · Solana'`. Present on curated `wallet`/`defi` seed entries only; shown in the dropdown, not persisted on operations. |
| logoUrl    | string \| undefined | Absent for `custom` — UI falls back to a generated initials avatar (research.md §3). |

## seed.json (new, `shared/src/platforms/seed.json`)

Flat JSON array of curated wallet/DeFi entries (`id`, `name`, `kind: 'wallet' | 'defi'`, `subtitle`, `logoUrl`). Single source of truth, read by both `shared/src/platforms.ts` (typed re-export for web/mobile) and `backend/scripts/backfill_platform_fields.py` (research.md §1). Grows by ordinary code changes (PRs), never by end-user input.

## ops (existing table, additive columns)

| Column           | Type              | Change |
|------------------|-------------------|--------|
| ...existing...   |                   | unchanged |
| platform         | text NOT NULL DEFAULT '' | unchanged, deprecated — no longer written by new code once this feature ships; retained for one further deploy cycle, dropped in a future item once stable |
| **platform_id**  | text, nullable    | **new** — additive column, migration `008_platform_fields.sql`. Catalog id (`'binance'`, `'metamask'`) or `'custom:<slug>'`. `NULL` only for operations with no platform selected (existing optional-platform behavior). |
| **platform_name**| text, nullable    | **new** — denormalized display name at time of selection, survives a later catalog change (per the design doc's stated reason for denormalizing). `NULL` iff `platform_id` is `NULL`. |

Backfill (one-time, not part of the auto-applied schema migration — see quickstart.md): for every existing row, `platform_id`/`platform_name` are computed by `resolve_platform()` (research.md §5) from the existing `platform` text; an empty/blank `platform` stays `NULL`/`NULL`.

## platform_cache (new table, mirrors `price_cache`/`exchange_rates` shape)

| Column      | Type            | Notes |
|-------------|-----------------|-------|
| id          | text PRIMARY KEY | CoinGecko exchange id, e.g. `'binance'`. |
| name        | text NOT NULL   | Exchange display name. |
| logo_url    | text            | CoinGecko's own image URL (research.md §3 — linked directly, not proxied). |
| updated_at  | timestamptz NOT NULL DEFAULT now() | Used for the 24h TTL check (research.md §2), same pattern as `exchange_rates.updated_at`. |

## NewOp / Op (`shared/src/types.ts`, modified)

| Field         | Type              | Change |
|---------------|-------------------|--------|
| ...existing... |                  | unchanged |
| platform      | string            | **removed** from new writes — replaced by `platformId`/`platformName` below. `AssetWithPlatform.platform` similarly becomes `platformId`/`platformName`. |
| **platformId**   | `string \| undefined` | **new** — `undefined` when no platform was selected (matches today's "no platform" optional behavior). |
| **platformName** | `string \| undefined` | **new** — denormalized display name; always present together with `platformId`. |

## BackupPayload / ImportPayload (`shared/src/types.ts`, `backend/app/models.py`)

No shape change to the payload envelope itself. Each op entry within it moves from `platform: string` to `platformId?`/`platformName?`, exactly mirroring the `NewOp` change above. `import_data.py` additionally accepts a legacy op shape carrying the old bare `platform: string` (no `platformId`) for backward compatibility (FR-014) — routed through `resolve_platform()` (research.md §5) rather than rejected.

## PlatformCatalog (assembled client-side, not persisted)

The merged result `usePlatformCatalog.ts` exposes: `{ catalog: Platform[], byId: Record<string, Platform>, recent: Platform[] }`. `catalog` = `seed.json` entries + the fetched-and-cached `GET /api/platforms/exchanges` response, deduplicated by `id`. `recent` = the last N platform ids a user selected, read from `localStorage` (client-side preference, no backend involvement — consistent with existing prefs like `theme`, `hide_balances`).

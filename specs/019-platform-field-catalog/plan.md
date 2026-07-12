# Implementation Plan: Platform Field Catalog

**Branch**: `feat/platform-field-catalog` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-platform-field-catalog/spec.md`

## Summary

Replace the free-text `platform` field on operations with a categorized entity (exchange/wallet/defi/custom) carrying a logo and name. A new `PlatformSelect` combobox (mirroring, but not modifying, `OpDrawer.tsx`'s existing inline `CoinSearch`, plus new keyboard navigation `CoinSearch` never had) replaces both plain-text platform inputs in the operation drawer. `PlatformLogo`/`PlatformChip` replace plain text in `HistoryTab.tsx` and both `WalletTab.tsx` grouped views. Exchange platforms come from a new, cached `GET /api/platforms/exchanges` endpoint (mirrors `exchange_rates.py`'s cache-first/stale-fallback shape exactly); wallet/DeFi platforms ship as a curated `shared/src/platforms/seed.json`. `ops` gains additive `platform_id`/`platform_name` columns (old `platform` column deprecated, not dropped); a one-time, approval-gated backfill script resolves every existing row's free-text value against the catalog, reusing the same resolution function `import_data.py` uses for legacy-shaped backup imports (FR-014). Per clarification, custom platforms are private per-user (no new schema needed — existing per-user `ops` isolation already guarantees it) and platform logos are linked directly to CoinGecko's own URLs rather than proxied (matches the existing, already-shipped coin-logo pattern).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Vite 8 (`web/`) — Python 3.12, FastAPI (`backend/`) — no version changes.

**Primary Dependencies**: No new dependencies. `httpx` (already a `backend/` dependency, used identically in `exchange_rates.py`/`providers/coingecko.py`) powers the new `/api/platforms/exchanges` fetch. `psycopg` (existing) for the new `platform_cache` table and the additive `ops` columns. Frontend uses only existing React/TanStack Router/Vitest — no combobox library, matching how `CoinSearch` is hand-rolled today.

**Storage**: Aurora PostgreSQL (existing). Additive migration `008_platform_fields.sql`: `ops.platform_id`, `ops.platform_name` (nullable text), new `platform_cache` table (mirrors `price_cache`/`exchange_rates` shape). See data-model.md.

**Testing**: Vitest + Testing Library (`web/`) for `PlatformLogo`, `PlatformChip`, `PlatformSelect`, `usePlatformCatalog`, and the updated `OpDrawer.test.tsx`/`HistoryTab.test.tsx`/`WalletTab.test.tsx`. pytest (`backend/`) for the new `platforms.py` route (cache hit/miss/stale-fallback, mirroring `test_exchange_rates` if one exists, else `test_prices.py`'s pattern) and `resolve_platform()` / the backfill script's core logic.

**Target Platform**: Browser SPA (`web/`, S3/CloudFront) + AWS Lambda (`backend/`) — both existing deploy targets, no infra change.

**Project Type**: Full-stack change across `shared/` (new `Platform`/`PlatformKind` types + curated seed JSON), `backend/` (new route, new table, migration, one-time backfill script, `import_data.py` change), and `web/` (new `platform/` component directory + three existing-view modifications). No `mobile/` UI changes — verified for build/type-contract impact only (spec Assumptions).

**Performance Goals**: N/A explicit beyond SC-001 (≤3 keystrokes to surface a common platform, a client-side filter concern, not a backend latency target). The 24h exchange-cache TTL keeps `/api/platforms/exchanges` fast (DB read, no CoinGecko round-trip) on all but one request per day per environment.

**Constraints**: Must not introduce a new external host the browser talks to directly — platform logos are linked to CoinGecko's existing asset CDN the same way coin logos already are (research.md §3), so no CloudFront CSP change is required (verify per `web/AGENTS.md`'s CSP-check guidance during implementation, don't assume). Migration must be additive-only (constitution/Technology Standards); the historical-row backfill is a separate, explicitly approval-gated step, not part of the auto-applied schema migration.

**Scale/Scope**: New `web/src/components/platform/` directory (`PlatformLogo.tsx`, `PlatformChip.tsx`, `PlatformSelect.tsx`, `platformAvatar.ts`, `usePlatformCatalog.ts`). New `shared/src/platforms.ts` + `shared/src/platforms/seed.json`. New `backend/app/routes/platforms.py`, `backend/app/platform_resolve.py`, `backend/scripts/backfill_platform_fields.py`, `backend/db/migrations/008_platform_fields.sql`. Modified: `OpDrawer.tsx`, `HistoryTab.tsx`, `WalletTab.tsx`, `shared/src/types.ts`, `shared/src/i18n/types.ts` + all 10 locale files, `backend/app/models.py`, `backend/app/routes/ops.py`, `backend/app/routes/import_data.py`, `web/src/app/globals.css`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — PASS. `Platform`/`PlatformKind` types and the curated seed data live in `shared/src/`, exported via `shared/src/index.ts`; `web/` consumes them, `mobile/` is unaffected in UI but its type contract (`NewOp`/`Op`) changes — verified to still build per quickstart.md §7, per spec Assumptions this feature is web-only otherwise.
- **II. Security at the Boundary** — PASS. `GET /api/platforms/exchanges` is `require_auth`-gated like every other route. Legacy-shaped import payloads (bare `platform` string) are validated/resolved server-side in `import_data.py`, not trusted as-is. No new secrets. No `eval`/`dangerouslySetInnerHTML`/`innerHTML`. Every new `catch` (frontend fetch, backend upstream call) either surfaces a visible error or falls back to cached data with a clear code path, matching `exchange_rates.py`'s existing precedent.
- **III. Behavior Coverage Over Line Coverage** — PASS (enforced in tasks.md). New/changed modules (`platforms.py`, `platform_resolve.py`, `PlatformSelect.tsx`, `PlatformLogo.tsx`, `PlatformChip.tsx`, `usePlatformCatalog.ts`, updated `OpDrawer`/`HistoryTab`/`WalletTab`) each get happy-path, error-path (upstream failure, malformed import, broken logo URL), and edge-case tests (custom fallback, empty catalog, keyboard nav) per spec.md's Edge Cases section.
- **IV. No Speculative Code** — PASS. No `PriceProvider`-style abstraction for platforms (research.md §2 — CoinGecko is the sole, permanent exchange source; nothing today needs a second provider). No binary logo proxy (research.md §3 — matches existing coin-logo precedent, not a hypothetical future need). No per-user namespacing scheme beyond what existing `ops` isolation already provides (research.md §4).
- **V. Accessibility and Internationalisation** — PASS, enforced by FR-013 and the new i18n keys (`platform_kind_*`, `platform_search_placeholder`, `platform_use_custom`, `platform_group_*`) added across all 10 locale files; `PlatformSelect` implements `combobox`/`listbox`/`option` ARIA roles per spec FR-003/FR-013.

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/019-platform-field-catalog/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── platforms-exchanges.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
shared/src/
├── platforms.ts                    # NEW — Platform, PlatformKind types; loads + re-exports seed.json
├── platforms/
│   └── seed.json                   # NEW — curated wallet/DeFi catalog (single source of truth, research.md §1)
├── types.ts                        # MODIFY — NewOp/Op/AssetWithPlatform: platform → platformId/platformName
├── i18n/types.ts                   # MODIFY — platform_kind_*, platform_search_placeholder, platform_use_custom, platform_group_*
├── i18n/locales/*.ts               # MODIFY — all 10 locales gain the new keys
└── index.ts                        # MODIFY — export Platform, PlatformKind, PLATFORM_SEED

backend/
├── app/
│   ├── routes/
│   │   └── platforms.py            # NEW — GET /api/platforms/exchanges (mirrors exchange_rates.py)
│   ├── platform_resolve.py         # NEW — resolve_platform(raw, user_id, conn) shared by backfill + import
│   ├── models.py                   # MODIFY — NewOp/Op gain platform_id/platform_name
│   ├── routes/ops.py               # MODIFY — read/write platform_id/platform_name instead of platform
│   ├── routes/import_data.py       # MODIFY — legacy `platform` string on an imported op → resolve_platform()
│   └── main.py                     # MODIFY — app.include_router(platforms.router, prefix="/api/platforms/exchanges")
├── db/
│   └── migrations/
│       └── 008_platform_fields.sql  # NEW — additive ops columns + platform_cache table (auto-applied)
├── scripts/
│   └── backfill_platform_fields.py  # NEW — one-time historical-ops backfill (manual, approval-gated, --dry-run support)
└── tests/
    ├── test_platforms.py            # NEW
    └── test_import.py               # MODIFY — legacy-shaped op with bare `platform` still imports

web/src/
├── components/
│   ├── platform/
│   │   ├── PlatformLogo.tsx         # NEW
│   │   ├── PlatformChip.tsx         # NEW
│   │   ├── PlatformSelect.tsx       # NEW
│   │   ├── platformAvatar.ts        # NEW — hashColor/initials
│   │   ├── usePlatformCatalog.ts    # NEW — merges exchanges (fetched) + seed (bundled) + recent (localStorage)
│   │   └── *.test.tsx               # NEW
│   ├── OpDrawer.tsx                 # MODIFY — both platform text inputs → <PlatformSelect>
│   ├── HistoryTab.tsx               # MODIFY — platform cell → <PlatformChip showCustomTag>
│   └── WalletTab.tsx                # MODIFY — "Por plataforma" column + "Ativo + plataforma" group headers
├── lib/api/client.ts                # MODIFY — getPlatformExchanges()
└── app/globals.css                  # MODIFY — .plat, .plogo, .cat.*, .dd*, .grp-hd per design reference
```

**Structure Decision**: Mirrors the codebase's existing division of labor exactly — cross-package data/types in `shared/`, a single new backend route file following the `exchange_rates.py` template rather than the heavier `PriceProvider` abstraction (research.md §2), and a self-contained `web/src/components/platform/` directory (matching the design reference's own file list) rather than scattering the three new primitives across existing files. The one-time backfill lives in `backend/scripts/` (a new directory) rather than as a fourth `db/migrations/*.sql` file, because its matching logic needs `platform_cache` reads and `seed.json` parsing that plain SQL can't express — consistent with Item 16's precedent of a dedicated script for a non-trivial one-time data migration, kept separate from the auto-applied, schema-only `.sql` migrations.

## Complexity Tracking

*No violations — this section is not applicable.*

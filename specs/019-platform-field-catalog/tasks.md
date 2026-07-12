---

description: "Task list for Platform Field Catalog (specs/019-platform-field-catalog)"
---

# Tasks: Platform Field Catalog

**Input**: Design documents from `/specs/019-platform-field-catalog/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required — this repo's constitution (Principle III) mandates ≥90% coverage per changed module with happy-path + primary error-path + edge-case tests, not optional here.

**Organization**: Tasks are grouped by user story (US1-US3 from spec.md) plus a cross-cutting migration/import-compatibility phase (FR-010/FR-014, not tied to a single priority story) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US3)
- File paths are exact and relative to the repository root.

**Note**: `/speckit-analyze` flagged a spec/plan contradiction on how platform logo images are delivered (spec.md FR-008 requires no raw third-party image URL ever reach the browser). The user chose to keep FR-008 as written, so tasks below build a same-origin logo proxy (`GET /api/platforms/logo/{id}`) rather than linking directly to CoinGecko — see research.md §3.

---

## Phase 1: Setup

**Purpose**: Lay down the two pure-data files nothing else depends on writing code against yet — the DB migration and the curated seed catalog.

- [X] T001 [P] Create `backend/db/migrations/008_platform_fields.sql` — additive `ALTER TABLE ops ADD COLUMN platform_id text`, `ADD COLUMN platform_name text`; `CREATE TABLE IF NOT EXISTS platform_cache (id text PRIMARY KEY, name text NOT NULL, logo_url text, updated_at timestamptz NOT NULL DEFAULT now())` per data-model.md
- [X] T002 [P] Create `shared/src/platforms/seed.json` — curated wallet/DeFi catalog (id/name/kind/subtitle/logoUrl), seeded from the design reference's sample list (MetaMask, Phantom, Rabby, Ledger, Trezor, Trust Wallet, Kamino, Aave, Aerodrome, Lido)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, i18n keys, the backend exchange-catalog + logo-proxy endpoints, the `ops` read/write path, and the base `PlatformLogo`/`PlatformChip`/`usePlatformCatalog` primitives every user story renders through.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `shared/src/platforms.ts` — `Platform`, `PlatformKind` types; imports and re-types `./platforms/seed.json` as `PLATFORM_SEED: Platform[]` (depends on T002)
- [X] T004 `shared/src/types.ts` — `NewOp`/`Op`/`AssetWithPlatform`: remove `platform: string`, add `platformId?: string`, `platformName?: string` (data-model.md)
- [X] T005 `shared/src/index.ts` — export `Platform`, `PlatformKind`, `PLATFORM_SEED` (depends on T003)
- [X] T006 `shared/src/i18n/types.ts` — add `platform_kind_exchange`, `platform_kind_wallet`, `platform_kind_defi`, `platform_kind_custom`, `platform_search_placeholder`, `platform_use_custom`, `platform_group_recent`, `platform_group_exchanges`, `platform_group_wallets`, `platform_group_defi`
- [X] T007 [P] Add the new key translations to `shared/src/i18n/locales/pt-BR.ts` (depends on T006)
- [X] T008 [P] Add the new key translations to `shared/src/i18n/locales/en-US.ts` (depends on T006)
- [X] T009 [P] Add the new key translations to `shared/src/i18n/locales/es-ES.ts` (depends on T006)
- [X] T010 [P] Add the new key translations to `shared/src/i18n/locales/fr-FR.ts` (depends on T006)
- [X] T011 [P] Add the new key translations to `shared/src/i18n/locales/de-DE.ts` (depends on T006)
- [X] T012 [P] Add the new key translations to `shared/src/i18n/locales/zh-CN.ts` (depends on T006)
- [X] T013 [P] Add the new key translations to `shared/src/i18n/locales/ja-JP.ts` (depends on T006)
- [X] T014 [P] Add the new key translations to `shared/src/i18n/locales/ar-SA.ts` (depends on T006)
- [X] T015 [P] Add the new key translations to `shared/src/i18n/locales/hi-IN.ts` (depends on T006)
- [X] T016 [P] Add the new key translations to `shared/src/i18n/locales/ru-RU.ts` (depends on T006)
- [X] T017 `backend/app/models.py` — `NewOp`/`Op`: remove `platform: str = ""`, add `platform_id: str | None = None`, `platform_name: str | None = None`
- [X] T018 Create `backend/app/platform_resolve.py` — `resolve_platform(raw: str, user_id: str, conn) -> tuple[str | None, str | None]`: blank input → `(None, None)`; else match trimmed/lowercased value against `platform_cache` (exchange) then `shared/src/platforms/seed.json` (wallet/defi, loaded once at module level via a repo-relative path); else `('custom:' + slugify(trimmed), trimmed)` (research.md §4-§5)
- [X] T019 Create `backend/app/routes/platforms.py` (part 1/2) — `router` with `GET ""` (mounted at `/api/platforms/exchanges`, `require_auth`-gated): cache-first read of `platform_cache`, 24h TTL, refetch CoinGecko `GET /exchanges?per_page=250` on stale/missing, upsert, stale-on-upstream-failure fallback — mirrors `backend/app/routes/exchange_rates.py` exactly; rewrites each `logoUrl` to `/api/platforms/logo/{id}` before responding (contracts/platforms-exchanges.md)
- [X] T020 `backend/app/routes/platforms.py` (part 2/2) — add a **separate** `logo_router` with `GET "/{id}"` (mounted at `/api/platforms/logo`, **no `require_auth`** — an `<img src>` request can't carry a Bearer token): 404 if `id` isn't a known `platform_cache` row, else `httpx`-fetch that row's stored `logo_url` and return the bytes with the upstream `Content-Type` and `Cache-Control: public, max-age=604800`; 502 on upstream fetch failure (contracts/platforms-logo.md, research.md §3)
- [X] T021 `backend/app/main.py` — `app.include_router(platforms.router, prefix="/api/platforms/exchanges")` and `app.include_router(platforms.logo_router, prefix="/api/platforms/logo")`
- [X] T022 `backend/app/routes/ops.py` — read/write `platform_id`/`platform_name` on create, update, and list/get responses instead of `platform` (depends on T017)
- [X] T023 [P] `web/src/lib/api/client.ts` — add `getPlatformExchanges(): Promise<{ exchanges: Platform[]; updatedAt: string }>` (no client-side URL handling needed — `logoUrl` values are already same-origin proxy paths per T019)
- [X] T024 [P] Create `web/src/components/platform/platformAvatar.ts` — `hashColor(name)`/`initials(name)` helpers per the design reference's algorithm
- [X] T025 Create `web/src/components/platform/PlatformLogo.tsx` — renders `platform.logoUrl` in an `<img>` with `onError` → initials-avatar fallback (`size: 'sm' | 'md'`) (depends on T024)
- [X] T026 Create `web/src/components/platform/PlatformChip.tsx` — `PlatformLogo` + name + optional `personalizada` tag for `kind === 'custom'` (depends on T025)
- [X] T027 Create `web/src/components/platform/usePlatformCatalog.ts` — merges `PLATFORM_SEED` (T003) with `getPlatformExchanges()` (T023) by `id`, tracks `recent` platform ids in `localStorage`, exposes `{ catalog, byId, recent }`
- [X] T028 `web/src/app/globals.css` — add `.plat`, `.plogo`, `.plogo-sm`, `.plogo-md`, `.cat`, `.cat.exchange`, `.cat.wallet`, `.cat.defi`, `.cat.custom` per the design reference tokens
- [X] T029 [P] Create `backend/tests/test_platforms.py` — exchanges: cache hit (no CoinGecko call), cache miss (CoinGecko called, cached, `logoUrl` rewritten to a `/api/platforms/logo/...` path), stale cache refetches, upstream failure falls back to stale cache, 401 without auth; logo proxy: 200 with correct `Content-Type`/`Cache-Control` for a known id, 404 for an unknown id, 502 on upstream fetch failure, and explicitly confirms it responds **without** an `Authorization` header (the auth exception itself needs a positive test, not just an absence of one)
- [ ] T030 [P] Create `web/src/components/platform/PlatformLogo.test.tsx` — renders image when `logoUrl` present, falls back to initials on missing `logoUrl` and on image `onError`, same name always produces the same fallback color
- [ ] T031 [P] Create `web/src/components/platform/PlatformChip.test.tsx` — renders name + logo, shows `personalizada` tag only for `kind === 'custom'`, respects `size`/`bold` props
- [ ] T032 [P] Create `web/src/components/platform/usePlatformCatalog.test.ts` — merges seed + fetched exchanges without duplicates, `recent` persists to and reads from `localStorage`, tolerates a failed exchange fetch (seed-only catalog, no throw)

**Checkpoint**: Shared types compile, the backend exposes a working, tested `/api/platforms/exchanges` and logo proxy, `ops` reads/writes the new columns, and the base logo/chip/catalog primitives exist and are tested. No picker or view is wired yet.

---

## Phase 3: User Story 1 - Pick a platform from a searchable catalog when registering an operation (Priority: P1) 🎯 MVP

**Goal**: The operation drawer's Platform field is a grouped, keyboard-navigable combobox with logos, a custom-platform fallback, and the ability to clear back to no-platform — and the selected platform's identity is persisted on the operation.

**Independent Test**: Open the operation drawer, search/select a platform (or create a custom one), submit, and confirm the operation persists and re-opens with that same platform pre-selected.

### Tests for User Story 1

- [ ] T033 [P] [US1] Create `web/src/components/platform/PlatformSelect.test.tsx` — focus opens a grouped (Exchanges/Wallets/DeFi) dropdown, typing filters case-insensitively, a no-match query shows the custom-fallback row as part of the keyboard cycle, ↓/↑/Enter/Esc behavior, selecting shows the logo inline in the input, clearing an already-selected value returns the field to empty (spec.md Edge Case — no platform on submit), `combobox`/`listbox`/`option` ARIA roles present
- [ ] T034 [P] [US1] Update `web/src/components/OpDrawer.test.tsx` — both the single-op and trade-form Platform fields render `PlatformSelect`; submitting a Buy/Sell/Trade with a selected platform submits `platformId`/`platformName`; submitting with the field cleared submits neither (no-platform case); editing an op pre-fills the same platform with its logo
- [ ] T035 [P] [US1] Update `backend/tests/test_ops.py` — creating/updating an op with `platform_id`/`platform_name` round-trips correctly on `GET`; omitting both leaves them `null` (no-platform case preserved)

### Implementation for User Story 1

- [ ] T036 [US1] Create `web/src/components/platform/PlatformSelect.tsx` — controlled combobox: `open`/`highlightedIndex` state, grouped+filtered results from `usePlatformCatalog`, `Recentes` group when applicable, custom-fallback row (`Usar "<texto>" como personalizada`), a clear affordance that resets the field to no-platform (mirroring `CoinSearch`'s existing `onClear` prop shape), ↑/↓/Enter/Esc keyboard handling, `role="combobox"`/`aria-expanded` on the input, `role="listbox"`/`role="option"`/`aria-selected` on the dropdown (depends on T025, T027)
- [ ] T037 [US1] `web/src/app/globals.css` — add `.dd`, `.dd-grp`, `.dd-item`, `.dd-custom`, `.plus`, `.sel-logo`, `.inp.withlogo` (PlatformSelect-only tokens, design reference)
- [ ] T038 [US1] `web/src/components/OpDrawer.tsx` — replace the single-op `<input id="drawer-platform">` with `<PlatformSelect>`; state becomes `platformId`/`platformName` instead of the `platform` string (reset/prefill/submit call sites)
- [ ] T039 [US1] `web/src/components/OpDrawer.tsx` — replace the trade-form `<input id="drawer-tr-platform">` with `<PlatformSelect>` the same way
- [ ] T040 [US1] `backend/app/routes/ops.py` — validate `platform_id`/`platform_name` are both present or both absent on create/update (mirrors the existing pairing invariant from data-model.md)

**Checkpoint**: Registering or editing any operation type lets a user pick a catalog platform, create a custom one, or leave it empty, fully keyboard-operable, and the choice persists and reloads correctly.

---

## Phase 4: User Story 2 - Recognize where each operation happened at a glance in History (Priority: P1)

**Goal**: The History table's Platform column shows each operation's real logo (or initials avatar), with custom platforms visually tagged.

**Independent Test**: Open History with a mix of catalog and custom platforms among existing operations and confirm every row shows a logo/avatar, never plain text or a broken image.

### Tests for User Story 2

- [ ] T041 [P] [US2] Update `web/src/components/HistoryTab.test.tsx` — a row with a catalog platform shows its logo; a row with a custom platform shows an initials avatar and the `personalizada` tag; a row with no platform shows the existing empty-state text

### Implementation for User Story 2

- [ ] T042 [US2] `web/src/components/HistoryTab.tsx` — replace the plain-text Platform cell (`{o.platform || '—'}`) with `<PlatformChip platform={...} showCustomTag />`, resolved via `usePlatformCatalog`'s `byId` map plus the op's own `platformId`/`platformName` for custom entries (depends on T026, T027)

**Checkpoint**: History shows a recognizable logo/avatar for every operation's platform, custom platforms visibly tagged.

---

## Phase 5: User Story 3 - Understand portfolio composition by platform in the Wallet view (Priority: P2)

**Goal**: The Wallet view's "By platform" rows and "Asset + platform" group headers show real logos, category badges, and (for group headers) the group's total value + return right-aligned.

**Independent Test**: Switch the Wallet view to each grouping mode and confirm logos, category badges, and group totals render.

### Tests for User Story 3

- [ ] T043 [P] [US3] Update `web/src/components/WalletTab.test.tsx` — "By platform" row renders a `PlatformChip` (size `md`, bold) instead of plain text; "Asset + platform" group header renders `PlatformLogo` + category badge + right-aligned total/return instead of the `ti-building-bank` icon; an empty platform group is still omitted (existing behavior preserved)

### Implementation for User Story 3

- [ ] T044 [US3] `web/src/components/WalletTab.tsx` — "Por plataforma" first column → `<PlatformChip size="md" bold />` (depends on T026, T027)
- [ ] T045 [US3] `web/src/components/WalletTab.tsx` — "Ativo + plataforma" group header → replace the fixed `ti-building-bank` icon with `<PlatformLogo size="md" />`, add the category badge, move the group total + return to the right of the header
- [ ] T046 [US3] `web/src/app/globals.css` — add/update `.grp-hd`, `.grp-hd .gname`, `.grp-hd .gsum` per the design reference

**Checkpoint**: Both Wallet grouped views show real platform identity and, for grouped headers, an at-a-glance total.

---

## Phase 6: Historical Data Migration & Import Compatibility (FR-010, FR-014)

**Purpose**: Pre-existing operations and pre-existing JSON backups both resolve to a real platform identity through the same matching logic, instead of losing their platform or breaking on import.

- [ ] T047 [P] Create `backend/tests/test_platform_resolve.py` — exact/case-insensitive/trimmed match resolves to the existing `platform_cache` exchange or `seed.json` wallet/defi entry; no match resolves to a `custom:<slug>` id; blank input resolves to `(None, None)`; two different `user_id`s typing the same custom name each get an isolated, correctly-scoped result per `ops`'s existing per-user query filtering (research.md §4)
- [ ] T048 Create `backend/scripts/backfill_platform_fields.py` — for every `ops` row with `platform_id IS NULL`, compute `resolve_platform(platform, user_id, conn)` and `UPDATE`; `--dry-run` flag prints a per-category count without writing; safe to re-run (already-backfilled rows are skipped)
- [ ] T049 [P] Create `backend/tests/test_backfill_platform_fields.py` — dry-run reports correct match/custom counts without mutating rows; a real run backfills every row; re-running is a no-op; a blank `platform` value stays `NULL`/`NULL`
- [ ] T050 `backend/app/routes/import_data.py` — an imported op entry with a legacy `platform` string and no `platformId` is resolved via `resolve_platform()` instead of rejected (FR-014); an entry with `platformId` already present passes through unchanged
- [ ] T051 [P] Update `backend/tests/test_import.py` — a legacy-shaped backup (bare `platform` string) imports successfully and resolves against the catalog/custom, matching the migration's resolution rule; malformed payloads still return 400 as before

**Checkpoint**: Every historical operation (via the backfill) and every legacy backup (via import) renders a real platform identity, matching the clarification's resolution rule.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Verify `mobile/` still builds and any screen reading `Op`/`NewOp` still renders after the `platform` → `platformId`/`platformName` type change (constitution Principle I; spec Assumptions)
- [ ] T053 [P] `cd backend && pytest --cov=app --cov-report=term-missing` — confirm ≥90% coverage on `platforms.py` (both routers), `platform_resolve.py`, and the changed lines of `ops.py`/`import_data.py`
- [ ] T054 [P] `cd web && npm run coverage` — confirm ≥90% coverage on the new `platform/` components and the changed lines of `OpDrawer.tsx`/`HistoryTab.tsx`/`WalletTab.tsx`
- [ ] T055 Run `quickstart.md` end-to-end manually against local dev (all 8 sections)
- [ ] T056 Sanity-check `GET /api/platforms/logo/{id}` is reachable at the same origin as the rest of the deployed API once available (no CSP change expected, since it's same-origin by construction — confirms research.md §3's proxy approach actually avoided the CSP concern it was built to avoid)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, T002) — BLOCKS all user stories.
- **User Stories (Phase 3-5)**: All depend on Foundational completion. US1, US2, US3 touch different files (`OpDrawer.tsx` vs `HistoryTab.tsx` vs `WalletTab.tsx`) and are independently testable once Foundational is done, though US2/US3 have nothing meaningful to render until US1 starts writing `platformId`/`platformName` on new operations (or Phase 6's backfill runs against existing ones).
- **Phase 6 (Migration & Import Compatibility)**: Depends on Foundational (needs `platform_resolve.py`'s prerequisites) and is independent of US1-3's UI work, but is most meaningfully verified after US2/US3 exist (so a backfilled row's chip/logo can actually be observed).
- **Polish (Phase 7)**: Depends on all prior phases.

### Within Each Phase

- Tests are written before the implementation they cover and should fail first.
- `[P]` tasks touch different files and have no ordering dependency on each other within their phase.

### Parallel Opportunities

- T001, T002 (Setup) in parallel.
- T007-T016 (10 locale files) in parallel once T006 lands.
- T029-T032 (Foundational tests) in parallel once their respective implementation tasks land.
- T033-T035 (US1 tests) in parallel; T041 (US2 test) and T043 (US3 test) are each independent of the other story's work once Foundational is done.
- T047, T049, T051 (Phase 6 tests) in parallel.
- T052-T054 (Polish checks) in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Once T006 lands, launch all locale translations together:
Task: "Add new key translations to shared/src/i18n/locales/pt-BR.ts"
Task: "Add new key translations to shared/src/i18n/locales/en-US.ts"
Task: "Add new key translations to shared/src/i18n/locales/es-ES.ts"
# ...through ru-RU.ts

# Once their implementations land, launch Foundational tests together:
Task: "Create backend/tests/test_platforms.py"
Task: "Create web/src/components/platform/PlatformLogo.test.tsx"
Task: "Create web/src/components/platform/PlatformChip.test.tsx"
Task: "Create web/src/components/platform/usePlatformCatalog.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: register an operation end-to-end with the new picker, confirm persistence and edit pre-fill.

### Incremental Delivery

1. Setup + Foundational → catalog endpoint, logo proxy, and base primitives ready.
2. US1 → the picker works everywhere an operation is registered (MVP).
3. US2 → History becomes readable at a glance.
4. US3 → Wallet grouped views become readable at a glance.
5. Phase 6 → pre-existing data (migration) and pre-existing backups (import) catch up to the new model.
6. Phase 7 → coverage, mobile parity, and the logo-proxy same-origin check verified before opening the PR.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- `[Story]` label maps a task to its user story for traceability; Setup, Foundational, Phase 6, and Polish tasks carry no story label since they are cross-cutting.
- Commit after each task or logical group, per this repo's one-thing-per-commit convention.
- Avoid: vague tasks, same-file conflicts marked `[P]`, cross-story dependencies that break independent testability.

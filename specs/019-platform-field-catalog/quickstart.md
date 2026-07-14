# Quickstart: Platform Field Catalog

Manual verification steps once the implementation is in place. Backend: `cd backend && uvicorn app.main:app --reload --port 3001` (Docker Postgres running per `backend/AGENTS.md`). Frontend: `cd web && npm run dev`.

## 1. Schema migration (auto-applied)

1. Start the backend fresh against an empty local DB — confirm `ops.platform_id`, `ops.platform_name`, and the new `platform_cache` table exist afterward (`\d ops`, `\d platform_cache` in `psql`). This part of `008_platform_fields.sql` is additive/idempotent and runs automatically like every other migration — no approval gate.

## 2. Historical-data backfill (auto-applied)

**Correction, found via dev QA:** this was originally a manual, approval-gated script — but since the new UI reads only `platform_id`/`platform_name` and never falls back to the legacy `platform` column, every pre-catalog op would silently show no platform until someone remembered to run the script by hand. The backfill now runs automatically, once, as `db/migrations/011_backfill_platform_fields.py` (idempotent, tracked in `schema_migrations` like any other migration — see PLAN.md Item 22's "Corrections learned during implementation").

1. Start the backend fresh against a DB with pre-existing `ops` rows that have a legacy `platform` value and `platform_id IS NULL` — confirm they resolve automatically on first request (check `schema_migrations` for `011_backfill_platform_fields.py`, or query `ops` directly).
2. `backend/scripts/backfill_platform_fields.py` still exists, but only as a manual dry-run/diagnostic tool (`--dry-run` reports counts without writing) — it is not required to make the backfill happen.
3. Confirm re-running the migration (or the script without `--dry-run`) is a no-op once every row is backfilled (idempotent — only rows with `platform_id IS NULL` are touched).

## 3. Register an operation with the new platform picker

1. Open the operation drawer (any of Buy/Sell/Trade). Focus the Platform field — confirm a grouped dropdown opens (Exchanges/Wallets/DeFi) with logos, no typing required.
2. Type `bin` — confirm it filters to Binance-like results within a few keystrokes.
3. Use ↓ to highlight a result, Enter to select — confirm the input shows the name with an inline logo, and Esc (before selecting) closes the dropdown without changing the field.
4. Type a name with no catalog match (e.g. `Sodex`) — confirm a "use as custom" row appears at the bottom of the keyboard-navigable list, and selecting it fills the field with an initials avatar.
5. Submit the operation. Re-open it for editing — confirm the same platform (catalog or custom) is pre-selected with its logo/avatar.

## 4. History view

**Correction, per user feedback during implementation:** History deliberately shows the resolved platform name as plain text — no logo, no "personalizada" tag. That richer treatment (logo/avatar + tag) is exclusive to the Wallet grouped views below.

1. Open `/history` with a mix of catalog and custom platforms among past operations — confirm every row shows the resolved platform name as plain text (an em-dash for ops with no platform), with no logo and no tag.

## 5. Wallet grouped views

1. Switch `/wallet` to "By platform" — confirm each row's first column shows the platform's logo (larger size), not plain text.
2. Switch to "Asset + platform" — confirm each group header shows the real logo, a category badge, and the group's total value + return right-aligned (no more generic bank icon).

## 6. Legacy backup import (FR-014)

1. Locate or construct a JSON export from before this feature (an op entry with `"platform": "Binance"` and no `platformId`).
2. Import it via the Settings "Dados" card. Confirm the import succeeds and the resulting operation shows the Binance logo (catalog match) — not an error, not a blank platform.
3. Repeat with a legacy `"platform"` value not in the catalog — confirm it imports as a custom platform with an initials avatar.

## 7. Mobile parity check

1. `cd mobile && npx expo start` (or the project's existing build check) — confirm the app still builds and any screen reading `Op`/`NewOp` still renders, given `platform: string` was replaced by `platformId?`/`platformName?` in `shared/src/types.ts`.

## 8. Automated checks

```bash
cd web && npm test
cd web && npm run coverage
cd backend && pytest
cd backend && pytest --cov=app --cov-report=term-missing
```

# Quickstart: Platform Field Catalog

Manual verification steps once the implementation is in place. Backend: `cd backend && uvicorn app.main:app --reload --port 3001` (Docker Postgres running per `backend/AGENTS.md`). Frontend: `cd web && npm run dev`.

## 1. Schema migration (auto-applied)

1. Start the backend fresh against an empty local DB — confirm `ops.platform_id`, `ops.platform_name`, and the new `platform_cache` table exist afterward (`\d ops`, `\d platform_cache` in `psql`). This part of `008_platform_fields.sql` is additive/idempotent and runs automatically like every other migration — no approval gate.

## 2. Historical-data backfill (manual, requires approval before running for real)

1. Warm the exchange cache first: sign in and load any screen that hits `GET /api/platforms/exchanges` at least once (or curl it directly with a valid bearer token), so `platform_cache` has data for the backfill to match against.
2. **Do not run this against dev/prod without explicit sign-off** — it rewrites `platform_id`/`platform_name` on every existing row. Dry-run locally first:
   ```bash
   cd backend && python scripts/backfill_platform_fields.py --dry-run
   ```
   Confirm it prints how many rows would resolve to a catalog match vs. a custom platform, with zero rows left `NULL` unless their original `platform` was already blank.
3. Run for real locally (`--dry-run` omitted) and confirm re-running it is a no-op (idempotent — already-backfilled rows are skipped or produce the same result).

## 3. Register an operation with the new platform picker

1. Open the operation drawer (any of Buy/Sell/Trade). Focus the Platform field — confirm a grouped dropdown opens (Exchanges/Wallets/DeFi) with logos, no typing required.
2. Type `bin` — confirm it filters to Binance-like results within a few keystrokes.
3. Use ↓ to highlight a result, Enter to select — confirm the input shows the name with an inline logo, and Esc (before selecting) closes the dropdown without changing the field.
4. Type a name with no catalog match (e.g. `Sodex`) — confirm a "use as custom" row appears at the bottom of the keyboard-navigable list, and selecting it fills the field with an initials avatar.
5. Submit the operation. Re-open it for editing — confirm the same platform (catalog or custom) is pre-selected with its logo/avatar.

## 4. History view

1. Open `/history` with a mix of catalog and custom platforms among past operations — confirm every row shows a logo or initials avatar next to the platform name, and custom ones carry a visible "personalizada" tag.
2. Temporarily break a cached `logo_url` (e.g. edit it to a 404 URL in the DB) — confirm the row falls back to the initials avatar with no broken-image icon.

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

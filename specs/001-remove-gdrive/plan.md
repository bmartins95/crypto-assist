# Implementation Plan: Remove Google Drive Integration

**Branch**: `001-remove-gdrive` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-remove-gdrive/spec.md`

## Summary

Remove the Google Drive sync feature from the web app. All Drive-related files,
state, handlers, and UI controls are deleted. The JSON file export (downloads a
`.json` to the user's computer) and JSON file import (reads a file from the user's
computer) are preserved intact. CoinGecko coin search continues working without a
user-supplied API key. No backend changes required.

## Technical Context

**Language/Version**: TypeScript (React 19, Vite)

**Primary Dependencies**: React, TanStack Router, Vitest + Testing Library (all
existing — no new packages)

**Storage**: Browser localStorage — Drive keys (`cp_gdrive_client_id`,
`cp_gdrive_used`) stop being written; pre-existing values are left in place
(passive removal per spec clarification Q1).

**Testing**: Vitest + Testing Library (`web/src/components/*.test.tsx`)

**Target Platform**: Web browser (single-page application, desktop + mobile)

**Project Type**: Web application (frontend only; no backend changes)

**Performance Goals**: Export delivers a file in under 5 seconds; import processes
a file in under 5 seconds (spec SC-002, SC-003).

**Constraints**: No new dependencies. No changes to `shared/` or `backend/`. The
`BackupPayload` type in `shared/src/types.ts` is kept unchanged. Full `coingecko.ts`
cleanup is deferred to Plan Item 6.

**Scale/Scope**: Single package (`web/`). One file deleted, four files modified,
one test file updated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Shared-First Architecture** ✅
No changes to `shared/`. `BackupPayload` type (used by `/api/export` and
`/api/import`) is preserved unchanged. No cross-package imports modified.

**II. Security at the Boundary** ✅
Removing the Drive OAuth client ID from localStorage is a security improvement.
Passive cleanup (leaving pre-existing keys in place) is acceptable — they carry
no server-side access once the OAuth flow is gone.

**III. Behavior Coverage Over Line Coverage** ✅
Export and import are user-facing behaviors. Tests must cover: export happy path,
import happy path, import with missing `ops` field (schema rejection per
clarification Q2), import with unparseable file.

**IV. No Speculative Code** ✅
Only code explicitly listed in the spec is removed. No new abstractions introduced.
`coingecko.ts` full cleanup deferred to Item 6.

**V. Accessibility and Internationalisation** ✅
No new UI elements added. Existing Exportar/Importar buttons (already labelled)
are unchanged.

**Gate: PASS** — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-remove-gdrive/
├── plan.md                      # This file
├── research.md                  # Phase 0 output
├── data-model.md                # Phase 1 output
├── quickstart.md                # Phase 1 output
├── contracts/
│   └── backup-payload.md        # Phase 1 output
└── tasks.md                     # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── lib/
│   │   ├── gdrive.ts                ← DELETE (entire file)
│   │   └── storage.ts               ← MODIFY (remove 6 Drive methods + update comment)
│   ├── app/dashboard/
│   │   └── page.tsx                 ← MODIFY (remove Drive import, declaration,
│   │                                          state, handlers, useEffect branch, JSX)
│   └── components/
│       ├── HistoryTab.tsx            ← MODIFY (make apiKey optional with default '')
│       └── HistoryTab.test.tsx       ← UPDATE (remove apiKey from defaultProps)
```

**Structure Decision**: Frontend-only change. No backend or shared package touched.

## Detailed Change Map

### `web/src/lib/gdrive.ts` — DELETE

Entire file. All 5 exports are consumed only by `dashboard/page.tsx`.

### `web/src/lib/storage.ts` — MODIFY

Remove from the `storage` object:
- `getClientId` / `setClientId` / `removeClientId`
- `getGdriveUsed` / `setGdriveUsed` / `removeGdriveUsed`

Remove the localStorage keys `cp_gdrive_client_id` and `cp_gdrive_used`.

Update the module-level comment to remove the "Google Drive integration state"
reference.

Keep: `getAvatars`, `setAvatars`, and all legacy migration helpers
(`getLegacyOps`, `getLegacyExitPrices`, `hasMigrationBeenDeclined`,
`declineMigration`, `clearLegacyData`).

### `web/src/app/dashboard/page.tsx` — MODIFY

**Remove**:
- `import { driveFindFile, driveUpload, driveDownload, GDRIVE_FILE_NAME, GDRIVE_CONFIG_NAME } from '@/lib/gdrive'`
- `declare global { interface Window { google?: ... } }`
- State: `driveStatus`, `driveToken`, `driveFileId`, `configFileId`,
  `coingeckoApiKey`, `tokenClient`, `driveConnected`
- Handlers: `gdriveOnToken`, `gdriveConnect`, `gdriveDisconnect`, `gdriveSave`,
  `gdriveLoad`, `gdriveConfigKey`
- Inside `useEffect`: the `if (storage.getGdriveUsed()) setDriveStatus(...)` line
- In JSX: the `<div>` separator, the Drive button cluster
  (`!driveConnected ? ... : <>...</>`), and the `driveStatus` `<span>`
- `apiKey={coingeckoApiKey}` prop from `<HistoryTab>`

**Keep**: `exportData`, `importData`, the Exportar and Importar `<button>`/`<label>`.

Remove `storage.getGdriveUsed` from the `storage` import (keep `storage.getAvatars`
and `storage.setAvatars`). Remove `getLegacyOps` usage of `getGdriveUsed` only if
present; the migration helpers themselves stay.

### `web/src/components/HistoryTab.tsx` — MODIFY

- Change `Props.apiKey: string` to `apiKey?: string`
- Change function signature default: `{ ..., apiKey = '', ... }`
- Remove `apiKey` from `CoinSearch` props (keep `apiKey` passed as `''` internally
  or use the defaulted value — the `searchCoins` and `fetchSinglePrice` calls already
  handle an empty string correctly)

### `web/src/components/HistoryTab.test.tsx` — UPDATE

Remove `apiKey: ''` from the `defaultProps` object (or wherever it is passed to the
component under test). No new test cases in this file for this item.

### `web/src/components/` — NEW TEST

Add to the appropriate existing test file (or `dashboard/page.test.tsx` if it
exists) a test that verifies importing a file with `{ "notOps": true }` (valid JSON,
missing `ops` array) shows an error message and does not call `api.importBackup`.

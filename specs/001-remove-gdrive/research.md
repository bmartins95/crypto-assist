# Research: Remove Google Drive Integration

## Decisions & Findings

### Decision 1 — `gdrive.ts` is safe to delete entirely

**Rationale**: All 5 exports (`GDRIVE_FILE_NAME`, `GDRIVE_CONFIG_NAME`, `driveFindFile`,
`driveUpload`, `driveDownload`) are imported only by `web/src/app/dashboard/page.tsx`.
No other file references `gdrive`.

**Alternatives considered**: Stubbing the file out — rejected; a stub would leave
dead code, violating Principle IV.

### Decision 2 — 6 state variables and 5 handlers in `dashboard/page.tsx` are Drive-only

**State to remove**: `driveStatus`, `driveToken`, `driveFileId`, `configFileId`,
`coingeckoApiKey`, `tokenClient`, `driveConnected`.

**Handlers to remove**: `gdriveOnToken`, `gdriveConnect`, `gdriveDisconnect`,
`gdriveSave`, `gdriveLoad`, `gdriveConfigKey`.

**`Window.google` declaration**: Remove — only needed by `gdriveConnect`.

**`useEffect` branch**: The `if (storage.getGdriveUsed()) setDriveStatus(...)` line
inside the initial load effect must be removed.

**JSX to remove**: The separator `<div>` between import and Drive buttons, the entire
`!driveConnected ? ... : <>...</>` Drive button cluster, and the `driveStatus` `<span>`.

**What stays**: `exportData`, `importData`, the Exportar and Importar buttons.

### Decision 3 — `storage.ts` Drive methods removal

**Methods to remove from `storage` object**: `getClientId`, `setClientId`,
`removeClientId`, `getGdriveUsed`, `setGdriveUsed`, `removeGdriveUsed`.

**Keys affected**: `cp_gdrive_client_id`, `cp_gdrive_used` — both stop being written.
Per spec clarification (Q1), pre-existing values in a user's browser are left in
place (passive removal).

**What stays**: `getAvatars`, `setAvatars` — these are unrelated to Drive.
The legacy migration helpers (`getLegacyOps`, `getLegacyExitPrices`, etc.) are
also unrelated to Drive and must not be touched.

**Comment update**: The file's leading comment references "Google Drive integration
state" — this phrase must be removed.

### Decision 4 — `HistoryTab.tsx` apiKey prop becomes optional

**Context**: `dashboard/page.tsx` passes `apiKey={coingeckoApiKey}` to `<HistoryTab>`.
With `coingeckoApiKey` state removed, the prop call is removed from dashboard.
`HistoryTab` currently declares `apiKey: string` as a required prop.

**Decision**: Make `apiKey` optional with default `''` in `HistoryTab`. The
`searchCoins` and `fetchSinglePrice` functions in `coingecko.ts` already handle
an empty key correctly (they omit the `x_cg_demo_api_key` query param).

**Scope boundary**: `coingecko.ts` itself is not modified in this item — its full
removal is deferred to Plan Item 6 (price provider abstraction).

**Test update**: `HistoryTab.test.tsx` passes `apiKey: ''` in `defaultProps`. With
the prop made optional, this line can simply be removed.

### Decision 5 — `BackupPayload` contract is unchanged

The JSON export format (`BackupPayload` in `shared/src/types.ts`) is the preserved
contract. It has four fields:
- `version: number` — always `1`
- `exportedAt: string` — ISO 8601 timestamp
- `ops: NewOp[]` — array of operations
- `exitPrices?: ExitPrices` — optional map of coin ID to target exit price

Import validation (per spec clarification Q2) checks:
1. File is valid JSON
2. Parsed object has an `ops` field of type array

This matches the existing `importData` handler, which already throws
`'Formato inválido'` if `!Array.isArray(backup.ops)`.

### Decision 6 — No test file additions; two test files updated

The drive removal itself has no new runtime behavior to test. The existing
`exportData` and `importData` tests in the test suite cover the preserved flows.
`HistoryTab.test.tsx` needs only the `apiKey: ''` removal.

New test required: Verify that importing a file with a valid JSON structure but
missing the `ops` field shows an error and does not alter existing data (spec
US2 scenario 2, clarification Q2 — schema validation).

# Quickstart: Verify Remove Google Drive Integration

## Prerequisites

- Node.js installed
- Backend running locally or pointed at dev environment
- `cd web && npm install` completed

## Steps

### 1. Start the dev server

```bash
cd web
npm run dev
# Open http://localhost:5173
```

### 2. Verify the dashboard header

- Sign in with any account.
- Confirm the header contains only: **Exportar** and **Importar** buttons.
- Confirm there is no Drive, cloud, key, or logout icon.
- Confirm no status text referencing Drive is visible.

### 3. Verify export

- Click **Exportar**.
- Confirm a file named `carteira-backup-YYYY-MM-DD.json` downloads.
- Open the file and confirm it contains `version`, `exportedAt`, and `ops` fields.

### 4. Verify import — valid file

- Delete a few ops or use a test account.
- Click **Importar** and select the exported file.
- Confirm the data loads with no error message shown.

### 5. Verify import — invalid file

- Create a file `bad.json` with content `{"notOps": true}`.
- Click **Importar** and select `bad.json`.
- Confirm an error message is shown.
- Confirm existing data is unchanged.

### 6. Run the test suite

```bash
cd web
npm test
```

All tests must pass with no skipped tests.

## Expected Outcome

- No Drive-related code in `web/src/lib/gdrive.ts` (file deleted).
- `web/src/lib/storage.ts` exports no `getClientId`, `setClientId`,
  `removeClientId`, `getGdriveUsed`, `setGdriveUsed`, or `removeGdriveUsed`.
- No Drive imports or Drive state in `web/src/app/dashboard/page.tsx`.
- `HistoryTab` coin search works (no API key required).

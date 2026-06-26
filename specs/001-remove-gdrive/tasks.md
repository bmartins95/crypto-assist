---

description: "Task list for Remove Google Drive Integration"
---

# Tasks: Remove Google Drive Integration

**Input**: Design documents from `specs/001-remove-gdrive/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Included — export/import are user-facing behaviors that must have explicit
tests per constitution Principle III. One new test file created (`dashboard/page.test.tsx`).

**Organization**: Tasks grouped by user story. Foundational phase (Drive code removal)
is a hard prerequisite for all three user stories — no story can be independently
verified until the Drive code is gone.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- All paths relative to repo root
- Frontend: `web/src/`

---

## Phase 1: Setup

**Purpose**: Confirm the existing test suite is green before any changes are made.
No project initialization is needed — this is a code removal, not a new feature.

- [x] T001 Run `cd web && npm test` and confirm all tests pass (baseline before any edits)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove all Google Drive code from the codebase. This phase MUST be
complete before any user story can be independently verified — the Drive import
error and TypeScript compile errors prevent testing until all Drive references
are eliminated.

**⚠️ CRITICAL**: No user story verification can begin until this phase is complete.

- [x] T002 [P] Delete `web/src/lib/gdrive.ts` (entire file — all 5 exports consumed only by dashboard)
- [x] T003 [P] Remove `getClientId`, `setClientId`, `removeClientId`, `getGdriveUsed`, `setGdriveUsed`, `removeGdriveUsed` from the `storage` object and update the module comment to remove "Google Drive integration state" in `web/src/lib/storage.ts`
- [x] T004 Remove `import { driveFindFile, driveUpload, driveDownload, GDRIVE_FILE_NAME, GDRIVE_CONFIG_NAME } from '@/lib/gdrive'` and the `declare global { interface Window { google?: ... } }` block from `web/src/app/dashboard/page.tsx`
- [x] T005 Remove the 6 Drive state variables (`driveStatus`, `driveToken`, `driveFileId`, `configFileId`, `coingeckoApiKey`, `tokenClient`, `driveConnected`) from `web/src/app/dashboard/page.tsx`
- [x] T006 Remove the 5 Drive handlers (`gdriveOnToken`, `gdriveConnect`, `gdriveDisconnect`, `gdriveSave`, `gdriveLoad`) and `gdriveConfigKey` from `web/src/app/dashboard/page.tsx`
- [x] T007 Remove the `if (storage.getGdriveUsed()) setDriveStatus(...)` line from the initial `useEffect`, remove the Drive button cluster JSX (`!driveConnected ? ... : <>...</>`), the separator `<div>`, the `driveStatus` `<span>`, and the `apiKey={coingeckoApiKey}` prop from `<HistoryTab>` in `web/src/app/dashboard/page.tsx`; also remove `storage.getGdriveUsed` from the `storage` import destructuring
- [x] T008 [P] Make `apiKey` optional with default `''` — change `Props.apiKey: string` to `apiKey?: string` and update function signature to `{ ..., apiKey = '', ... }` in `web/src/components/HistoryTab.tsx`
- [x] T009 [P] Remove `apiKey: ''` from `defaultProps` (or wherever `apiKey` is passed to the component under test) in `web/src/components/HistoryTab.test.tsx`

**Checkpoint**: Run `cd web && npm test` — TypeScript must compile and all existing
tests must pass before proceeding to user story phases.

---

## Phase 3: User Story 1 — Export Portfolio Data (Priority: P1) 🎯 MVP

**Goal**: Verify the export action still downloads a valid file after Drive removal.

**Independent Test**: Click Exportar → a file named `carteira-backup-YYYY-MM-DD.json`
is downloaded containing a valid `BackupPayload` (with `version`, `exportedAt`, `ops`).

### Implementation for User Story 1

- [x] T010 [US1] Create `web/src/app/dashboard/page.test.tsx`; add export test: mock `api.exportBackup` returning a minimal `BackupPayload`, mock `URL.createObjectURL`, simulate a click on the Exportar button, verify `URL.createObjectURL` is called and the anchor `download` attribute matches the expected filename pattern

**Checkpoint**: US1 passes independently — `npm test` shows the export test green.
Running the app and clicking Exportar downloads a `.json` file.

---

## Phase 4: User Story 2 — Import Portfolio Data (Priority: P1)

**Goal**: Verify import accepts valid files and rejects schema-invalid files with
a visible error message.

**Independent Test**: (a) Select valid BackupPayload file → `api.importBackup`
called, data reloads. (b) Select `{ "notOps": true }` file → error alert shown,
`api.importBackup` NOT called.

### Implementation for User Story 2

- [x] T011 [P] [US2] Add import happy-path test to `web/src/app/dashboard/page.test.tsx`: simulate file input change event with a valid `BackupPayload` JSON (`{ version: 1, exportedAt: '...', ops: [] }`), verify `api.importBackup` is called with the parsed payload
- [x] T012 [P] [US2] Add import schema-rejection test to `web/src/app/dashboard/page.test.tsx`: simulate file input with `{ "notOps": true }` (valid JSON, missing `ops` array), verify `window.alert` is called with an error message and `api.importBackup` is NOT called

**Checkpoint**: US2 passes independently — both import tests green. Running the app
and selecting an invalid file shows an alert with no data loss.

---

## Phase 5: User Story 3 — Clean Dashboard (Priority: P2)

**Goal**: Verify that no Google Drive controls, status text, or separator appear
in the dashboard header after the Drive code removal.

**Independent Test**: Render the dashboard — the header contains exactly two action
controls (Exportar and Importar) and no Drive-related text or icons.

### Implementation for User Story 3

- [x] T013 [US3] Add dashboard header render test to `web/src/app/dashboard/page.test.tsx`: mock `api.getOps` and `api.getExitPrices` to return empty arrays, render `DashboardPage`, verify no element with text "Drive" is present and no element with title attribute containing "Drive", "cloud", or "key" is present in the header

**Checkpoint**: US3 passes independently — render test green. Visual inspection of
the running app confirms the header shows only Exportar and Importar.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Coverage verification and final cleanup.

- [x] T014 Run `cd web && npm run coverage` and confirm ≥90% coverage on `web/src/lib/storage.ts`, `web/src/app/dashboard/page.tsx`, and `web/src/components/HistoryTab.tsx`; paste the coverage summary as a comment on the PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run immediately
- **Foundational (Phase 2)**: Depends on Phase 1 baseline green — **BLOCKS all user stories**
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - US1 (Phase 3) and US2 (Phase 4) are independent of each other — can proceed in parallel
  - US3 (Phase 5) depends on Phase 3 (file already created) but the test itself is independent
- **Polish (Phase N)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **US2 (P1)**: Can start after Foundational — no dependency on US1 (adds to same test file)
- **US3 (P2)**: Can start after US1 (test file created in T010) — no dependency on US2

### Within Phase 2 (Foundational)

- T002 and T003 can run in parallel (different files)
- T004 → T005 → T006 → T007 must run sequentially (same file, progressive removal)
- T008 and T009 can run in parallel with T004–T007 (different files)

### Parallel Opportunities

```bash
# Phase 2 — parallel group A (file deletion + storage cleanup):
Task T002: "Delete web/src/lib/gdrive.ts"
Task T003: "Remove Drive methods from web/src/lib/storage.ts"

# Phase 2 — parallel group B (while T004–T007 run on dashboard/page.tsx):
Task T008: "Make apiKey optional in web/src/components/HistoryTab.tsx"
Task T009: "Remove apiKey from defaultProps in web/src/components/HistoryTab.test.tsx"

# Phase 4 — parallel US2 tests (same file, non-conflicting additions):
Task T011: "Import happy-path test"
Task T012: "Import schema-rejection test"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Baseline verification
2. Complete Phase 2: Drive code removal (CRITICAL — blocks all stories)
3. Complete Phase 3: Export test → **US1 verified**
4. Complete Phase 4: Import tests → **US2 verified**
5. **STOP and VALIDATE**: Export and import both work; no Drive code in browser DevTools
6. Deploy/demo if ready

### Full Delivery (All Stories)

1. MVP above
2. Complete Phase 5: Clean dashboard render test → **US3 verified**
3. Polish: Coverage ≥90% on changed files

---

## Notes

- [P] tasks = different files, no dependencies within the phase
- [US#] label maps each task to its user story for traceability
- T002–T003 can be done in any order relative to T004–T009 (different files)
- T008 must be complete before T007 is committed (TypeScript will error if apiKey is
  still required in HistoryTab while dashboard no longer passes it)
- Do not modify `web/src/lib/coingecko.ts` in this item — full cleanup deferred to Item 6
- Do not modify `shared/src/types.ts` — `BackupPayload` is preserved unchanged
- Verify the app shows no direct requests to `api.coingecko.com` for the Drive-stored
  API key (it was never used on the frontend once SSM migration was complete)

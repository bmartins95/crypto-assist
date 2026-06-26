# Feature Specification: Remove Google Drive Integration

**Feature Branch**: `001-remove-gdrive`

**Created**: 2026-06-26

**Status**: Draft

**Input**: Remove Google Drive integration — delete gdrive.ts, strip all Drive
state/handlers/buttons from dashboard/page.tsx, remove Drive-related localStorage
keys from storage.ts, keep JSON export/import functionality intact

## User Scenarios & Testing

### User Story 1 - Export Portfolio Data (Priority: P1)

A user wants to save a copy of their portfolio history to their own computer. They
trigger the export action and receive a downloaded file containing all their
operations. This workflow must continue to function correctly after the Google Drive
removal.

**Why this priority**: Data portability is a core user right; the export feature is
actively used and must not regress.

**Independent Test**: Trigger the export action and verify a valid file is downloaded
to the user's computer.

**Acceptance Scenarios**:

1. **Given** a user with portfolio operations, **When** they trigger the export
   action, **Then** a file is downloaded to their computer containing all their data
   in the established structured format.
2. **Given** a user with no operations, **When** they trigger the export action,
   **Then** a valid empty file is downloaded with no error shown.

---

### User Story 2 - Import Portfolio Data (Priority: P1)

A user wants to restore their portfolio from a previously exported file. They trigger
the import action, select their file, and their data is loaded into the application.
This workflow must continue to function correctly after the Google Drive removal.

**Why this priority**: Paired with export; essential for data recovery and migration
between devices.

**Independent Test**: Upload a valid export file and verify the data appears in the
application with no errors.

**Acceptance Scenarios**:

1. **Given** a user with a previously exported file, **When** they trigger the import
   action and select the file, **Then** all portfolio data from the file is loaded
   into the application.
2. **Given** a user who selects a file that cannot be parsed or does not match the
   expected export schema, **When** they trigger the import, **Then** a clear error
   message is shown and no existing data is altered.

---

### User Story 3 - Clean Dashboard (Priority: P2)

A user views the main dashboard and sees only relevant portfolio controls. No Google
Drive connection button, status indicator, or Drive-related prompt appears anywhere
in the interface.

**Why this priority**: Removing dead UI reduces confusion and cognitive load for all
users.

**Independent Test**: Visual inspection — the dashboard contains no Drive-related
controls or status indicators.

**Acceptance Scenarios**:

1. **Given** any authenticated user, **When** they view the dashboard, **Then** no
   Google Drive connection, disconnection, save, or sync options are visible.
2. **Given** a user who previously had Drive connected, **When** they view the
   dashboard after the update, **Then** no Drive-related state, token, or error is
   displayed.

---

### Edge Cases

- What happens when a user's stored preferences include Google Drive tokens or
  settings? They are left in place and silently ignored — no error is shown, and the
  app does not attempt to delete them.
- What happens if a user tries to import a file exported before this change? The
  import succeeds — the file format is unchanged by this removal.

## Requirements

### Functional Requirements

- **FR-001**: The application MUST NOT display any Google Drive connection,
  disconnection, save, or load controls to users.
- **FR-002**: Users MUST be able to export their complete portfolio data as a
  downloadable file at any time.
- **FR-003**: Users MUST be able to import portfolio data from a previously exported
  file, with clear feedback on success or failure. A file is considered valid only if
  it can be parsed and its structure matches the expected export schema (e.g., contains
  the required top-level fields). Files that parse successfully but do not match the
  schema MUST be rejected with an error message.
- **FR-004**: The application MUST NOT write any new Google Drive credentials, tokens,
  or connection preferences to user storage after this change. Pre-existing Drive values
  already in a user's browser storage are left in place and ignored; they will be
  cleared naturally by normal browser storage expiry or user-initiated cache clearing.
- **FR-005**: The export file format MUST remain identical to the pre-change format
  so that previously exported files can still be imported without modification.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of users see no Google Drive controls on the dashboard after the
  update is deployed.
- **SC-002**: Export completes and a file is delivered to the user in under 5 seconds
  for any portfolio size.
- **SC-003**: Import of a valid previously-exported file completes in under 5 seconds
  with data correctly loaded.
- **SC-004**: Zero regression in export/import success rate — all files exported
  before this change can still be imported after it.

## Assumptions

- The exported file format (data structure) is not changing — only the Google Drive
  delivery path is being removed; direct download remains.
- Users who previously connected Google Drive will not lose any portfolio data; only
  the Drive-specific preferences are discarded.
- The CoinGecko API key was the only Drive-stored configuration value, and it has
  since been moved to secure server-side storage; no client-side config migration is
  needed.
- No user-facing notice or in-app changelog entry is required for this internal
  cleanup.

## Clarifications

### Session 2026-06-26

- Q: Should pre-existing Drive storage keys be actively deleted on next app load? → A: Passive — stop writing new values; existing keys left until browser clears them naturally.
- Q: What determines whether an imported file is valid? → A: File must parse successfully AND match the expected export schema structure; schema mismatch is rejected with an error.

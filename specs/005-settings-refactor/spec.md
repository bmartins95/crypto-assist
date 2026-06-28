# Feature Specification: Settings Page Refactor

**Feature Branch**: `005-settings-refactor`

**Created**: 2026-06-27

**Status**: Draft

**Input**: Settings page refactor for web (sectioned cards, Stripe/Notion style) and mobile (grouped list, iOS/Coinbase/Revolut style), with theme selection, balance visibility, wallet clearing, and import/export relocated from the dashboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Theme and Language Preferences (Priority: P1)

A user wants to personalise the app's appearance. They open Settings, choose a display language from a selector, and pick between Light, Dark, or System theme. Both changes take effect instantly without a page reload or app restart.

**Why this priority**: Language and theme are the most frequently changed preferences. They are foundational to the Settings page existing at all and deliver immediate, visible value on first use.

**Independent Test**: Open the Settings page, change language to English — all labels switch. Toggle theme to Light — the app switches to a light palette. Switch back to System — the app follows the device setting. These tests require no backend.

**Acceptance Scenarios**:

1. **Given** the app is open in pt-BR, **When** the user selects "English (US)" in Settings, **Then** all visible labels and buttons change to English immediately without page reload.
2. **Given** the device is in dark mode, **When** the user selects "Sistema" theme, **Then** the app uses the dark palette; switching to "Claro" overrides it with the light palette regardless of device setting.
3. **Given** the user previously selected "Escuro" theme, **When** the app is reloaded, **Then** it opens in dark mode (preference persisted).

---

### User Story 2 - Hide Balances (Priority: P2)

A user sharing their screen or in a public space wants to hide all monetary values. They toggle "Ocultar saldos" in Settings and all currency amounts across the app are replaced with bullet placeholders. Toggling it off restores the values.

**Why this priority**: Privacy during screen sharing is a high-demand feature for portfolio apps. It does not require any backend changes and adds meaningful confidentiality.

**Independent Test**: Enable hide-balances toggle — all currency amounts and crypto quantity values (e.g., "0.5 BTC") in the Wallet, Profit, and History tabs show bullets; percentages remain visible. Disable toggle — values reappear. Reload app — preference persisted.

**Acceptance Scenarios**:

1. **Given** the user has positions with non-zero values, **When** "Ocultar saldos" is enabled, **Then** all currency amounts and crypto quantity values across all tabs are replaced with "••••••"; percentages remain visible.
2. **Given** "Ocultar saldos" is enabled, **When** the user navigates between tabs, **Then** values remain hidden on every tab.
3. **Given** "Ocultar saldos" is enabled, **When** the app is reloaded, **Then** values remain hidden (preference persisted across sessions).

---

### User Story 3 - Export, Import, and Clear Wallet (Priority: P3)

A user wants to back up their portfolio, restore from a backup, or start fresh. In Settings under "Dados", they find Export (downloads JSON), Import (uploads JSON), and in "Zona de perigo" a "Limpar carteira" button that asks for confirmation before deleting all operations.

**Why this priority**: Backup and restore are utility features that belong in Settings rather than the dashboard header. Clear wallet is a destructive action that needs a dedicated, deliberate location.

**Independent Test**: Click Export — a `.json` file downloads. Import that file — operations are restored. Click "Limpar carteira", confirm — the wallet shows zero positions. All three tests work independently of themes and balances.

**Acceptance Scenarios**:

1. **Given** the user has operations, **When** they click Export in Settings, **Then** a `.json` file matching the backup format downloads.
2. **Given** a valid `.json` backup file, **When** the user selects it via Import in Settings, **Then** the operations are restored and visible in the portfolio.
3. **Given** the user clicks "Limpar carteira", **When** they cancel the confirmation dialog, **Then** no data is deleted.
4. **Given** the user clicks "Limpar carteira" and confirms, **Then** all operations are removed and the portfolio shows zero positions.
5. **Given** an unauthenticated request to delete all operations, **Then** the server rejects it with an authentication error.

---

### Edge Cases

- What happens when the user imports a malformed or empty JSON file? → Show an error message; do not change any existing data.
- What happens if "Limpar carteira" is triggered while a price refresh is in progress? → The clear succeeds; the price refresh completes with an empty result.
- What happens when the device switches between light and dark mode while the user has "Sistema" selected? → The app immediately follows the OS change.
- What happens when the user imports a backup that contains operations already in the wallet? → Existing import behaviour applies (idempotent per the backend contract).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to select a display language from a list of supported locales on the Settings page (web) and Settings screen (mobile). The selection MUST take effect immediately without a page reload or app restart.
- **FR-002**: Users MUST be able to select a display theme (Light, Dark, System) on the Settings page/screen. The selection MUST take effect immediately and persist across sessions.
- **FR-003**: When "Sistema" theme is selected, the app MUST follow the device's current colour-scheme setting and update automatically when the device setting changes.
- **FR-004**: Users MUST be able to toggle "Ocultar saldos". When enabled, all currency-formatted amounts (e.g., "R$ 45.000,00") AND crypto quantity values (e.g., "0.5 BTC") MUST be replaced with a placeholder (e.g., "••••••"). Percentage values (e.g., "+12.4%") remain visible. The preference MUST persist across sessions.
- **FR-005**: The Export operation MUST be accessible from the Settings "Dados" section (web and mobile). It MUST produce the same backup file as the current dashboard Export.
- **FR-006**: The Import operation MUST be accessible from the Settings "Dados" section (web and mobile). It MUST accept the same backup file format as the current dashboard Import.
- **FR-007**: Export and Import MUST be removed from the dashboard header once they are present in Settings.
- **FR-008**: A "Limpar carteira" action MUST be available in a clearly labelled danger section of Settings. It MUST require explicit user confirmation before executing.
- **FR-009**: When the user confirms "Limpar carteira", the server MUST delete all operations belonging to the authenticated user and return the count of deleted records.
- **FR-010**: The Settings page (web) MUST present preferences in four visually distinct cards: Aparência e idioma, Moeda e preços, Dados, Zona de perigo.
- **FR-011**: The Settings screen (mobile) MUST present preferences in three grouped lists: Preferências, Aparência e privacidade, Dados e conta.
- **FR-012**: The "Moeda e preços" card (web) and "Preferências" group (mobile) MUST show currency and price-refresh-interval controls as visible but disabled placeholders labelled to indicate they will be available in a future update.
- **FR-013**: All strings on the Settings page and screen MUST go through the i18n layer (`useLocale()`). No hardcoded Portuguese strings in JSX/TSX.

### Key Entities

- **Theme preference**: One of three values — Light, Dark, System. Stored per device. Applied globally.
- **Balance visibility**: Boolean. When true, currency amounts and crypto quantities are masked with "••••••"; percentages are not masked. Stored per device. Applied globally.
- **Operation collection**: The full set of a user's buy/sell records. The clear-wallet action removes all of them for the authenticated user in one atomic operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Settings page (web) and Settings screen (mobile) are reachable from the dashboard in one tap/click.
- **SC-002**: Theme and language changes are visible within 100 ms of the user's selection, with no page reload.
- **SC-003**: The hide-balances toggle masks 100% of currency amounts and crypto quantity values across all tabs when enabled; percentage values remain visible.
- **SC-004**: Export, Import, and Clear Wallet are no longer present in the dashboard header after this change.
- **SC-005**: "Limpar carteira" requires at minimum one explicit confirmation step before any data is deleted.
- **SC-006**: Test coverage on changed modules meets the ≥90% threshold required by the constitution.

## Assumptions

- Item 4 (i18n framework) is merged and `useLocale()` / `UIText` keys are available before this item begins implementation.
- The existing `LocaleContext` in `web/src/` and `mobile/src/` is the mechanism for language switching; this item adds `ThemeContext` and `BalanceContext` alongside it using the same pattern.
- Currency selector and price-refresh-interval selector are rendered as disabled UI elements; their full wiring is deferred to Items 6 and 7 respectively.
- The mobile app does not yet have automated UI tests; mobile changes are validated by building the app and verifying screens render correctly.
- The confirmation for "Limpar carteira" on web uses `window.confirm` (native browser dialog); on mobile it uses React Native's `Alert.alert`. No custom modal component is introduced in this item.
- The backup file format (export/import) is unchanged. The handlers are extracted from `dashboard/page.tsx` into a shared utility file but their logic is identical.

## Clarifications

### Session 2026-06-27
- Q: Should Export/Import on mobile be file-based (share sheet / document picker) or remain web-only? → A: Both platforms. Mobile uses the Expo document picker for import and Expo sharing for export, consistent with the existing mobile implementation pattern.
- Q: When "Ocultar saldos" is enabled, which values are masked — only currency amounts, currency + quantities, or all numeric values including percentages? → A: Currency amounts AND crypto quantity values (e.g., "0.5 BTC") are masked; percentage values (e.g., "+12.4%") remain visible.

# Feature Specification: Multi-Language Support (i18n)

**Feature Branch**: `004-i18n-multilang`

**Created**: 2026-06-27

**Status**: Draft

**Input**: Full multi-language support (i18n) for web and mobile. Every user-facing string must go through an i18n layer. Users select their language from a Settings page (web) and Settings screen (mobile). Support the 10 most spoken languages. Default to pt-BR. Op.type values must be migrated from Portuguese to English in code and database.

## User Scenarios & Testing

### User Story 1 - Switch Language on Web (Priority: P1)

A user opens the web app, navigates to the Settings page, and selects a different language from a list. All visible text in the app — labels, buttons, table headers, error messages, chart labels, empty states — immediately updates to the selected language without requiring a page reload. The preference is remembered across sessions.

**Why this priority**: Core feature delivery. Without language switching on web, the feature has no user-facing value.

**Independent Test**: Open web app → go to Settings → change language to English → verify all UI labels change to English immediately.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they select "English (US)" from the language list, **Then** all UI strings switch to English instantly without a page reload.
2. **Given** the user has selected a non-default language, **When** they close and reopen the app, **Then** the previously selected language is still active.
3. **Given** the user has no stored preference, **When** they open the app for the first time, **Then** the language defaults to Portuguese (Brazil).

---

### User Story 2 - Switch Language on Mobile (Priority: P1)

A mobile user opens the Settings screen and selects a language. All visible text throughout the app updates to reflect the new language. The preference persists between app launches.

**Why this priority**: Parity with web is required; mobile has the same audience.

**Independent Test**: Open mobile app → navigate to Settings screen → change language → verify all screen labels update.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings screen, **When** they tap a language option, **Then** all strings in the app immediately reflect the selected language.
2. **Given** the user has selected a language, **When** they close and relaunch the app, **Then** the same language is active on launch.

---

### User Story 3 - All Strings Use i18n Layer (Priority: P2)

No user-facing string is hardcoded in the source. Developers adding new features write `t.someKey` instead of a literal string. TypeScript enforces that every locale file covers every key — a missing translation is a compile error.

**Why this priority**: Ensures the feature is maintainable and complete, not just a surface-level rename.

**Independent Test**: Run TypeScript compiler with all 10 locale files present; any missing translation key causes a build error.

**Acceptance Scenarios**:

1. **Given** a locale file is missing a key defined in `UIText`, **When** the TypeScript compiler runs, **Then** it reports a type error and the build fails.
2. **Given** all locale files are complete, **When** switching between any two supported languages, **Then** no placeholder or untranslated key is visible in the UI.

---

### User Story 4 - Operation Type Displayed in User's Language (Priority: P2)

Buy and sell operations are stored in the database as `'Buy'` and `'Sell'` (English). When displayed in the UI, they appear in the user's selected language (e.g., "Compra" / "Venda" in Portuguese, "Compra" / "Venta" in Spanish).

**Why this priority**: Existing data and new data must display correctly after the English-first migration.

**Independent Test**: Switch language to Spanish → verify history tab shows "Compra"/"Venta" labels → switch to English → verify "Buy"/"Sell".

**Acceptance Scenarios**:

1. **Given** the app is in Portuguese, **When** the user views the history tab, **Then** operation types appear as "Compra" and "Venda".
2. **Given** the app is in English, **When** the user views the history tab, **Then** operation types appear as "Buy" and "Sell".
3. **Given** existing database records store `'Compra'`/`'Venda'`, **When** the migration runs, **Then** all records are updated to `'Buy'`/`'Sell'` with no data loss.

---

### Edge Cases

- What happens when the user's stored locale is not in the supported list (e.g., after a supported-locales change)? → Fall back to `pt-BR`.
- What happens if a locale file has an incorrect translation? → It still compiles; the wrong text is shown. Quality is ensured by human review.
- How does the app handle right-to-left languages (Arabic, Hindi uses LTR but Arabic is RTL)? → Arabic (`ar-SA`) requires RTL layout. Web flips `document.documentElement.dir` immediately. Mobile uses `I18nManager.forceRTL(true)` which requires an app restart; the app shows a confirmation/loading screen and then restarts automatically (see FR-005 exception).
- What happens if a translation string contains dynamic values (e.g., currency amounts, percentages)? → Strings with variables use interpolation placeholders (e.g., `"Balance: {amount}"`).

## Requirements

### Functional Requirements

- **FR-001**: The app MUST support exactly 10 locales: `pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `zh-CN`, `ja-JP`, `ar-SA`, `hi-IN`, `ru-RU`.
- **FR-002**: Every user-facing string MUST be sourced from a typed `UIText` interface; hardcoded strings in JSX or React Native components are a violation.
- **FR-003**: The web app MUST include a Settings page reachable from a link or icon in the main header, containing a language selector.
- **FR-004**: The mobile app MUST include a Settings screen reachable from the main navigation, containing a language selector.
- **FR-005**: Language changes MUST take effect immediately without requiring a page reload or app restart. Exception: on mobile, selecting `ar-SA` triggers a right-to-left layout change that React Native cannot apply at runtime; the app MUST display a confirmation/loading screen and then restart automatically via `expo-updates` or `expo-router.reload()`.
- **FR-006**: The selected language MUST be persisted across sessions (localStorage on web, AsyncStorage on mobile).
- **FR-007**: When no stored preference exists, the app MUST default to `pt-BR`.
- **FR-008**: The `UIText` interface MUST be the single source of truth for translation keys; TypeScript MUST enforce that all locale files implement every key.
- **FR-009**: All stored `Op.type` values in the database MUST be migrated from `'Compra'`/`'Venda'` to `'Buy'`/`'Sell'`.
- **FR-010**: The `ar-SA` locale MUST trigger right-to-left layout on both web and mobile.
- **FR-011**: Translation strings that include dynamic values (amounts, names, dates) MUST use interpolation placeholders, not string concatenation. No current `UIText` key requires interpolation; this rule governs any future key additions.
- **FR-012**: All 10 locale files MUST be bundled with the app at build time. Runtime fetching of translations is not permitted.
- **FR-013**: If a translation key is missing at runtime in the active locale, the app MUST fall back to the `pt-BR` value for that key.

### Key Entities

- **Locale**: A supported language code (`pt-BR`, `en-US`, etc.). Determines which `UIText` implementation is active.
- **UIText**: A typed record mapping translation keys to translated strings. Each locale provides one implementation. Keys cover all user-facing strings in the app.
- **LocaleContext**: A runtime context (React context on web and mobile) that holds the active locale and exposes the active `UIText` implementation and a `setLocale` function.
- **Op.type**: The operation type field stored in the database. Values after migration: `'Buy'` or `'Sell'`. Displayed in the UI via the i18n layer.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Switching language changes 100% of visible UI labels within the same screen render (no reload required).
- **SC-002**: The TypeScript build fails if any of the 10 locale files is missing a key defined in `UIText`.
- **SC-003**: All 10 language options are accessible from the Settings page (web) and Settings screen (mobile) within 2 taps or clicks from the main screen.
- **SC-004**: After the database migration, 0 rows in `ops` retain `'Compra'` or `'Venda'` as the `type` value.
- **SC-005**: The Arabic locale correctly renders the UI in right-to-left direction on both web and mobile.
- **SC-006**: All existing tests pass after the migration with no regressions.

## Clarifications

### Session 2026-06-27

- Q: Should all 10 locale files be bundled upfront or lazy-loaded on demand? → A: Bundle all 10 locales upfront — all locale strings are included in the initial app bundle; no on-demand fetching.
- Q: If a translation key is missing at runtime, what should the fallback be? → A: Fall back to pt-BR (the canonical reference locale).

## Assumptions

- The 10 supported locales are fixed for this feature; adding more locales later is possible by adding new locale files without changing the core architecture.
- All 10 locale files are bundled with the app at build time; there is no runtime fetching of translations. Language switching is instant with zero network dependency.
- Translations for financial and investment terminology are accurate — they are not auto-generated without human review.
- The database migration runs as part of the standard deployment process; downtime is not expected given the operation is a simple value substitution on a small table.
- The Settings page (web) and Settings screen (mobile) may be minimal in v1 — language selection is the only setting required by this feature.
- RTL layout for Arabic is required at the app level; individual components do not need custom RTL handling beyond standard CSS/RN RTL primitives.
- Number and date formatting follow locale conventions (e.g., `1.234,56` in `pt-BR` vs `1,234.56` in `en-US`) and are handled by the updated `fmt()`, `fmtDate()`, and `fmtQty()` functions.

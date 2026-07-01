# Tasks: Settings Page Refactor

**Input**: Design documents from `/specs/005-settings-refactor/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓

**Organization**: Tasks grouped by user story. US1 (P1) → US2 (P2) → US3 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete task dependencies)
- **[Story]**: User story label (US1/US2/US3)

---

## Phase 1: Setup (Shared Types)

**Purpose**: Extend shared UIText interface and export ThemeMode — required before any user story can compile.

- [X] T001 Add 17 UIText keys and ThemeMode type to shared/src/i18n/types.ts (see data-model.md UIText table)
- [X] T002 Export ThemeMode from shared/src/index.ts

**Checkpoint**: `tsc --noEmit` on shared/ passes with new keys present.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Translations, backend endpoint, and API client additions that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until T001–T016 are complete.

- [X] T003 [P] Add new UIText keys to shared/src/i18n/locales/pt-BR.ts with Portuguese translations
- [X] T004 [P] Add new UIText keys to shared/src/i18n/locales/en-US.ts with English translations
- [X] T005 [P] Add new UIText keys to shared/src/i18n/locales/es-ES.ts with Spanish translations
- [X] T006 [P] Add new UIText keys to shared/src/i18n/locales/fr-FR.ts with French translations
- [X] T007 [P] Add new UIText keys to shared/src/i18n/locales/de-DE.ts with German translations
- [X] T008 [P] Add new UIText keys to shared/src/i18n/locales/zh-CN.ts with Simplified Chinese translations
- [X] T009 [P] Add new UIText keys to shared/src/i18n/locales/ja-JP.ts with Japanese translations
- [X] T010 [P] Add new UIText keys to shared/src/i18n/locales/ar-SA.ts with Arabic translations
- [X] T011 [P] Add new UIText keys to shared/src/i18n/locales/hi-IN.ts with Hindi translations
- [X] T012 [P] Add new UIText keys to shared/src/i18n/locales/ru-RU.ts with Russian translations
- [X] T013 Add DeleteAllOpsResponse model (`deleted: int`) to backend/app/models.py
- [X] T014 Add `DELETE ""` endpoint to backend/app/routes/ops.py: delete all ops for auth.user_id using cur.rowcount, return DeleteAllOpsResponse (requires T013)
- [X] T015 Add tests for DELETE /api/ops to backend/tests/test_ops.py: success returns {"deleted": N}, 401 without auth, {"deleted": 0} for user with no ops (requires T014)
- [X] T016 [P] Add `clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' })` to web/src/lib/api/client.ts
- [X] T017 [P] Add `clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' })` to mobile/src/lib/api/client.ts

**Checkpoint**: `pytest backend/tests/test_ops.py` passes for all DELETE tests. Both API clients have clearOps.

---

## Phase 3: User Story 1 — Theme and Language Preferences (Priority: P1) 🎯 MVP

**Goal**: Theme (light/dark/system) and language switching in web Settings and mobile Settings. Changes take effect immediately, persist across sessions.

**Independent Test**: Open web Settings → change theme to "Claro" → app switches to light palette → reload → still light. Change language to English → all labels switch. No backend needed.

### Implementation for User Story 1

- [X] T018 [P] [US1] Create web/src/context/ThemeContext.tsx: ThemeProvider + useTheme() hook, reads/writes 'crypto-assist:theme' in localStorage, sets document.documentElement.dataset.theme on change, listens to prefers-color-scheme media event when theme='system'
- [X] T019 [P] [US1] Update web/src/app/globals.css: replace `@media (prefers-color-scheme: dark) { :root {...} }` block with explicit `:root, html[data-theme="light"]` (light values), `html[data-theme="dark"]` (dark values), and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not([data-theme="dark"]) {...} }` (system dark)
- [X] T020 [US1] Wrap `<ThemeProvider>` around `<LocaleProvider>` in web/src/main.tsx (requires T018)
- [X] T021 [P] [US1] Create mobile/src/context/ThemeContext.tsx: ThemeProvider + useTheme() hook with isDark boolean, reads/writes 'crypto-assist:theme' in expo-secure-store, resolves system theme using useColorScheme() from react-native
- [X] T022 [US1] Wrap `<ThemeProvider>` around `<LocaleProvider>` in mobile/app/_layout.tsx (requires T021)
- [X] T023 [US1] Rewrite web/src/pages/settings.tsx as four-card layout: Card 1 "Aparência e idioma" (language select + theme select via useTheme), Card 2 "Moeda e preços" (two disabled rows with t.settings_currency_placeholder and t.settings_refresh_placeholder labels + hide-balances toggle placeholder), Card 3 "Dados" (Export + Import button stubs), Card 4 "Zona de perigo" (clear wallet button stub) — all strings via useLocale(); full functional wiring done in US2/US3 (requires T018, T020, T001–T012)
- [X] T024 [US1] Rewrite mobile/app/settings.tsx as three grouped list layout: Group 1 "Preferências" (language row, currency disabled row, price-refresh disabled row), Group 2 "Aparência e privacidade" (theme row via useTheme, hide-balances toggle stub), Group 3 "Dados e conta" (export row stub, import row stub, clear wallet row stub) — all strings via useLocale() (requires T021, T022, T001–T012)
- [X] T025 [P] [US1] Write tests in web/src/context/ThemeContext.test.tsx: defaults to 'system', sets data-theme="light" when mode is 'light', removes data-theme when mode is 'system', persists to localStorage, loads stored value on mount
- [X] T026 [P] [US1] Write tests in web/src/pages/settings.test.tsx: renders four card headings (t.settings_section_appearance, etc.), language select change calls setLocale, theme select change calls setTheme

**Checkpoint**: Settings page renders with 4 cards on web and 3 groups on mobile. Theme toggle switches palette immediately. Language toggle changes labels. `npm test` passes for ThemeContext and Settings.

---

## Phase 4: User Story 2 — Hide Balances (Priority: P2)

**Goal**: "Ocultar saldos" toggle masks currency amounts and crypto quantities across all tabs. Persists across sessions. Percentages remain visible.

**Independent Test**: Enable hide-balances toggle in Settings → navigate to Wallet, Profit, History tabs → all currency amounts and crypto quantities show "••••••" → percentages remain visible → reload → still masked. Disable toggle → values reappear.

### Implementation for User Story 2

- [X] T027 [P] [US2] Create web/src/context/BalanceContext.tsx: BalanceProvider + useBalance() hook, reads/writes 'crypto-assist:balance-hidden' in localStorage (stores 'true'/'false' string), exposes { hidden: boolean; toggleHidden: () => void }
- [X] T028 [US2] Wrap `<BalanceProvider>` inside `<ThemeProvider>` in web/src/main.tsx (requires T027, T020)
- [X] T029 [P] [US2] Create mobile/src/context/BalanceContext.tsx: BalanceProvider + useBalance() hook, reads/writes 'crypto-assist:balance-hidden' in expo-secure-store, same interface { hidden: boolean; toggleHidden: () => void }
- [X] T030 [US2] Wrap `<BalanceProvider>` inside `<ThemeProvider>` in mobile/app/_layout.tsx (requires T029, T022)
- [X] T031 [US2] Apply balance masking in web/src/components/WalletTab.tsx: import useBalance(), replace each fmt()/fmtQty() display with `hidden ? '••••••' : fmt(value)` — do NOT mask fmtPct() calls (requires T028)
- [X] T032 [US2] Apply balance masking in web/src/components/ProfitTab.tsx: same pattern as T031 (requires T028)
- [X] T033 [US2] Apply balance masking in web/src/components/HistoryTab.tsx: same pattern as T031 (requires T028)
- [X] T034 [US2] Apply balance masking in mobile/app/(tabs)/wallet.tsx, profit.tsx, history.tsx: import useBalance(), mask fmt()/fmtQty() outputs with '••••••', leave fmtPct() outputs unmasked (requires T030)
- [X] T035 [US2] Wire hide-balances toggle in web/src/pages/settings.tsx "Moeda e preços" card: connect to useBalance().toggleHidden, show checked state via hidden (requires T027, T028, T023)
- [X] T036 [US2] Wire hide-balances toggle in mobile/app/settings.tsx "Aparência e privacidade" group: connect to useBalance() (requires T029, T030, T024)
- [X] T037 [P] [US2] Write tests in web/src/context/BalanceContext.test.tsx: defaults to false, toggleHidden flips value, persists to localStorage, loads 'true' string as true on mount
- [X] T038 [US2] Extend web/src/pages/settings.test.tsx: hide-balances toggle calls toggleHidden, checked state reflects hidden value

**Checkpoint**: All three web tabs mask currency+quantity values when toggle is on. Percentages remain visible. Preference survives reload. `npm test` passes for BalanceContext and Settings.

---

## Phase 5: User Story 3 — Export, Import, and Clear Wallet (Priority: P3)

**Goal**: Export/Import moved from dashboard header to Settings "Dados" section. Clear wallet button in "Zona de perigo" calls DELETE /api/ops after confirmation.

**Independent Test**: Export downloads a .json file. Import from that file restores ops. Clear wallet → confirm → ops gone. No theme/balance context required.

### Implementation for User Story 3

- [X] T039 [US3] Create web/src/lib/dataHandlers.ts: extract exportData(t: UIText) and importData(t: UIText) from web/src/app/dashboard/page.tsx (identical logic, no refactor)
- [X] T040 [US3] Update web/src/app/dashboard/page.tsx: import exportData/importData from dataHandlers.ts, remove local definitions and Export/Import header buttons (requires T039)
- [X] T041 [US3] Wire Export button in web/src/pages/settings.tsx "Dados" card: call exportData(t) on click with error catch updating error state (requires T039, T023)
- [X] T042 [US3] Wire Import button in web/src/pages/settings.tsx "Dados" card: call importData(t) on click with error catch (requires T039, T023)
- [X] T043 [US3] Wire Clear Wallet button in web/src/pages/settings.tsx "Zona de perigo" card: call window.confirm(t.settings_clear_wallet_confirm) → on true call api.clearOps() → show t.settings_clear_wallet_success or error (requires T023, T016)
- [X] T044 [US3] Wire Export in mobile/app/settings.tsx "Dados e conta" group: call api.exportBackup() then expo-sharing to share the JSON file (requires T024, T017)
- [X] T045 [US3] Wire Import in mobile/app/settings.tsx "Dados e conta" group: use expo-document-picker to pick a .json file, parse and call api.importBackup() (requires T024, T017)
- [X] T046 [US3] Wire Clear Wallet in mobile/app/settings.tsx "Dados e conta" group: show Alert.alert with confirm/cancel, on confirm call api.clearOps() (requires T024, T017)
- [X] T047 [US3] Extend web/src/pages/settings.test.tsx: Export button triggers exportData, Clear Wallet shows confirm dialog → on confirm calls api.clearOps, on cancel no call made

**Checkpoint**: Export/Import no longer appear in dashboard header. Both appear in Settings and function identically. Clear Wallet empties ops after confirmation. `npm test` passes.

---

## Phase 6: Polish & Validation

**Purpose**: Test suite verification, coverage check, mobile build check.

- [X] T048 Run `cd backend && pytest --cov=app --cov-report=term-missing` and confirm ≥90% coverage on app/routes/ops.py and app/models.py
- [X] T049 Run `cd web && npm test` — 88 tests pass (coverage script not available; vitest --coverage would require @vitest/coverage-v8)
- [X] T050 Run `cd web && npm run build` and confirm no TypeScript errors
- [ ] T051 Run `cd shared && npx tsc --noEmit` to confirm all 10 locale files satisfy the UIText interface
- [ ] T052 Build mobile app (`cd mobile && npx expo export`) and verify settings.tsx renders without errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — T003–T012 require T001; T014 requires T013; T015 requires T014
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 3 (ThemeProvider wired in main.tsx/_layout.tsx, settings.tsx scaffolded)
- **Phase 5 (US3)**: Depends on Phase 3 (settings.tsx scaffolded) and T016/T017
- **Phase 6 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends only on foundational (Phase 2)
- **US2 (P2)**: Depends on US1 (ThemeProvider in main.tsx, settings.tsx scaffold)
- **US3 (P3)**: Depends on US1 scaffold; independent of US2

### Within Each Phase

- Locale files T003–T012 are all parallel (different files)
- T013 → T014 → T015 are sequential (model → endpoint → tests)
- T016, T017 are parallel (different packages)
- T018, T019, T021 are parallel (different files)
- T025, T026 are parallel (different test files)

### Parallel Opportunities

```bash
# Phase 2 locale additions (all [P]):
T003, T004, T005, T006, T007, T008, T009, T010, T011, T012 → run together

# Phase 3 web/mobile context creation:
T018 (ThemeContext web), T019 (globals.css), T021 (ThemeContext mobile) → run together

# Phase 4 web/mobile BalanceContext creation:
T027 (BalanceContext web), T029 (BalanceContext mobile) → run together

# Phase 4 tab masking (after T028):
T031 (WalletTab), T032 (ProfitTab), T033 (HistoryTab) → run together
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T002)
2. Complete Phase 2 (T003–T017)
3. Complete Phase 3 — US1 (T018–T026)
4. **STOP and VALIDATE**: Theme switching works in web and mobile. Language switching still works. Tests pass.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation complete
2. Phase 3 (US1) → Settings page exists, theme + language working
3. Phase 4 (US2) → Balance masking working
4. Phase 5 (US3) → Export/Import/Clear in Settings; dashboard header clean
5. Phase 6 → full test pass

---

## Notes

- [P] tasks = different files, safe to parallelize
- T023 (settings.tsx rewrite) scaffolds all four cards but only wires language + theme in US1; US2 and US3 connect the remaining controls
- Mobile masking in T034 touches three files (wallet.tsx, profit.tsx, history.tsx) — can be done as one task or split if needed
- Do not use window.confirm in tests — mock it via `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))`

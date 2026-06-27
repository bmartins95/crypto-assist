# Tasks: Multi-Language Support (i18n)

**Input**: Design documents from `specs/004-i18n-multilang/`

**Branch**: `004-i18n-multilang` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: i18n core in `shared/` — all platforms depend on this.

- [X] T001 Add `Locale` union type and `UIText` interface to `shared/src/i18n/types.ts`
- [X] T002 [P] Create `pt-BR` locale file `shared/src/i18n/locales/pt-BR.ts` (reference implementation, all UIText keys)
- [X] T003 [P] Create `en-US` locale file `shared/src/i18n/locales/en-US.ts`
- [X] T004 [P] Create `es-ES` locale file `shared/src/i18n/locales/es-ES.ts`
- [X] T005 [P] Create `fr-FR` locale file `shared/src/i18n/locales/fr-FR.ts`
- [X] T006 [P] Create `de-DE` locale file `shared/src/i18n/locales/de-DE.ts`
- [X] T007 [P] Create `zh-CN` locale file `shared/src/i18n/locales/zh-CN.ts`
- [X] T008 [P] Create `ja-JP` locale file `shared/src/i18n/locales/ja-JP.ts`
- [X] T009 [P] Create `ar-SA` locale file `shared/src/i18n/locales/ar-SA.ts`
- [X] T010 [P] Create `hi-IN` locale file `shared/src/i18n/locales/hi-IN.ts`
- [X] T011 [P] Create `ru-RU` locale file `shared/src/i18n/locales/ru-RU.ts`
- [X] T012 Create `shared/src/i18n/index.ts` exporting `LOCALES`, `getLocale`, `Locale`, `UIText` (depends on T001–T011)
- [X] T013 Update `shared/src/format.ts`: add optional `locale?: Locale` and `currency?: string` params to `fmt()`, `fmtDate()`, `fmtQty()` (defaults `'pt-BR'` / `'BRL'`)
- [X] T014 Change `Op.type` in `shared/src/types.ts` from `'Compra' | 'Venda'` to `'Buy' | 'Sell'`
- [X] T015 Export all i18n symbols from `shared/src/index.ts` (Locale, UIText, LOCALES, getLocale)

**Checkpoint**: `shared/` compiles cleanly; `tsc --noEmit` passes in `shared/`.

---

## Phase 2: Foundational (Backend + DB Migration)

**Purpose**: Backend model and database must reflect the English Op.type before any web/mobile work touches the `type` field.

**⚠️ CRITICAL**: DB migration requires user approval before running.

- [X] T016 Update `backend/app/models.py`: change `Op.type` Pydantic Literal from `'Compra' | 'Venda'` to `'Buy' | 'Sell'`
- [X] T017 Update `backend/db/schema.sql`: change `CHECK (type IN ('Compra', 'Venda'))` to `CHECK (type IN ('Buy', 'Sell'))`
- [X] T018 Create migration `backend/db/migrations/004_op_type_english.sql` (UPDATE Compra→Buy, Venda→Sell, update CHECK constraint) — **pause here, show migration SQL to user and wait for approval before executing**
- [X] T019 Add tests in `backend/tests/test_ops.py`: (a) assert new ops with `'Compra'` return 422; (b) after running the migration SQL in the test fixture, query `SELECT COUNT(*) FROM ops WHERE type IN ('Compra','Venda')` and assert 0

**Checkpoint**: `cd backend && pytest` passes; new ops with `'Compra'` are rejected with 422.

---

## Phase 3: User Story 1 — Language Switch on Web (Priority: P1) 🎯 MVP

**Goal**: Users can open Settings on web, pick a language, and all UI strings change instantly.

**Independent Test**: Open web app → Settings → switch to English → every visible label is in English without reload.

### Implementation for User Story 1

- [X] T020 [P] [US1] Create `web/src/context/LocaleContext.tsx` — React context + `useLocale()` hook; reads/writes `crypto-assist:locale` from localStorage; defaults to `pt-BR`; sets `document.documentElement.dir` for RTL
- [X] T021 [P] [US1] Create `web/src/pages/settings.tsx` — Settings page with language picker `<select id="language-select">` calling `setLocale()`; include `<label htmlFor="language-select">{t.settings_language}</label>`; all strings use `t.*` from `useLocale()`
- [X] T022 [US1] Add `/settings` route to `web/src/router.tsx` and link from `web/src/app/dashboard/page.tsx` header (Settings icon or link)
- [X] T023 [US1] Wrap `<App>` in `<LocaleProvider>` in `web/src/main.tsx`
- [X] T024 [P] [US1] Replace hardcoded strings in `web/src/components/WalletTab.tsx` with `t.*` from `useLocale()`
- [X] T025 [P] [US1] Replace hardcoded strings in `web/src/components/ProfitTab.tsx` with `t.*` from `useLocale()`
- [X] T026 [P] [US1] Replace hardcoded strings in `web/src/components/HistoryTab.tsx` with `t.*` from `useLocale()`; replace `'Compra'`/`'Venda'` references with `'Buy'`/`'Sell'` in logic; display via `t.history_opType_buy` / `t.history_opType_sell`; add test in `web/src/components/HistoryTab.test.tsx` asserting `'Buy'` ops render as `t.history_opType_buy` in the active locale
- [X] T027 [US1] Replace hardcoded strings in `web/src/app/dashboard/page.tsx` with `t.*` from `useLocale()`
- [X] T028 [US1] Add tests in `web/src/context/LocaleContext.test.tsx`: default pt-BR, setLocale persists to localStorage, RTL dir set for ar-SA, fallback to pt-BR for unknown stored value

**Checkpoint**: `cd web && npm test` passes; language switch on web is functional end-to-end.

---

## Phase 4: User Story 2 — Language Switch on Mobile (Priority: P1)

**Goal**: Mobile users open Settings screen and select a language; all screens update instantly.

**Independent Test**: Open mobile app → Settings → select language → all screen labels change without restart.

### Implementation for User Story 2

- [X] T029 [P] [US2] Create `mobile/src/context/LocaleContext.tsx` — React Native context + `useLocale()` hook; reads/writes `crypto-assist:locale` from AsyncStorage; defaults to `pt-BR`; calls `I18nManager.forceRTL(true)` for `ar-SA`
- [X] T030 [P] [US2] Create `mobile/app/(settings)/settings.tsx` — Settings screen with language list using `FlatList`; calls `setLocale()` on tap; uses `accessibilityLabel` on each touchable row
- [X] T031 [US2] Wrap root layout in `<LocaleProvider>` in `mobile/app/_layout.tsx`; when `ar-SA` is selected, call `I18nManager.forceRTL(true)` then show a full-screen loading/confirmation screen (e.g., a centered spinner with a "Restarting…" message) before triggering `expo-router`'s `router.replace('/')` or `Updates.reloadAsync()` to apply RTL; for all other locales, effect is immediate with no restart
- [X] T032 [US2] Add Settings tab or navigation entry so Settings screen is reachable within 2 taps; update `mobile/app/(tabs)/_layout.tsx` to use `t.tabs_*` for tab labels
- [X] T033 [P] [US2] Replace hardcoded strings in `mobile/app/(tabs)/wallet.tsx` with `t.*` from `useLocale()`
- [X] T034 [P] [US2] Replace hardcoded strings in `mobile/app/(tabs)/profit.tsx` with `t.*` from `useLocale()`
- [X] T035 [P] [US2] Replace hardcoded strings in `mobile/app/(tabs)/history.tsx` with `t.*` from `useLocale()`; replace `'Compra'`/`'Venda'` display with `t.history_opType_buy` / `t.history_opType_sell`; verify via a render test that op type labels match the active locale's UIText values

- [X] T041 [US2] Add tests in `mobile/src/context/LocaleContext.test.tsx`: default locale is `pt-BR`, `setLocale` persists to AsyncStorage, loading stored value on init restores the locale, unknown stored value falls back to `pt-BR`

**Checkpoint**: Mobile app builds (`cd mobile && npm start`); Settings screen is reachable; language switch updates all visible strings.

---

## Phase 5: User Story 3 — All Strings Use i18n Layer (Priority: P2)

**Goal**: TypeScript enforces complete locale coverage; no hardcoded strings remain anywhere.

**Independent Test**: Delete one key from any locale file → `tsc` errors; restore → `tsc` passes.

### Implementation for User Story 3

- [X] T036 [US3] Audit `web/src/` for any remaining hardcoded Portuguese or English UI strings not yet replaced by `t.*`; replace each one
- [X] T037 [US3] Audit `mobile/app/` for any remaining hardcoded strings not yet replaced by `t.*`; replace each one
- [X] T038 [US3] Add shared type tests in `shared/src/i18n/types.test.ts`: verify every locale in `LOCALES` satisfies `UIText` via type assertion (compile-time test); verify `getLocale` returns `pt-BR` for unknown codes
- [X] T039 [US3] Add web test in `web/src/pages/settings.test.tsx`: all 10 locale options render in the language picker; selecting one calls `setLocale`
- [X] T042 [US3] Add tests in `shared/src/format.test.ts`: `fmt(1234.56, 'en-US', 'USD')` → `'$1,234.56'`; `fmt(1234.56)` (no args) still returns BRL/pt-BR format; `fmtDate` with `'de-DE'` returns locale-correct date; `fmtQty` with `'ja-JP'` returns expected decimal format

**Checkpoint**: `tsc --noEmit` passes in `shared/`, `web/`, and `mobile/`; zero hardcoded UI strings remain.

---

## Phase 6: User Story 4 — Op.type Displayed in User's Language (Priority: P2)

**Goal**: `Buy`/`Sell` stored in DB; history tab renders them in the active locale.

**Independent Test**: Switch to Spanish → history tab shows "Compra"/"Venta"; switch to English → "Buy"/"Sell".

### Implementation for User Story 4

- [X] T040 [US4] Add test in `web/src/components/HistoryTab.test.tsx`: with locale = `'es-ES'`, ops of type `'Buy'` render as "Compra"; ops of type `'Sell'` render as "Venta" (cross-locale display assertion)

**Checkpoint**: HistoryTab shows translated op types in every locale; backend accepts only `'Buy'`/`'Sell'`.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T043 [P] Run `cd web && npm run coverage` and verify ≥90% coverage on all changed modules; fix gaps
- [X] T044 [P] Run `cd backend && pytest --cov=app --cov-report=term-missing` and verify ≥90% on changed modules
- [X] T045 Run `cd web && npm run lint` and `cd web && npm audit --audit-level=high`; fix any findings
- [X] T046 Run `cd backend && bandit -r app/ -ll` and `pip-audit`; fix any findings
- [X] T047 Verify mobile build succeeds (`cd mobile && npx expo export` or `npm run android`) with no type errors
- [X] T048 Update `mobile/AGENTS.md`: document that `LocaleContext` is at `mobile/src/context/LocaleContext.tsx` and Settings screen at `mobile/app/(settings)/settings.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (shared/ setup)**: Start immediately. All other phases depend on this.
- **Phase 2 (backend/DB)**: Depends on Phase 1 (`shared/src/types.ts` Op.type change). T018 requires user approval.
- **Phase 3 (web US1)**: Depends on Phase 1. Can start once `shared/` compiles.
- **Phase 4 (mobile US2)**: Depends on Phase 1. Can run in parallel with Phase 3.
- **Phase 5 (US3 completeness)**: Depends on Phases 3 and 4.
- **Phase 6 (US4 op display)**: Depends on Phase 2 (model change) and Phase 3/4 (i18n layer in components).
- **Phase 7 (polish)**: Depends on all phases.

### Within Each Phase

- T001 before T002–T011 (types.ts must exist for locale files to import `UIText`)
- T002–T011 can all run in parallel (independent files)
- T012 after T001–T011
- T013, T014, T015 can run in parallel after T001

### Parallel Opportunities

```
# Phase 1 — run simultaneously after T001
T002 pt-BR  |  T003 en-US  |  T004 es-ES  |  T005 fr-FR  |  T006 de-DE
T007 zh-CN  |  T008 ja-JP  |  T009 ar-SA  |  T010 hi-IN  |  T011 ru-RU

# Phase 3 — after T020/T021 exist
T024 WalletTab  |  T025 ProfitTab  |  T026 HistoryTab

# Phase 4 — after T029 exists
T033 wallet.tsx  |  T034 profit.tsx  |  T035 history.tsx

# Phase 7 — all independent
T043 web coverage  |  T044 backend coverage  |  T047 mobile build
```

---

## Implementation Strategy

### MVP (User Story 1 only — web language switch)

1. Phase 1: `shared/` — T001–T015
2. Phase 3: web context, Settings page, component string replacement — T020–T028
3. **Validate**: web switches language; all labels change
4. Optionally demo before continuing to mobile

### Incremental Delivery

1. Phase 1 → shared/ complete
2. Phase 2 → backend aligned; DB migration approved and run
3. Phase 3 → web MVP live
4. Phase 4 → mobile parity
5. Phase 5 → compile-time completeness enforced
6. Phase 6 → op type i18n validated end-to-end
7. Phase 7 → coverage + lint pass; PR ready

---

## Notes

- [P] tasks touch different files and have no shared dependencies — safe to parallelize
- All 10 locale files (T002–T011) must satisfy the `UIText` interface; TypeScript enforces this at compile time
- **T018 is gated on user approval** — do not run the migration SQL without explicit user confirmation
- RTL for Arabic: web sets `document.documentElement.dir`; mobile uses `I18nManager.forceRTL` (requires app restart on device)
- `fmt()`, `fmtDate()`, `fmtQty()` changes (T013) are backward-compatible — existing one-argument call sites continue to work

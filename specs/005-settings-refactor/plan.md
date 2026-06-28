# Implementation Plan: Settings Page Refactor

**Branch**: `005-settings-refactor` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-settings-refactor/spec.md`

## Summary

Full Settings page redesign for web (four Stripe/Notion-style sectioned cards) and mobile (three iOS-style grouped lists). Adds `ThemeContext` (light/dark/system) and `BalanceContext` (hide balances), moves Export/Import from the dashboard header into the Settings Dados section, adds a `DELETE /api/ops` backend endpoint for the clear-wallet action, and renders currency/price-refresh-interval as disabled placeholders. Depends on Item 4 (i18n framework) being merged.

## Technical Context

**Language/Version**: TypeScript 5 (web + mobile), Python 3.12 (backend)

**Primary Dependencies**:
- Web: Vite + React 19, TanStack Router, Tailwind CSS v4, Vitest + Testing Library
- Mobile: Expo SDK 54, expo-router v4, expo-secure-store, React Native
- Backend: FastAPI, psycopg v3, pytest

**Storage**:
- Web: `localStorage` for theme and balance-hidden preferences (same pattern as `LocaleContext`)
- Mobile: `expo-secure-store` for theme and balance-hidden preferences (same pattern as mobile `LocaleContext`)
- Backend: PostgreSQL (RDS Aurora Serverless v2)

**Testing**: pytest (backend), Vitest + Testing Library (web). Mobile has no automated tests — build verification only.

**Target Platform**: Browser (Chromium/Firefox/Safari) + iOS/Android (Expo Go + standalone)

**Project Type**: Web app + mobile app

**Performance Goals**: Theme/language changes visible within 100 ms per SC-002.

**Constraints**:
- No page reload on settings change (all preferences applied reactively)
- Item 4 (i18n) must be merged first; `useLocale()` and `UIText` are prerequisites
- `window.confirm` for clear-wallet confirmation on web, `Alert.alert` on mobile
- Currency selector and price-refresh-interval controls are disabled placeholders only

**Scale/Scope**: 5 new TypeScript files, 2 modified contexts (LocaleProvider already existing), 1 new backend endpoint, 10 locale file updates.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| No `any` in TypeScript | PASS | All new contexts typed with explicit interfaces |
| No code beyond current item | PASS | Currency/refresh controls are disabled stubs, not wired |
| ≥90% coverage on changed modules | PASS | Required — tests must cover ThemeContext, BalanceContext, DELETE /api/ops |
| `<input>` must have `<label>` | PASS | All settings controls labelled via `useLocale()` strings |
| All UI strings via i18n layer | PASS | No hardcoded strings; all go through `t.xxx` from `useLocale()` |
| No secrets in source | PASS | No credentials introduced |
| Single responsibility per module | PASS | ThemeContext and BalanceContext are separate modules |
| New exports from shared/ added to index.ts | PASS | `ThemeMode` type exported from shared; `UIText` keys added |
| Additive-only migrations | N/A | No schema changes |

## Project Structure

### Documentation (this feature)

```text
specs/005-settings-refactor/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← DELETE /api/ops contract
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code

```text
shared/src/
├── i18n/
│   ├── types.ts              ← add 16 new UIText keys for settings
│   └── locales/
│       ├── pt-BR.ts          ← add translations for new keys
│       ├── en-US.ts          ← add translations for new keys
│       └── [8 more locales]  ← same
└── index.ts                  ← ensure ThemeMode is exported

backend/
├── app/
│   ├── routes/ops.py         ← add DELETE "" endpoint
│   └── models.py             ← add DeleteAllOpsResponse model
└── tests/
    └── test_ops.py           ← add tests: DELETE all, 401 without auth

web/src/
├── context/
│   ├── ThemeContext.tsx       ← NEW: ThemeProvider + useTheme()
│   └── BalanceContext.tsx     ← NEW: BalanceProvider + useBalance()
├── lib/
│   ├── dataHandlers.ts        ← NEW: exportData + importData extracted from dashboard
│   └── api/client.ts         ← add clearOps() method
├── pages/
│   └── settings.tsx           ← REWRITE: four-card layout
├── app/
│   └── dashboard/page.tsx    ← remove export/import buttons, use dataHandlers.ts
├── app/
│   └── globals.css           ← add html[data-theme="light"] and [data-theme="dark"] overrides
└── main.tsx                  ← wrap with ThemeProvider + BalanceProvider

mobile/
├── src/context/
│   ├── ThemeContext.tsx       ← NEW: ThemeProvider + useTheme()
│   └── BalanceContext.tsx     ← NEW: BalanceProvider + useBalance()
├── src/lib/api/client.ts     ← add clearOps() method
└── app/
    ├── _layout.tsx            ← wrap with ThemeProvider + BalanceProvider
    └── settings.tsx           ← REWRITE: three grouped list layout
```

**Structure Decision**: Monorepo. Shared context patterns for web and mobile mirror the existing `LocaleContext` approach.

## Implementation Phases

### Phase 1 — Backend: DELETE /api/ops

Add `DeleteAllOpsResponse` model to `backend/app/models.py`:
```python
class DeleteAllOpsResponse(BaseModel):
    deleted: int
```

Add endpoint to `backend/app/routes/ops.py`:
- `DELETE ""` with `Depends(require_auth)` 
- Executes `DELETE FROM ops WHERE user_id = %s` with `RETURNING COUNT(*)`
- Returns `DeleteAllOpsResponse(deleted=count)`
- Returns 401 when unauthenticated (via `require_auth`)

Add to `web/src/lib/api/client.ts`:
```ts
clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' }),
```

Add same to `mobile/src/lib/api/client.ts`.

Tests: `backend/tests/test_ops.py` — DELETE all succeeds returning count, 401 without auth.

### Phase 2 — Shared: UIText keys + ThemeMode type

New keys to add to `shared/src/i18n/types.ts` (UIText interface):
```ts
settings_section_appearance: string;    // "Aparência e idioma"
settings_section_currency: string;      // "Moeda e preços"
settings_section_data: string;          // "Dados"
settings_section_danger: string;        // "Zona de perigo"
settings_theme: string;                 // "Tema"
settings_theme_light: string;           // "Claro"
settings_theme_dark: string;            // "Escuro"
settings_theme_system: string;          // "Sistema"
settings_hide_balances: string;         // "Ocultar saldos"
settings_currency_placeholder: string;  // "Disponível em breve"
settings_refresh_placeholder: string;   // "Disponível em breve"
settings_clear_wallet: string;          // "Limpar carteira"
settings_clear_wallet_confirm: string;  // "Tem certeza? Todas as operações serão removidas."
settings_clear_wallet_success: string;  // "Carteira limpa com sucesso."
settings_preferences: string;           // "Preferências" (mobile group)
settings_appearance_privacy: string;    // "Aparência e privacidade" (mobile group)
settings_data_account: string;          // "Dados e conta" (mobile group)
```

Add `ThemeMode` type to `shared/src/i18n/types.ts`:
```ts
export type ThemeMode = 'light' | 'dark' | 'system';
```

Export from `shared/src/index.ts`.

Add all translations to the 10 locale files.

### Phase 3 — Web: ThemeContext

`web/src/context/ThemeContext.tsx`:
- `STORAGE_KEY = 'crypto-assist:theme'`
- `useState<ThemeMode>` initialised from localStorage, defaults to `'system'`
- `useEffect` sets `document.documentElement.setAttribute('data-theme', resolved)` where resolved = theme if not system, else matches `prefers-color-scheme: dark` media query
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` change events to re-derive when theme is `'system'`
- Writes to localStorage on change

`web/src/app/globals.css`:
- Replace `@media (prefers-color-scheme: dark) { :root { ... } }` with explicit selectors:
  - `:root, html[data-theme="light"]` — light palette (existing light values)
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not([data-theme="dark"]) { ... } }` — system dark
  - `html[data-theme="dark"]` — dark palette

`web/src/main.tsx` — wrap with `<ThemeProvider>` inside `<LocaleProvider>`.

### Phase 4 — Web: BalanceContext

`web/src/context/BalanceContext.tsx`:
- `STORAGE_KEY = 'crypto-assist:balance-hidden'`
- `useState<boolean>` initialised from localStorage (`=== 'true'`), defaults to `false`
- Exposes `{ hidden: boolean; toggleHidden: () => void }`
- Writes to localStorage on change

`web/src/main.tsx` — wrap with `<BalanceProvider>` (inside ThemeProvider).

Components that call `fmt()`, `fmtQty()`, or display crypto quantities check `hidden` from `useBalance()` and render `'••••••'` instead when true. Percentages (from `fmtPct()`) are NOT masked. Affected components: `WalletTab.tsx`, `ProfitTab.tsx`, `HistoryTab.tsx`.

### Phase 5 — Web: dataHandlers + Settings page

`web/src/lib/dataHandlers.ts`:
- `exportData(t: UIText): Promise<void>` — extracts the export handler from `dashboard/page.tsx`
- `importData(t: UIText): Promise<void>` — extracts the import handler

`web/src/pages/settings.tsx` — rewrite as four-card layout:
1. **Aparência e idioma**: language `<select>` (existing), theme `<select>` (light/dark/system)
2. **Moeda e preços**: currency row (disabled), price refresh row (disabled), hide balances toggle
3. **Dados**: Export button, Import button
4. **Zona de perigo**: "Limpar carteira" button (red), triggers `window.confirm` → `api.clearOps()`

`web/src/app/dashboard/page.tsx`:
- Remove `exportData`, `importData` local definitions; import from `dataHandlers.ts`
- Remove Export and Import buttons from the header JSX

### Phase 6 — Mobile: ThemeContext + BalanceContext

`mobile/src/context/ThemeContext.tsx`:
- `STORAGE_KEY = 'crypto-assist:theme'` with `SecureStore.getItemAsync/setItemAsync`
- Same `ThemeMode` type
- `useColorScheme()` from `react-native` for system resolution
- Exposes `{ theme: ThemeMode; setTheme: (m: ThemeMode) => void; isDark: boolean }`

`mobile/src/context/BalanceContext.tsx`:
- `STORAGE_KEY = 'crypto-assist:balance-hidden'` with SecureStore
- Exposes `{ hidden: boolean; toggleHidden: () => void }`

`mobile/app/_layout.tsx` — wrap `RootLayoutNav` with `<ThemeProvider>` and `<BalanceProvider>`.

Note: Mobile theme applies via `isDark` flag from ThemeContext to style objects in screens. Global color application is a per-screen concern; this item adds the context and wires it to the Settings screen only. Applying `isDark` across all screens is deferred to a polish pass.

### Phase 7 — Mobile: Settings screen

`mobile/app/settings.tsx` — rewrite as three grouped lists:
1. **Preferências**: Language row (locale picker, existing), Currency row (disabled), Price refresh row (disabled)
2. **Aparência e privacidade**: Theme row (picker: System/Light/Dark), Hide balances toggle
3. **Dados e conta**: Export row, Import row (Expo document picker / sharing), Clear wallet row (Alert.alert confirmation)

### Phase 8 — Tests

`web/src/context/ThemeContext.test.tsx`:
- Defaults to `'system'`
- Sets `data-theme="light"` when theme is `'light'`
- Persists to localStorage

`web/src/context/BalanceContext.test.tsx`:
- Defaults to `false`
- `toggleHidden` flips the value and writes to localStorage
- Loads persisted value on mount

`web/src/pages/settings.test.tsx`:
- Renders four cards with correct headings
- Language change calls `setLocale`
- Theme change calls `setTheme`
- Toggle hide-balances calls `toggleHidden`
- Export button triggers export handler
- Clear wallet button shows confirm dialog; on confirm calls `api.clearOps`

`backend/tests/test_ops.py` additions:
- `DELETE /api/ops` returns `{"deleted": N}` for authenticated user
- `DELETE /api/ops` returns 401 when no auth header
- `DELETE /api/ops` returns `{"deleted": 0}` for a user with no ops

## Complexity Tracking

No constitution violations.

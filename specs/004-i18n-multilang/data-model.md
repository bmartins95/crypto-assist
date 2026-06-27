# Data Model: Multi-Language Support (i18n)

## Entities

### Locale (shared type)

```typescript
export type Locale =
  | 'pt-BR'
  | 'en-US'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'zh-CN'
  | 'ja-JP'
  | 'ar-SA'
  | 'hi-IN'
  | 'ru-RU';
```

- Fixed union of 10 values
- Adding a new locale = adding a new value here + a new locale file
- `'pt-BR'` is the default and the fallback locale

---

### UIText (shared interface)

```typescript
export interface UIText {
  // Tab labels
  tabs_wallet: string;
  tabs_profit: string;
  tabs_history: string;

  // Chart type labels
  chart_byAsset: string;
  chart_overTime: string;
  chart_value: string;

  // Wallet tab
  wallet_emptyState: string;
  wallet_groupBy_asset: string;
  wallet_groupBy_platform: string;
  wallet_groupBy_both: string;
  wallet_col_asset: string;
  wallet_col_platform: string;
  wallet_col_qty: string;
  wallet_col_avgPrice: string;
  wallet_col_currentPrice: string;
  wallet_col_value: string;
  wallet_col_pnl: string;
  wallet_col_pnlPct: string;
  wallet_col_exitPrice: string;

  // Profit tab
  profit_emptyState: string;
  profit_invested: string;
  profit_currentValue: string;
  profit_pnl: string;
  profit_realized: string;

  // History tab
  history_emptyState: string;
  history_col_date: string;
  history_col_asset: string;
  history_col_type: string;
  history_col_qty: string;
  history_col_price: string;
  history_col_fee: string;
  history_col_total: string;
  history_col_platform: string;
  history_opType_buy: string;
  history_opType_sell: string;

  // Op form
  history_form_addOp: string;
  history_form_editOp: string;
  history_form_date: string;
  history_form_asset: string;
  history_form_type: string;
  history_form_qty: string;
  history_form_price: string;
  history_form_fee: string;
  history_form_total: string;
  history_form_platform: string;
  history_form_save: string;
  history_form_cancel: string;
  history_form_delete: string;
  history_form_trade: string;

  // Trade form
  trade_form_title: string;
  trade_form_from: string;
  trade_form_to: string;
  trade_form_qty: string;
  trade_form_price: string;
  trade_form_fee: string;
  trade_form_save: string;
  trade_form_cancel: string;

  // Settings
  settings_title: string;
  settings_language: string;

  // Navigation
  nav_settings: string;
  nav_logout: string;

  // Auth
  auth_authenticating: string;
  auth_failed: string;

  // Common
  common_loading: string;
  common_empty: string;
  common_error: string;
  common_save: string;
  common_cancel: string;
  common_delete: string;
}
```

**Constraint**: Every locale file must implement all keys — TypeScript enforces this at compile time (`const ptBR: UIText = { ... }` will error if any key is missing or extra).

---

### LOCALES (runtime registry)

```typescript
export const LOCALES: Record<Locale, UIText> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'ar-SA': arSA,
  'hi-IN': hiIN,
  'ru-RU': ruRU,
};
```

- All 10 locales bundled at build time (no lazy loading)
- `getLocale(code: Locale): UIText` returns `LOCALES[code] ?? LOCALES['pt-BR']` (pt-BR fallback for unknown keys)

---

### LocaleContext (web and mobile — same shape)

```typescript
interface LocaleContextValue {
  locale: Locale;
  t: UIText;             // active translations
  setLocale: (l: Locale) => void;
}
```

- `locale` — active code, persisted to storage
- `t` — the UIText object for the active locale; components use `t.someKey`
- `setLocale` — updates locale, persists, triggers RTL flip if needed

---

## Modified Entities

### Op.type (shared/src/types.ts)

| Before | After |
|---|---|
| `'Compra' \| 'Venda'` | `'Buy' \| 'Sell'` |

All references to `'Compra'` / `'Venda'` in source code are replaced with `'Buy'` / `'Sell'`. Display is handled via `t.history_opType_buy` and `t.history_opType_sell`.

### ops table (PostgreSQL)

```sql
-- Before
type VARCHAR(20) CHECK (type IN ('Compra', 'Venda'))

-- After
type VARCHAR(20) CHECK (type IN ('Buy', 'Sell'))
```

Migration:
```sql
-- 004_op_type_english.sql
BEGIN;
UPDATE ops SET type = 'Buy'  WHERE type = 'Compra';
UPDATE ops SET type = 'Sell' WHERE type = 'Venda';
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_type_check;
ALTER TABLE ops ADD CONSTRAINT ops_type_check CHECK (type IN ('Buy', 'Sell'));
COMMIT;
```

---

## Locale Preference Storage

| Platform | Key | Store |
|---|---|---|
| Web | `crypto-assist:locale` | `localStorage` |
| Mobile | `crypto-assist:locale` | `AsyncStorage` |

Same key name on both platforms for consistency.

---

## RTL Behaviour

| Locale | Direction |
|---|---|
| `ar-SA` | RTL (`dir="rtl"` on web; `I18nManager.forceRTL(true)` on mobile) |
| All others | LTR (default) |

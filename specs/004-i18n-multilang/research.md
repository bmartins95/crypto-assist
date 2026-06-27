# Research: Multi-Language Support (i18n)

## Decision 1: i18n approach — custom vs library

**Decision**: Custom typed record approach in `shared/` (no i18n library)

**Rationale**: The app has a bounded, known string set (~150 keys). A typed `Record<string, string>` in pure TypeScript gives compile-time completeness enforcement with zero runtime overhead and zero new dependencies. Libraries like `i18next` add runtime configuration, plugin systems, namespace complexity, and bundle weight that are all overkill for this use case. The constitution (Principle IV) prohibits speculative abstractions.

**Alternatives considered**:
- `i18next` / `react-i18next` — rejected: adds 3 packages, lazy-load config, plugin ecosystem; no benefit over a typed record for a fixed key set
- `react-intl` (FormatJS) — rejected: ICU message format is powerful but the parse overhead is unnecessary; interpolation placeholders (`{amount}`) can be handled with a simple `replace` utility
- Native `Intl` API only — rejected: `Intl` handles number/date formatting but not UI string lookup; we need both, so `Intl` is used inside `fmt()`/`fmtDate()` but a typed record handles string lookup

---

## Decision 2: UIText key structure — flat vs namespaced

**Decision**: Flat keys with a prefix convention (`wallet_emptyState`, `history_opType_buy`)

**Rationale**: Namespaced objects (`{ wallet: { emptyState: '...' } }`) require deeper TypeScript structural typing and make the fallback lookup more complex. Flat keys with a prefix are equally readable, trivially iterable, and simpler to enforce with TypeScript's `Record<string, string>` shape. The `UIText` interface lists each key explicitly so TypeScript enforces completeness at the locale-file level.

**Alternatives considered**:
- Nested namespace objects — rejected: adds type complexity without UX benefit; unnecessary for ~150 keys
- Auto-generated keys from source scan — rejected: violates "no build step" constraint on `shared/`

---

## Decision 3: Locale persistence — localStorage (web) vs AsyncStorage (mobile)

**Decision**: `localStorage` on web, `AsyncStorage` on mobile (both already in use in the project)

**Rationale**: These are the standard persistence mechanisms already used in the project for other preferences. No new storage abstraction is needed. The locale key is `crypto-assist:locale`.

---

## Decision 4: RTL support for Arabic (`ar-SA`)

**Decision**: Web — set `dir="rtl"` on `<html>` via `document.documentElement.dir`; Mobile — call `I18nManager.forceRTL(true)` and restart (standard React Native RTL pattern)

**Rationale**: CSS `dir` attribute handles RTL layout for web components without individual component changes. React Native's `I18nManager.forceRTL` is the only supported way to flip the layout direction globally. Both are the documented idiomatic approaches.

**Alternatives considered**:
- Per-component RTL styles — rejected: requires touching every component; fragile
- `@expo/vector-icons` RTL props — not applicable

---

## Decision 5: `Op.type` migration — in-place UPDATE vs additive

**Decision**: In-place `UPDATE` of existing rows (`'Compra'` → `'Buy'`, `'Venda'` → `'Sell'`)

**Rationale**: The migration rules say "additive only" for schema changes (column add/remove/rename). This is a **data** migration on an existing column — the column stays, its constraint is updated, and existing rows are updated. A two-step approach (add new column, backfill, drop old) would be disproportionate for a simple value rename on a non-nullable column with a CHECK constraint. The migration runs under a transaction so it is atomic.

**Risk**: LOW — `ops.type` has a CHECK constraint and two possible values; the UPDATE is O(n) on a small table (personal portfolio data).

---

## Decision 6: `fmt()` signature — overloaded vs optional params

**Decision**: Optional params with defaults: `fmt(v: number, locale?: Locale, currency?: string): string`

**Rationale**: Existing callers use `fmt(v)` with no arguments and must continue to work unchanged (backward compatibility). Adding optional `locale` and `currency` parameters with defaults of `'pt-BR'` and `'BRL'` satisfies both old call sites and new locale-aware call sites. No function overloads needed.

---

## UIText key inventory (initial scan)

Keys derived from reading all web and mobile components:

```
tabs_wallet, tabs_profit, tabs_history,
chart_byAsset, chart_overTime, chart_value,
wallet_emptyState, wallet_groupBy_asset, wallet_groupBy_platform, wallet_groupBy_both,
wallet_col_asset, wallet_col_platform, wallet_col_qty, wallet_col_avgPrice,
wallet_col_currentPrice, wallet_col_value, wallet_col_pnl, wallet_col_pnlPct,
wallet_col_exitPrice,
profit_emptyState, profit_invested, profit_currentValue, profit_pnl, profit_realized,
history_emptyState, history_col_date, history_col_asset, history_col_type,
history_col_qty, history_col_price, history_col_fee, history_col_total, history_col_platform,
history_opType_buy, history_opType_sell,
history_form_addOp, history_form_editOp, history_form_date, history_form_asset,
history_form_type, history_form_qty, history_form_price, history_form_fee,
history_form_total, history_form_platform, history_form_save, history_form_cancel,
history_form_delete, history_form_trade,
trade_form_title, trade_form_from, trade_form_to, trade_form_qty, trade_form_price,
trade_form_fee, trade_form_save, trade_form_cancel,
settings_title, settings_language,
nav_settings, nav_logout,
auth_authenticating, auth_failed,
common_loading, common_empty, common_error, common_save, common_cancel, common_delete
```

Final key list is defined in `shared/src/i18n/types.ts` (canonical) and reflected in `data-model.md`.
Removed from initial inventory: `settings_language_label` (redundant — `settings_language` serves as the `<label>` text); `fmt_currency_symbol` (handled automatically by `Intl.NumberFormat` with `currency` option).

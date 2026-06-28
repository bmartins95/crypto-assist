# Research: Settings Page Refactor

## Theme Switching via CSS Custom Properties

**Decision**: Use `data-theme` attribute on `<html>` element combined with CSS attribute selectors.

**Rationale**: The existing `globals.css` already uses CSS custom properties (`--bg`, `--text`, etc.) with an `@media (prefers-color-scheme: dark)` block. Adding `html[data-theme="light"]` and `html[data-theme="dark"]` attribute selectors alongside the media query lets the ThemeContext override the OS preference when the user picks light or dark explicitly. The `system` theme simply removes the attribute and lets the media query govern.

**Approach**:
```css
/* Light (default) */
:root { --bg: #ffffff; ... }

/* System dark: only active when no explicit data-theme attribute */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) {
    --bg: #1a1a1a; ...
  }
}

/* Explicit dark override */
html[data-theme="dark"] { --bg: #1a1a1a; ... }
/* Explicit light override (no-op — same as :root — but explicit for clarity) */
html[data-theme="light"] { --bg: #ffffff; ... }
```

**Alternatives considered**:
- CSS-in-JS theme object: Rejected — no CSS-in-JS in this project; globals.css already handles all styling.
- Multiple CSS files swapped at runtime: Rejected — more complex and causes FOUC.

---

## Mobile Theme Approach

**Decision**: `ThemeContext` in mobile provides `isDark: boolean` (computed from `ThemeMode` + `useColorScheme()`). Individual screens apply styles via a ternary on `isDark`. No global theme provider equivalent to CSS exists in React Native without a dedicated library.

**Rationale**: React Native has no DOM and no CSS cascade. The existing mobile screens use hardcoded style objects. Applying full dark mode across all screens is a multi-sprint effort beyond this item's scope. This item adds the context and applies it on the Settings screen only, establishing the pattern.

**Alternatives considered**:
- `react-native-paper` or similar theming library: Rejected — not in current dependencies; adding it is out of scope per the dependency constraint (Item 5 scope).
- Conditional StyleSheet objects passed through context: Valid approach, deferred — requires touching all screens.

---

## Balance Masking Pattern

**Decision**: `BalanceContext` provides `hidden: boolean`. Components that render monetary values or crypto quantities check `hidden` and render `'••••••'` instead of the formatted value. Percentages bypass masking.

**Rationale**: Masking at the component level (not inside `fmt()`) keeps `fmt()` pure and testable. Only the display layer changes. The `fmtPct()` function is never masked — the spec requires percentages remain visible.

**Approach**: Wrap or replace each `fmt(value)` call with `hidden ? '••••••' : fmt(value)`. Similarly for `fmtQty()` calls. Do NOT mask `fmtPct()` calls.

---

## Export/Import Handler Extraction

**Decision**: Create `web/src/lib/dataHandlers.ts` with two exported functions `exportData` and `importData`, each accepting the `UIText` object `t` for error messages.

**Rationale**: The dashboard currently defines these inline. The Settings page needs the same logic. Rather than duplicating or importing from the dashboard, extracting to a shared utility module is the single-responsibility approach.

**Mobile**: Mobile's export/import is already separate. Mobile uses `expo-document-picker` for import (pick a `.json` file) and `expo-sharing` for export (share the JSON string as a file). These are the existing patterns per the mobile AGENTS.md.

---

## Backend DELETE /api/ops

**Decision**: Add `@router.delete("")` to `backend/app/routes/ops.py` that deletes all ops for `auth.user_id` and returns `{"deleted": count}`.

**Rationale**: The existing individual delete `@router.delete("/{op_id}")` sets the pattern. The new all-delete uses `DELETE FROM ops WHERE user_id = %s RETURNING id` or `DELETE FROM ops WHERE user_id = %s` with a preceding `SELECT COUNT(*)`, but the cleanest approach is `DELETE … RETURNING COUNT(*)` — not directly supported in PostgreSQL. Instead: execute DELETE, use `cur.rowcount` which psycopg v3 populates after a DELETE.

**Implementation**:
```python
cur.execute("DELETE FROM ops WHERE user_id = %s", (auth.user_id,))
count = cur.rowcount
conn.commit()
return {"deleted": count}
```
`cur.rowcount` is set by psycopg v3 after any DML statement.

---

## i18n Keys: New Additions to UIText

16 new keys required. All existing locale files must receive matching entries to keep the TypeScript discriminated union exhaustive.

Key grouping:
- `settings_section_*` — card/group headings
- `settings_theme*` — theme selector labels
- `settings_hide_balances` — toggle label
- `settings_currency_placeholder`, `settings_refresh_placeholder` — disabled field hint
- `settings_clear_wallet*` — danger zone button and confirmation
- `settings_preferences`, `settings_appearance_privacy`, `settings_data_account` — mobile group headings

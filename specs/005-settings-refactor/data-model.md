# Data Model: Settings Page Refactor

## Client-Side Preferences (no backend storage)

### ThemeMode
```ts
type ThemeMode = 'light' | 'dark' | 'system';
```
- **Storage key**: `crypto-assist:theme` (localStorage on web, expo-secure-store on mobile)
- **Default**: `'system'`
- **Lifecycle**: Written on user selection; read on app mount.
- **Derived state (web)**: `document.documentElement.dataset.theme` is set to `'light'` or `'dark'` when the mode is explicit; the attribute is removed when `'system'`.
- **Derived state (mobile)**: `isDark: boolean` computed from `ThemeMode` + `useColorScheme()`.

### BalanceHidden
```ts
type BalanceHidden = boolean;
```
- **Storage key**: `crypto-assist:balance-hidden` (localStorage on web, expo-secure-store on mobile)
- **Default**: `false`
- **Lifecycle**: Toggled by user; read on app mount.
- **Effect**: When `true`, all `fmt()` and `fmtQty()` outputs in components are replaced with `'••••••'`. `fmtPct()` outputs are NOT replaced.

---

## Backend

### DeleteAllOpsResponse
```python
class DeleteAllOpsResponse(BaseModel):
    deleted: int  # number of rows removed
```
- Returned by `DELETE /api/ops`.
- `deleted` is the `rowcount` after the DELETE statement.

---

## Context Interfaces

### ThemeContextValue (web)
```ts
interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}
```

### ThemeContextValue (mobile)
```ts
interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}
```

### BalanceContextValue (web + mobile)
```ts
interface BalanceContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}
```

---

## UIText Keys Added

| Key | Type | Example (pt-BR) |
|-----|------|-----------------|
| `settings_section_appearance` | string | "Aparência e idioma" |
| `settings_section_currency` | string | "Moeda e preços" |
| `settings_section_data` | string | "Dados" |
| `settings_section_danger` | string | "Zona de perigo" |
| `settings_theme` | string | "Tema" |
| `settings_theme_light` | string | "Claro" |
| `settings_theme_dark` | string | "Escuro" |
| `settings_theme_system` | string | "Sistema" |
| `settings_hide_balances` | string | "Ocultar saldos" |
| `settings_currency_placeholder` | string | "Disponível em breve" |
| `settings_refresh_placeholder` | string | "Disponível em breve" |
| `settings_clear_wallet` | string | "Limpar carteira" |
| `settings_clear_wallet_confirm` | string | "Tem certeza? Todas as operações serão removidas permanentemente." |
| `settings_clear_wallet_success` | string | "Carteira limpa com sucesso." |
| `settings_preferences` | string | "Preferências" |
| `settings_appearance_privacy` | string | "Aparência e privacidade" |
| `settings_data_account` | string | "Dados e conta" |

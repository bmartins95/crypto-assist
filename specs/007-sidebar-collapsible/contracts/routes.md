# UI Contract: Routes & Layout

## Route table (after this feature)

| Path | Guard | Layout | Renders |
|------|-------|--------|---------|
| `/` | — | — | redirect → `/wallet` |
| `/auth` | redirect to `/wallet` if session | none | `AuthClient` |
| `/auth/callback` | — | none | `AuthCallbackPage` (success → `/wallet`) |
| `/wallet` | session required (layout guard) | `AppLayout` | `WalletTab` with shared portfolio context |
| `/profit` | session required (layout guard) | `AppLayout` | `ProfitTab` with shared portfolio context |
| `/history` | session required (layout guard) | `AppLayout` | `HistoryTab` with shared portfolio context |
| `/settings` | session required (layout guard) | `AppLayout` | `SettingsPage` (own in-page title/subtitle header) |
| `/dashboard` | — | — | **removed** (falls through to router not-found) |

## AppLayout contract

- Two-column CSS grid `.layout` (288px | 1fr), `.layout.collapsed` (66px | 1fr), 0.22s transition; nav items separated by a 4px gap.
- Owns `collapsed: boolean` from `localStorage('sidebar:collapsed')` (lazy init, `'1'` = collapsed).
- Owns portfolio data via `PortfolioProvider`; children consume `usePortfolio()`.
- Below 820px: single column; sidebar stacks on top with bottom border (per prototype media query).

## Sidebar contract

- Props: `collapsed: boolean`, `onToggle: () => void`.
- Top: brand (₿ logo + app name), collapse button (`aria-label` from i18n, `aria-expanded={!collapsed}`, chevron rotates 180° when collapsed).
- Nav: section label + three `<Link>` items (`/wallet`, `/profit`, `/history`) using `activeProps={{ className: 'navi active' }}`, each with `data-tip` label for the collapsed CSS tooltip.
- Footer: Settings `<Link to="/settings">`, Logout (existing `LogoutButton` behaviour, `.navi` styling), user chip (avatar initial + email from `getEmailFromIdToken`; email hidden when collapsed, truncated with ellipsis when long).
- All labels via `useLocale()`: `nav_wallet`, `nav_profit`, `nav_history`, `nav_settings`, `nav_logout`.

## Non-changes (guaranteed)

- No backend endpoint added, changed, or removed.
- `WalletTab`, `ProfitTab`, `HistoryTab` public props unchanged.
- Mobile app type contract unchanged (i18n keys are additive).

# Crypto Assist — Implementation Plan

Items are ordered by priority and dependency. Do not start an item until its dependencies are merged.
Check the box in a `chore: tick plan item N` commit when the PR merges to `develop`.

---

## Item 1 — Remove Google Drive integration
**Branch:** `chore/remove-google-drive`
**Depends on:** nothing
- [x] Done

### Current state
`web/src/lib/gdrive.ts` implements Google Drive file upload/download. `dashboard/page.tsx` has ~200 lines of Drive state, handlers (`gdriveSave`, `gdriveLoad`, `gdriveConnect`, `gdriveDisconnect`, `gdriveConfigKey`), and Drive buttons in the header. `web/src/lib/storage.ts` has Drive-related keys (`gdrive_used`, `client_id`). The CoinGecko API key was stored in Drive config — it now lives in AWS SSM and is unused on the frontend.

### Files to delete
- `web/src/lib/gdrive.ts`

### Files to modify
- `web/src/app/dashboard/page.tsx` — remove: all `gdrive*` imports, the `Window.google` declaration, all Drive state variables (`driveToken`, `driveFileId`, `configFileId`, `coingeckoApiKey`, `tokenClient`, `driveConnected`, `driveStatus`), all Drive handlers, the Drive button cluster in the header JSX. Keep: `exportData`, `importData`, the Exportar/Importar JSON buttons.
- `web/src/lib/storage.ts` — remove `getGdriveUsed`, `setGdriveUsed`, `removeGdriveUsed`, `getClientId`, `setClientId`, `removeClientId` and their localStorage keys.
- `web/src/lib/types.ts` (if any Drive-specific types exist) — remove them.
- `shared/src/types.ts` — keep `BackupPayload`; it is still used by `/api/export` and `/api/import`.

### Done when
- No file references `gdrive`, `driveToken`, `tokenClient`, or `window.google` anywhere in `web/`.
- JSON export (downloads a `.json` file) and JSON import (uploads a `.json` file) still work.
- `npm test` passes.

---

## Item 2 — Security audit
**Branch:** `chore/security-audit`
**Depends on:** nothing

- [x] Done

### Current state
No static analysis in CI. CORS config in `backend/app/main.py` is unknown — may allow `*`. Tokens stored in localStorage by Amplify. No dependency vulnerability scanning.

### Tasks

**CORS:**
- Read `backend/app/main.py`. If `CORSMiddleware` allows `allow_origins=["*"]`, change it to read from an env var (`FRONTEND_ORIGIN`, already in SSM) so only the actual CloudFront URL is allowed in prod.

**Static analysis — add to CI (`crypto-assist/.github/workflows/deploy.yml` test step):**
- `pip install bandit pip-audit` in backend test step; run `bandit -r app/ -ll` (flag HIGH and MEDIUM) and `pip-audit`.
- Add `eslint-plugin-security` to `web/package.json` devDependencies; add `"plugin:security/recommended"` to ESLint config; run as part of `npm test`.
- Add `npm audit --audit-level=high` to the web test step.

**Token storage:**
- Amplify stores tokens in localStorage by default. Document the accepted risk in `backend/AGENTS.md` (XSS is the threat; mitigated by CSP and no `eval`/`innerHTML` in the codebase). No code change required unless a CSP header is missing — if so, add it to the CloudFront distribution in `aws-infra/stacks/app-stack.ts`.

**Fix all HIGH findings** from Bandit and ESLint security plugin before merging.

### Done when
- `bandit -r app/ -ll` exits 0 in CI.
- `pip-audit` exits 0 in CI (or known vulnerabilities are documented as accepted).
- `npm audit --audit-level=high` exits 0 in CI.
- CORS origin is not `*` in any environment.
- `eslint-plugin-security` configured and passing.

---

## Item 3 — OWASP Top 10 hardening
**Branch:** `chore/owasp-hardening`
**Depends on:** Item 2

- [x] Done

### Current state
Item 2 addressed A03 (SQL injection via bandit), A05 (CORS), A06 (dependency scanning), and A07 (token storage documentation). The following gaps remain after that audit:

- **A01 Broken Access Control** — no test verifies that user A cannot access user B's resources; cross-user isolation is only enforced by `WHERE user_id = %s` in queries but never exercised in the test suite.
- **A03/A10 Injection/SSRF** — `coin_id` values from stored ops are passed directly into CoinGecko URL paths (`/coins/{coin_id}/...`) in `backend/app/routes/prices.py` without format validation. A crafted ID could redirect the Lambda's outbound HTTP request to an attacker-controlled host.
- **A05 Security Misconfiguration** — CSP header is missing from the CloudFront distribution (documented as a risk in `backend/AGENTS.md` but not implemented).
- **A08 Software and Data Integrity** — GitHub Actions steps reference mutable version tags (`@v7`, `@v5`, `@v6`) instead of pinned commit SHAs. A compromised action tag could inject malicious code into CI.
- **A09 Security Logging** — failed authentication attempts are not logged; only request paths are logged, making auth anomalies invisible in CloudWatch.

A02 (cryptographic failures) is handled by Cognito RS256 + CloudFront TLS.
A04 (insecure design) is addressed by architecture: JWT-gated API, no sensitive operations beyond per-user portfolio data.
A07 (authentication failures) is covered by Cognito (built-in rate limiting, MFA support) plus Item 2 documentation.

### Tasks

**A01 — Cross-user isolation tests:**
- `backend/tests/test_isolation.py` — for each of `GET /api/ops`, `GET /api/exit-prices`, `GET /api/export`: populate mock data scoped to user A's `user_id`; issue the same request with user B's auth context; assert the response body is empty (not user A's data). Also assert that every protected endpoint returns 401 when the `Authorization` header is absent.

**A03/A10 — Input validation on coin_id:**
- `backend/app/routes/prices.py` — validate each entry in the `ids` query param against `^[a-z0-9-]{1,120}$` before constructing the CoinGecko URL. Return HTTP 400 with a clear `detail` message if any ID is malformed.
- `backend/tests/test_prices.py` — add: malformed `coin_id` (e.g. `../evil`, empty string, oversized value) returns 400; valid IDs proceed to normal cache/fetch flow.

**A05 — Content-Security-Policy header:**
- `aws-infra/stacks/app-stack.ts` — add a CloudFront `ResponseHeadersPolicy` with a strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.amazoncognito.com`. Attach the policy to the distribution's default cache behavior.

**A08 — Pin GitHub Actions to commit SHAs:**
- `.github/workflows/deploy.yml` — replace mutable version tags with pinned full-length commit SHAs for `actions/checkout`, `actions/setup-python`, `actions/setup-node`. Add a comment on each line with the human-readable version tag for maintainability.

**A09 — Security event logging:**
- `backend/app/dependencies.py` — in `require_auth`, log a `WARNING` including request path and `User-Agent` when a token is missing or fails validation. Never log the token value itself.
- The `test_isolation.py` 401 tests from A01 cover this logging path indirectly.

### Done when
- `test_isolation.py` passes: user B receives an empty list (not user A's data) for every scoped endpoint.
- `GET /api/prices?ids=../evil` returns 400.
- CloudFront dev distribution serves a `Content-Security-Policy` response header (verified with `curl -I`).
- All `actions/*` steps in `deploy.yml` are pinned to full commit SHAs.
- An unauthenticated request to any protected endpoint produces a `WARNING` log entry.
- `bandit -r app/ -ll`, `pip-audit`, `npm run lint`, `npm audit --audit-level=high` still exit 0.
- `pytest` coverage on changed modules (`app/routes/prices.py`, `app/dependencies.py`) ≥ 90%.

---

## Item 4 — i18n framework
**Branch:** `feat/i18n`
**Depends on:** nothing

- [x] Done

### Goal
Full multi-language support across web and mobile. Every user-facing string goes through the i18n layer. Users select their language from a dedicated Settings page (web) and Settings screen (mobile). The app defaults to `pt-BR` but supports the 10 most spoken languages in the world.

### Current state
All UI strings are hardcoded Portuguese in JSX/React Native components. `shared/src/format.ts` hardcodes `pt-BR` locale and `R$`. `Op.type` stores Portuguese words (`'Compra'`/`'Venda'`) — these must be migrated to English (`'Buy'`/`'Sell'`) in code and in the database, since all code and stored values must be in English (see AGENTS.md).

### Supported locales
`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `zh-CN`, `ja-JP`, `ar-SA`, `hi-IN`, `ru-RU`

### Files to create
- `shared/src/i18n/types.ts` — `Locale` union type and `UIText` interface covering every user-facing string in the app (labels, empty states, error messages, button text, column headers, chart labels, date/number format hints). Derive the initial key list by reading all tab components, dashboard, and mobile screens.
- `shared/src/i18n/locales/pt-BR.ts` — reference implementation. Defines the canonical shape; every other locale file must match it exactly (TypeScript enforces this).
- `shared/src/i18n/locales/en-US.ts`, `es-ES.ts`, `fr-FR.ts`, `de-DE.ts`, `zh-CN.ts`, `ja-JP.ts`, `ar-SA.ts`, `hi-IN.ts`, `ru-RU.ts` — each must satisfy `UIText`. Use accurate translations for financial/investment terminology in each language.
- `shared/src/i18n/index.ts` — export `Locale`, `UIText`, `LOCALES: Record<Locale, UIText>`, `getLocale(code: Locale): UIText`.
- `web/src/pages/settings.tsx` (or equivalent route) — Settings page with a Language selector (dropdown or list of locale options). Language change takes effect immediately without page reload.
- `mobile/src/screens/SettingsScreen.tsx` — Settings screen with a Language row that opens a locale picker.

### Files to modify
- `shared/src/types.ts` — change `Op.type` from `'Compra' | 'Venda'` to `'Buy' | 'Sell'`. Update `NewOp` accordingly.
- `shared/src/format.ts` — `fmt(v: number, locale?: Locale, currency?: string): string`. Default `locale='pt-BR'`, default `currency='BRL'`. Keep `fmt(v)` working with one argument (backwards-compatible). Update `fmtDate` and `fmtQty` similarly.
- `shared/src/index.ts` — export all new i18n symbols.
- `backend/app/models.py` — update `Op.type` enum/validation to accept `'Buy' | 'Sell'`.
- `backend/db/schema.sql` — update `ops.type` CHECK constraint to `'Buy'`, `'Sell'`.
- `backend/db/migrations/` — add migration to `UPDATE ops SET type = 'Buy' WHERE type = 'Compra'` and `'Sell'` for `'Venda'`. **Pause for user approval before running this migration.**
- `web/src/` — add `LocaleContext.tsx` (React context + `useLocale()` hook). Reads preference from localStorage, defaults to `'pt-BR'`. Wrap `<App>` in it. Add Settings route to the router.
- `web/src/components/` — replace every hardcoded string in `WalletTab.tsx`, `ProfitTab.tsx`, `HistoryTab.tsx` with `t.xxx` from `useLocale()`.
- `web/src/app/dashboard/page.tsx` — replace hardcoded strings; add a Settings link/icon in the header.
- `mobile/src/` — add `LocaleContext` (saves to AsyncStorage, defaults to `'pt-BR'`). Replace hardcoded strings in all screens. Add Settings screen to the navigator.

### Done when
- TypeScript errors if any locale file is missing a key defined in `UIText`.
- Settings page (web) and Settings screen (mobile) exist with a working language selector.
- Switching language changes all UI labels immediately without reload.
- `Op.type` is `'Buy'`/`'Sell'` in all code, models, and the database.
- `npm test` passes. `pytest` passes.

---

## Item 5 — Settings page refactor
**Branch:** `feat/settings-refactor`
**Depends on:** item 4

- [x] Done

### Goal
Replace the minimal Settings page (web) and Settings screen (mobile) created in Item 4 with fully designed, production-quality UIs. Web uses a sectioned-cards layout (Stripe/Notion style). Mobile uses a grouped-list layout (iOS/Coinbase/Revolut style). Import/Export move from the dashboard header to the Settings "Dados" card. Theme selection, balance visibility, and wallet clearing are implemented as working features.

### Current state
`web/src/pages/settings.tsx` has only a language selector. `mobile/src/screens/SettingsScreen.tsx` has only a language row. Export/Import buttons live in `web/src/app/dashboard/page.tsx` header. No theme override (app always follows system preference). No hide-balances feature. No clear-wallet action.

### New backend endpoint
- `DELETE /api/ops` — deletes all ops for the authenticated user. Returns `{"deleted": N}`. Requires auth. Covered by a test asserting the count returns to zero.

### Web — `web/src/pages/settings.tsx`
Redesign as sectioned cards using the existing `.card` / `.card-head` / `.card-body` / `.row` CSS patterns (add any missing classes to `globals.css`). Four cards:

1. **Aparência e idioma** — Language selector (existing `useLocale()` hook). Theme segmented control: Claro / Escuro / Sistema. Stores preference in localStorage as `theme`; applies by toggling a `data-theme` attribute on `<html>` so CSS variables switch without page reload.
2. **Moeda e preços** — Currency selector placeholder (disabled, labelled "disponível em breve" — wired in Item 6). Price refresh interval placeholder (disabled — wired in Item 7). Hide balances toggle: stores boolean in localStorage as `hide_balances`; a React context `BalanceContext` exposes `hidden: boolean`; all `fmt()` call sites in dashboard wrap their output with `hidden ? '••••••' : value`.
3. **Dados** — Export button (moves from dashboard header). Import file-input label (moves from dashboard header). Both call the same handlers already in `dashboard/page.tsx`; extract them to `web/src/lib/dataHandlers.ts` and import in both places.
4. **Zona de perigo** — "Limpar carteira" button triggers a confirmation dialog (native `window.confirm`), then calls `DELETE /api/ops`, then clears local prices state and shows a toast.

### Mobile — `mobile/src/screens/SettingsScreen.tsx`
Redesign as grouped list. Three groups:

1. **Preferências** — Language row (opens existing locale picker). Currency row placeholder (disabled). Price refresh row placeholder (disabled).
2. **Aparência e privacidade** — Theme row (opens an action sheet: Claro / Escuro / Sistema; stores in AsyncStorage as `theme`). Hide balances toggle (stores in AsyncStorage as `hide_balances`; `BalanceContext` wraps the navigator).
3. **Dados e conta** — Export row. Import row. "Limpar carteira" row (danger, red text; confirmation alert before calling `DELETE /api/ops`).

### Files to create
- `web/src/lib/dataHandlers.ts` — `exportData()` and `importData(file)` extracted from `dashboard/page.tsx`.
- `web/src/contexts/BalanceContext.tsx` — `hidden` boolean + `setHidden`. Reads/writes localStorage `hide_balances`. Wraps `<App>`.
- `mobile/src/contexts/BalanceContext.tsx` — same, but reads/writes AsyncStorage.
- `backend/app/routes/ops.py` — add `DELETE ""` handler (deletes all ops for user).
- `backend/tests/test_ops.py` — add test: DELETE clears all ops, returns correct count, auth required.

### Files to modify
- `web/src/pages/settings.tsx` — full redesign as described.
- `web/src/app/dashboard/page.tsx` — remove Export/Import buttons from header; import handlers from `dataHandlers.ts`; wrap fmt() outputs with BalanceContext.
- `web/src/app/globals.css` — add `.card`, `.card-head`, `.card-body` classes if not already present.
- `mobile/src/screens/SettingsScreen.tsx` — full redesign as described.
- `mobile/src/app/` (navigator root) — wrap with `BalanceContext`.

### Done when
- Settings page (web) has four sectioned cards with the described content.
- Settings screen (mobile) has three grouped lists with the described content.
- Theme toggle changes the app appearance immediately without reload (web) or remount (mobile).
- Hide-balances toggle masks all monetary values across the app.
- Import/Export no longer appear in the dashboard header.
- `DELETE /api/ops` clears the wallet and the UI reflects zero positions.
- `npm test` passes. `pytest` passes.

---

## Item 6 — Collapsible sidebar navigation
**Branch:** `feat/sidebar-collapsible`
**Depends on:** item 5

- [x] Done

### Goal
Replace the current top-bar navigation (email + Settings link + Logout) with a persistent collapsible sidebar. The three main views (Wallet, Profit, History) become real routes with their own URLs. The sidebar collapses to a 66px icon-only rail with CSS tooltips; expanded state persists across page loads. Settings and Logout move into the sidebar footer.

### Design reference
`docs/design/dashboard-collapsible-sidebar.html` — open in a browser for the visual source of truth.
`docs/design/dashboard-refactor-notes.md` — CSS tokens, layout rules, and component specifications.

### Current state
`web/src/router.tsx` defines a single `/dashboard` route rendered by `DashboardLayout`, which contains a top bar (email, Settings link, LogoutButton) and `<DashboardPage>` with in-page tab switching (Wallet / Profit / History via `useState`). `web/src/app/dashboard/page.tsx` owns all three tab views.

### Files to create
- `web/src/components/Sidebar.tsx` — collapsible sidebar component. Props: `collapsed: boolean`, `onToggle: () => void`. Uses TanStack Router `<Link>` with `activeProps` for the active-route highlight. Reads `email` from the existing `getEmailFromIdToken` utility. Footer contains Settings link, Logout button (move `LogoutButton` here), user chip.
- `web/src/components/AppLayout.tsx` — app shell component rendered as the root layout for authenticated routes. Owns `collapsed` state (read/write `localStorage('sidebar:collapsed')`). Renders `<Sidebar>` + `<main><Outlet /></main>` in a two-column CSS grid.

### Files to modify
- `web/src/router.tsx` — add `/wallet`, `/profit`, `/history` routes as children of a new `appLayoutRoute` (uses `AppLayout` as component). Remove `DashboardLayout` (the inline function with the old top bar). Change the `/` redirect from `/dashboard` to `/wallet`. Keep `/auth`, `/auth/callback`, and `/settings` routes unchanged (Settings gets its own sidebar-wrapped layout).
- `web/src/app/globals.css` — add sidebar/layout CSS: `.layout`, `.layout.collapsed`, `.sb`, `.sb-top`, `.sb-foot`, `.navi`, `.navi.active`, `.navlbl`, `.userchip`, collapsed-state rules, and CSS tooltip via `[data-tip]::after`. Design tokens (`--surface`, `--surface-hover`, `--border`, `--border-soft`, `--text-muted`, `--text-dim`, `--accent`) should align with the tokens already established by the settings page.
- `web/src/app/dashboard/page.tsx` — the tab-switching shell is no longer needed; keep only the data-fetching logic and the three view components. The view components will be extracted in items 7–9 respectively.
- `shared/src/i18n/types.ts` — add `nav_wallet`, `nav_profit`, `nav_history`, `nav_logout` keys (sidebar labels). Add to all locale files.

### Done when
- `/wallet`, `/profit`, `/history` are real routes that render the existing WalletTab, ProfitTab, HistoryTab content respectively (the views themselves are not redesigned in this item — that is items 7–9).
- The sidebar is visible on all three routes, collapses to 66px with tooltips, and restores state from localStorage on reload.
- The old top bar (email + Settings link + Logout floating row) is gone.
- Settings link in the sidebar navigates to `/settings`.
- `npm test` passes (update any tests that referenced the old `/dashboard` route or `DashboardLayout`).

---

## Item 7 — Wallet view redesign
**Branch:** `feat/wallet-view-refactor`
**Depends on:** item 6

- [x] Done

### Goal
Redesign the Wallet view (`/wallet`) to match the prototype: a content header with title, subtitle, and a refresh button; four metric cards (Invested, Current value, P/L, Return); a segmented view toggle (By asset / By platform / Asset + platform); and an improved holdings table with coin image, name, ticker, and tabular-nums alignment. Reuse the sidebar shell from item 6.

### Design reference
See `docs/design/dashboard-collapsible-sidebar.html` → "Carteira" view.

### Current state
`web/src/components/WalletTab.tsx` renders the wallet content inside the old tab-switching dashboard. It has the segmented toggle and table but no metric cards and no content header. It is passed `prices`, `ops`, `exitPrices`, and handlers as props from `DashboardPage`.

### Files to create
- `web/src/components/MetricCard.tsx` — reusable card: `label`, `value`, `valueColor?`, `sub?`, `subColor?` props. Used by Wallet, Profit, and any future view.
- `web/src/components/ContentHeader.tsx` — reusable page header: `title`, `subtitle`, `children` (right-side actions slot).

### Files to modify
- `web/src/components/WalletTab.tsx` — add `<ContentHeader>` with title from `t.nav_wallet` and the refresh button + last-updated timestamp. Add a `<div className="metrics">` grid with four `<MetricCard>` components driven by `computePositions` output (invested, current value, P/L, return). Keep the existing segmented toggle and table logic; update table CSS classes to match the design tokens (`.tbl.scroll`, `.asset`, `.coin`, `.pill.up/.down`).
- `web/src/app/globals.css` — add shared view primitives: `.chead`, `.metrics`, `.mcard`, `.pill.up/.down`, `.tbl`, `.asset`, `.coin`, `.iconbtn`, `.btn`, `.btn-accent`, `.seg`. Consolidate with any existing rule definitions.

### Done when
- The Wallet route (`/wallet`) shows the content header, four metric cards, segmented toggle, and holdings table matching the prototype.
- Coin images load from CoinGecko (already stored in price cache) and fall back to the colored initials badge when absent.
- Metric cards show correct computed values from `computePositions`.
- `npm test` passes; `WalletTab.test.tsx` updated for the new structure.

---

## Item 8 — Profit view redesign
**Branch:** `feat/profit-view-refactor`
**Depends on:** item 6

- [ ] Done

### Goal
Redesign the Profit view (`/profit`) to match the prototype: content header; four metric cards (Realized P/L, Unrealized P/L, Best asset, Worst asset); a chart-mode segmented control (By asset / Over time / Portfolio value); a divergent bar chart for P/L by asset; and horizontal allocation bars. Also strip the icons from the segmented-control options in both the Profit view and the Wallet view, leaving text-only labels. A follow-up color-and-contrast QA pass (see `dashboard-color-contrast-pass.md`) is folded into this same item/branch: restore the metric-card label icons dropped by the `MetricCard` swap, add a chart panel title, and fix several components that rendered directly on the page background instead of the `--s-surface` card tokens (chart panel, distribution panel, segmented-control container, metric cards, table), so cards/panels/sidebar visually lift off the canvas.

### Design reference
See `docs/design/dashboard-collapsible-sidebar.html` → "Lucro" view. See `dashboard-color-contrast-pass.md` for the color/contrast fix notes.

### Current state (as implemented)
`web/src/components/ProfitTab.tsx` now renders a `<ContentHeader>`, four `<MetricCard>`s (each with a label icon), a text-only chart-mode segmented control, an uppercase panel title above the chart canvas, a Chart.js divergent bar chart, and an allocation panel — all driven by a new `computeProfitByAsset` function in `shared/src/portfolio.ts` (average-cost method, splits realized P/L from closed lots vs. unrealized P/L from open lots; Best/Worst asset ranks only open, priced positions by unrealized % return). No Recharts dependency was added — Chart.js was already used for all three chart modes. `web/src/components/WalletTab.tsx`'s grouping segmented control is also text-only now. `web/src/app/globals.css` gained a `--s-border` token (solid `#27272a`/light equivalent, distinct from the pre-existing translucent `--border`) and the dark-mode `--bg` moved from `#1a1a1a` to `#0a0a0b` so `--s-surface` cards/sidebar/panels visually lift off the canvas; `.metric`, `.tbl`, `.chart-area`, `.dist-section`, `.chart-switcher` were switched from `--bg`/`--border` to `--s-surface`/`--s-border`.

### Files modified
- `shared/src/portfolio.ts` — added `computeProfitByAsset` (+ `AssetProfit` type), tested in `web/src/lib/portfolio.test.ts`.
- `shared/src/i18n/types.ts` and all 10 `shared/src/i18n/locales/*.ts` — added `profit_subtitle`.
- `web/src/components/ProfitTab.tsx`, `ProfitTab.test.tsx` — full redesign described above.
- `web/src/components/WalletTab.tsx`, `WalletTab.test.tsx` — icon removal from the grouping control.
- `web/src/components/MetricCard.tsx` — added an optional `icon` prop.
- `web/src/router.tsx` — threads `statusMsg`/`onFetchPrices` into `ProfitTab`.
- `web/src/app/globals.css` — `--s-border` token, dark `--bg` value, surface/border fixes on `.metric`, `.tbl`, `.chart-area`, `.dist-section`, `.chart-switcher`, `.chart-btn.active`.
- HistoryTab's legacy `--bg`-based classes (`.op-card`, `.trade-card`, `.op-list-wrap`, `.table-wrap`) were deliberately left untouched — out of scope until item 9 redesigns that view.

### Done when
- The Profit route (`/profit`) shows four metric cards, chart-mode selector, divergent bar chart, allocation bars, and a chart panel title.
- Best asset and worst asset cards show the correct ticker and percentage, ranked from open positions only.
- Realized P/L metric is driven by closed positions; unrealized by open positions (using `computeProfitByAsset`).
- Neither the Profit view's nor the Wallet view's segmented-control options render an icon — text labels only; metric cards do retain their label icons.
- Cards, panels, table, and segmented controls render on `--s-surface` with a visible `--s-border`, distinguishable from the page background.
- `npm test` passes; `ProfitTab.test.tsx` and `WalletTab.test.tsx` updated.

---

## Item 9 — History view redesign with entry drawer
**Branch:** `feat/history-view-refactor`
**Depends on:** item 6

- [ ] Done

### Goal
Redesign the History view (`/history`) to match the prototype: a content header with a primary "+ Register operation" button; a full-width operations table; and a right-side slide-over drawer that replaces the two always-visible forms. The drawer has three modes: Buy, Sell, Trade. Buy/Sell show a single-asset fieldset; Trade shows a two-block swap form (sell block + receive block). Focus trap, Escape-to-close, and body-scroll lock are required.

### Design reference
See `docs/design/dashboard-collapsible-sidebar.html` → "Histórico" view and drawer.

### Current state
`web/src/components/HistoryTab.tsx` has two always-visible forms (one for Buy/Sell, one for Trade) above the operations table. There is no drawer. The table and form logic are tightly coupled in one component.

### Files to create
- `web/src/components/OpDrawer.tsx` — slide-over drawer component. Props: `open: boolean`, `onClose: () => void`, `onSubmit: (op: NewOp | [NewOp, NewOp]) => void`, `editingOp?: Op`, `coins: CoinSearchResult[]`. State: `opType: 'buy' | 'sell' | 'trade'`. Renders the segmented type selector, the appropriate fieldset (simple or trade), and the footer buttons. Implements focus trap (move focus to first input on open; trap Tab/Shift+Tab within drawer; restore focus on close) and body-scroll lock (`document.body.style.overflow`). Closes on Escape and backdrop click. Uses `role="dialog" aria-modal="true" aria-labelledby`.
- `web/src/components/OpDrawer.test.tsx` — tests: drawer opens/closes, type switching swaps fieldsets, submitting a Buy creates one op, submitting a Trade creates two ops, Escape closes, backdrop click closes.

### Files to modify
- `web/src/components/HistoryTab.tsx` — remove the two always-visible form sections. Add `<ContentHeader>` with the "+ Register operation" button (`.btn-accent`). Replace forms with `<OpDrawer>`. Keep the operations table; update CSS classes to match design tokens.
- `web/src/app/globals.css` — add `.drawer`, `.drawer-backdrop`, `.drawer-head`, `.drawer-body`, `.drawer-foot`, `.drawer-grid`, `.drawer.open`, `.drawer-backdrop.open`, `.trade-block`, `.trade-block.out`, `.trade-block.in`, `.trade-arrow`, `.fhint`, `.tag` if not already present.

### Done when
- The History route (`/history`) shows the content header, operations table, and no always-visible forms.
- The "+ Register operation" button opens the drawer; clicking the backdrop, pressing Escape, or clicking Cancel closes it.
- Switching to "Trade" mode shows the two-block swap form instead of the simple fieldset.
- Submitting a Buy or Sell creates one op; submitting a Trade creates two ops (one sell, one buy).
- Edit: clicking the edit icon on a table row opens the drawer pre-filled with that op's data.
- Focus management works correctly (focus moves to drawer on open, traps inside, returns to trigger on close).
- `npm test` passes; `HistoryTab.test.tsx` and `OpDrawer.test.tsx` pass.

---

## Item 10 — Multi-currency display
**Branch:** `feat/multi-currency`
**Depends on:** items 4, 5

- [ ] Done

### Current state
`price_cache` table has `price_brl`. CoinGecko is called with `vs_currency=brl`. `fmt()` always formats as R$. The entire stack assumes BRL.

### Approach
Store prices in USD (universal crypto reference). Fetch an exchange rate once per session and convert at render time. Avoids a schema explosion.

### Database migrations
1. `ALTER TABLE price_cache RENAME COLUMN price_brl TO price_usd;`
2. New table: `exchange_rates (currency_code VARCHAR(8) PRIMARY KEY, rate_vs_usd NUMERIC(18,8) NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`.

### Files to create
- `backend/app/routes/exchange_rates.py` — GET `/api/exchange-rates`. Returns `Record<string, number>` (currency code → rate vs USD). Fetches from CoinGecko `/simple/price?ids=usd&vs_currencies=brl,eur,gbp,jpy,cny` or exchangerate-api.com free endpoint. Caches in `exchange_rates` table for 1 hour.

### Files to modify
- `backend/app/routes/prices.py` — change CoinGecko call to `vs_currency=usd`; update all references from `price_brl` to `price_usd`.
- `shared/src/types.ts` — add `Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY'`. Add optional `currency?: Currency` to `NewOp` (defaults to `'BRL'` for existing ops). Add `Op.currency`.
- `backend/app/models.py` — add `currency: str = 'BRL'` to Op model.
- `backend/db/schema.sql` — add `currency VARCHAR(8) DEFAULT 'BRL'` to `ops` table.
- `shared/src/format.ts` — `fmt(v, locale, currency)` uses `Intl.NumberFormat` with `style: 'currency'` and the correct currency code. Existing call sites `fmt(v)` continue to work (default BRL/pt-BR).
- `web/src/pages/settings.tsx` — wire the currency selector in the "Moeda e preços" card (was placeholder in Item 5); reads/writes `CurrencyContext`.
- `web/src/` — add `CurrencyContext.tsx` (saves preference to localStorage). All `fmt()` calls receive `currency` from context.
- `web/src/lib/api/client.ts` — `getPrices(ids)` stays the same; add `getExchangeRates(): Promise<Record<string, number>>` call.
- `mobile/src/screens/SettingsScreen.tsx` — wire the currency row (was placeholder in Item 5).

### Done when
- Switching currency in Settings changes all displayed values immediately (no reload).
- New ops record their currency.
- `price_cache` stores USD prices. Exchange rates are cached in DB.
- `pytest` and `npm test` pass.

---

## Item 11 — Auto-refresh prices
**Branch:** `feat/price-auto-refresh`
**Depends on:** item 10

- [ ] Done

### Goal
Users can configure how often prices refresh automatically. The interval is stored per-device and survives page reload. The currently selected interval is shown in the Settings page/screen "Moeda e preços" card (wired, replacing the placeholder left in Item 5).

### Supported intervals
Manual (default), 30 s, 1 min, 5 min.

### Web
- `web/src/contexts/PriceRefreshContext.tsx` — stores `interval: number | null` (null = manual) in localStorage as `price_refresh_interval`. Exposes `interval` and `setInterval`. At the top of the component tree, a `useEffect` sets up `setInterval(() => fetchPrices(), interval)` when `interval` is non-null and clears it on unmount or change.
- `web/src/pages/settings.tsx` — wire the "Atualizar preços" selector in the "Moeda e preços" card (was placeholder in Item 5).

### Mobile
- `mobile/src/contexts/PriceRefreshContext.tsx` — same pattern, reads/writes AsyncStorage. The navigator root sets up the refresh effect.
- `mobile/src/screens/SettingsScreen.tsx` — wire the price refresh row (was placeholder in Item 5).

### Done when
- Selecting "A cada 30s" causes the prices API to be called every 30 seconds without user interaction.
- Selecting "Manual" stops auto-refresh.
- The interval persists across page reloads (web) and app restarts (mobile).
- `npm test` passes (mock timers verify the interval effect fires).

---

## Item 12 — Fix historical charts
**Branch:** `feat/historical-prices`
**Depends on:** item 10 (prices now stored in USD; historical prices should also be USD)

- [ ] Done

### Current state
`computeTimeline(ops, prices)` in `shared/src/portfolio.ts` walks operations in date order but applies **current** prices to every point. The "Lucro no tempo" and "Valor da carteira" charts show what past portfolio compositions are worth **today**, not what they were worth at the time of each operation.

### Database migration
New table: `price_history (coin_id VARCHAR(120), date DATE, price_usd NUMERIC(24,8), PRIMARY KEY (coin_id, date))`.

### Files to create
- `backend/app/routes/price_history.py` — GET `/api/prices/history?ids=bitcoin,ethereum&from=2024-01-01&to=2024-12-31`. For each coin, checks `price_history` for the date range; fetches missing dates from CoinGecko `/coins/{id}/market_chart?vs_currency=usd&days=N&interval=daily`; stores results; returns `Record<coinId, Record<date, number>>` (date in `YYYY-MM-DD` format).

### Files to modify
- `shared/src/portfolio.ts` — change `computeTimeline` signature to `computeTimeline(ops: Op[], historicalPrices: Record<string, Record<string, number>>): TimelinePoint[]`. For each op date, look up `historicalPrices[coinId][date]`; if missing, use the nearest available date (linear scan backwards up to 7 days, then fallback to 0).
- `web/src/components/ProfitTab.tsx` — before rendering `over-time` or `value` charts, call `api.getPriceHistory(coinIds, fromDate, toDate)`; show a loading spinner while fetching. Pass `historicalPrices` to `computeTimeline` instead of current `prices`.
- `web/src/lib/api/client.ts` — add `getPriceHistory(ids: string[], from: string, to: string)`.

### Done when
- "Lucro no tempo" chart shows the P&L as it was on each operation date, not today's prices.
- "Valor da carteira" chart shows invested vs portfolio value using prices from each operation's date.
- `pytest` covers the new endpoint (cache hit, cache miss, partial miss).

---

## Item 13 — Price provider abstraction + move coin search to backend
**Branch:** `feat/price-provider-abstraction`
**Depends on:** item 10 (USD prices established)

- [ ] Done

### Current state
`web/src/lib/coingecko.ts` calls CoinGecko directly from the browser for coin search (exposes API key to the client). `backend/app/routes/prices.py` calls CoinGecko directly with hardcoded logic. No interface exists to swap providers.

### Files to create
- `backend/app/price_provider.py` — abstract base class `PriceProvider` with methods `search_coins(query: str) -> list[dict]`, `get_prices(ids: list[str]) -> list[dict]`, `get_history(coin_id: str, from_ts: int, to_ts: int) -> list[dict]`. Factory function `get_provider() -> PriceProvider` reads `settings.price_provider`.
- `backend/app/providers/coingecko.py` — `CoinGeckoProvider(PriceProvider)` extracts existing logic from `prices.py` and `price_history.py`.
- `backend/app/providers/cryptocompare.py` — `CryptoCompareProvider(PriceProvider)` stub implementing `search_coins` and `get_prices` via CryptoCompare API. History can be left as `raise NotImplementedError` initially.
- `backend/app/routes/coins.py` — GET `/api/coins/search?q=bitcoin&limit=7`. Calls `get_provider().search_coins(q)`. Returns same shape as current CoinGecko search response.

### Files to modify
- `backend/app/routes/prices.py` — use `get_provider().get_prices(ids)` instead of direct httpx.
- `backend/app/routes/price_history.py` — use `get_provider().get_history(...)`.
- `backend/app/config.py` — add `price_provider: str = 'coingecko'`.
- `web/src/lib/coingecko.ts` — delete `searchCoins` and `fetchSinglePrice` (they move to the backend). Keep `cgKey` only if still needed anywhere; otherwise delete the file.
- `web/src/components/HistoryTab.tsx` — `CoinSearch` component calls `api.searchCoins(query)` instead of `searchCoins(query, apiKey)`. Remove `apiKey` prop from `HistoryTab`.
- `web/src/lib/api/client.ts` — add `searchCoins(query: string): Promise<CoinSearchResult[]>`.
- `web/src/app/dashboard/page.tsx` — remove `apiKey={coingeckoApiKey}` prop from `<HistoryTab>`.

### Done when
- Browser DevTools shows no direct requests to `api.coingecko.com`.
- Swapping `PRICE_PROVIDER=cryptocompare` in env changes the provider without code changes.
- `pytest` covers `test_coins.py` (search returns results, empty query returns 400).

---

## Item 14 — Test coverage
**Branch:** `test/coverage`
**Depends on:** items 10, 12, 13 (so tests cover the final endpoint shapes)

- [ ] Done

### Current state
`backend/tests/`: `test_health.py` (1 test), `test_ops.py` (partial CRUD). Missing: exit_prices, prices, export, import, coins, price_history routes. `web/src/`: three component test files exist but cover mainly render; no form submission or error-path tests.

### Files to create
- `backend/tests/test_exit_prices.py` — GET (empty, with entries), PUT (set, update, delete by setting 0), auth required (401 without token).
- `backend/tests/test_prices.py` — cache hit (no CoinGecko call), cache miss (CoinGecko called, result cached), rate limit handling (mock 429 → falls back to stale cache), unknown coin (returns empty result not 404).
- `backend/tests/test_export.py` — shape matches `BackupPayload`, empty ops returns valid payload.
- `backend/tests/test_import.py` — valid payload creates ops, malformed payload returns 400, duplicate import does not create duplicates (idempotent).
- `backend/tests/test_coins.py` — search returns results, empty query returns 400.
- `backend/tests/test_price_history.py` — cache hit, cache miss (provider called), partial miss (some dates cached).

### Files to modify
- `web/src/components/HistoryTab.test.tsx` — add: form submission creates op, edit pre-fills form, delete removes row, trade form creates two ops.
- `web/src/components/ProfitTab.test.tsx` — add: chart switches, empty state when no prices.
- `web/src/components/WalletTab.test.tsx` — add: exit price change, platform grouping.
- `web/src/lib/portfolio.test.ts` — add: `computeTimeline` with historical prices, sells reducing position to zero, same-date multiple ops, empty ops.

### Done when
- `pytest --cov=app --cov-report=term-missing` shows ≥80% on every route file.
- `npm test` passes with no skipped tests.

---

## Item 15 — Facebook login
**Branch:** `feat/facebook-login`
**Depends on:** nothing

- [ ] Done

### Current state
Google is the only social IdP. Facebook OAuth credentials are not in SSM. Pattern to follow is identical to Google (`aws-infra/stacks/app-stack.ts` lines 41-65).

### One-time manual steps (do before coding, document in commit message)
1. Create a Facebook App at developers.facebook.com with "Facebook Login for Business" product.
2. Store credentials: `aws ssm put-parameter --name /crypto-assist/dev/FacebookClientId --value <id> --type SecureString` and same for `FacebookClientSecret`. Repeat for prod.
3. Add Cognito callback URI to Facebook App: `https://{cognito-domain}.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`.

### Files to modify
- `aws-infra/stacks/app-stack.ts` — add `facebookEnabled?: boolean` to `AppConfig.cognito`. Below the Google IdP block, add an identical block for Facebook using `FacebookClientId` / `FacebookClientSecret` from SSM. Add `facebookIdP?.providerName` to the `providers` array.
- `aws-infra/apps/crypto-assist/dev.yaml` — add `facebookEnabled: true` after credentials are in SSM.
- `aws-infra/apps/crypto-assist/prod.yaml` — same.
- `aws-infra/AGENTS.md` — add Facebook to the "Google OAuth per-stage setup" section; document SSM param names and Facebook Developer Console redirect URI requirement.

### Done when
- "Continuar com Facebook" button appears on the Cognito Hosted UI for dev and prod.
- End-to-end login with a Facebook account works.
- Pipeline deploys cleanly.

---

## Item 16 — Custom auth UI
**Branch:** `feat/custom-auth-ui`
**Depends on:** item 15 (all social providers ready before redesigning the screen)

- [ ] Done

### Current state
`web/src/app/auth/AuthClient.tsx` handles the post-OAuth callback. The actual login screen is Cognito Hosted UI (a redirect to `crypto-assist[-dev].auth.us-east-1.amazoncognito.com`). Amplify's `signInWithRedirect()` triggers the redirect. Signup is also on Hosted UI.

### Approach
Build custom `/login` and `/signup` routes. Email/password flows use Amplify's `signIn`, `signUp`, `confirmSignUp` directly (no redirect). Social buttons (`signInWithRedirect({ provider: 'Google' })` etc.) still redirect to Cognito Hosted UI for the OAuth handshake — but the entry point is our branded page.

### Files to create
- `web/src/routes/login.tsx` — TanStack Router route. Email + password form. "Entrar com Google" and "Entrar com Facebook" buttons. "Não tem conta? Cadastre-se" link to `/signup`. Uses `useLocale()` for all strings.
- `web/src/routes/signup.tsx` — Email + password + confirm password form. On submit calls Amplify `signUp`. On success shows email verification step (code input + `confirmSignUp`). "Já tem conta? Entrar" link.
- `web/src/components/AuthForm.tsx` — shared card/form wrapper component used by both routes (consistent styling).

### Files to modify
- `web/src/lib/auth.ts` — expose `signUp(email, password)`, `confirmSignUp(email, code)`, `resendConfirmationCode(email)` in addition to existing exports.
- `web/src/router.tsx` — add `/login` and `/signup` routes. Change the auth guard redirect from the Cognito Hosted UI URL to `/login`.

### Done when
- Email/password signup with email verification works end-to-end.
- Email/password login works.
- Google and Facebook social buttons are on the custom page and work.
- Cognito Hosted UI URL is never shown directly to a user.
- UI matches the app's existing dark theme and component style.

---

## Item 17 — Ops/trade UX study
**Branch:** `docs/ops-ux-study`
**Depends on:** nothing (research only)

- [ ] Done

### Output
`docs/ops-ux-proposal.md` containing:
1. **Current pain points** — analysis of `HistoryTab.tsx` UX: field ordering, price mode toggle discoverability, trade form complexity, missing validation feedback.
2. **Proposed ops form redesign** — at minimum two alternatives described (e.g. step-by-step wizard vs. adaptive single card), with ASCII wireframes or detailed descriptions.
3. **Proposed trade form redesign** — same.
4. **Import options** — ranked list of import sources with implementation complexity:
   - Generic CSV with column mapping
   - Per-exchange CSV parsers (Binance, Coinbase, Mercado Bitcoin — check their export formats)
   - Exchange read-only API integration
   - B3 nota de corretagem (PDF/XML parsing)

No component code changes in this branch. Implementation follows after proposal is reviewed.

### Done when
- `docs/ops-ux-proposal.md` committed to `develop`.

---

## Item 18 — New investment types (Phase 1: Brazilian stocks)
**Branch:** `feat/br-stocks`
**Depends on:** items 4, 10, 13 (i18n, USD prices, provider abstraction)

- [ ] Done

### Current state
`Op.type` is `'Compra' | 'Venda'`. `Op.coinId` references CoinGecko IDs. The entire data model assumes crypto. No other asset class is supported.

### Files to modify

**Shared:**
- `shared/src/types.ts` — add `AssetType = 'crypto' | 'br-stock'`. Add `assetType: AssetType` to `NewOp` (default `'crypto'`). Add to `Asset`.

**Backend:**
- `backend/db/schema.sql` — add `asset_type VARCHAR(20) NOT NULL DEFAULT 'crypto'` to `ops` table.
- `backend/app/models.py` — add `asset_type: str = 'crypto'` to Op models.
- `backend/app/providers/brapi.py` — `BrapiProvider` implementing `search_coins(query)` and `get_prices(ids)` using `brapi.dev/api/v2/quote/{ticker}` and `brapi.dev/api/v2/asset/search?search={query}`. No history in Phase 1.
- `backend/app/price_provider.py` — `get_provider(asset_type: str)` returns `BrapiProvider()` when `asset_type == 'br-stock'`, else the configured crypto provider.
- `backend/app/routes/prices.py` — accept optional `asset_type` query param; route to correct provider.
- `backend/app/routes/coins.py` — accept optional `type` query param (`crypto` or `br-stock`); route search to correct provider.

**Web:**
- `web/src/components/HistoryTab.tsx` — add an asset type toggle (Cripto / Ações BR) above the coin search. When "Ações BR" is selected, `CoinSearch` calls `/api/coins/search?q=...&type=br-stock`, and the new op is created with `assetType: 'br-stock'`. Trade form is disabled for non-crypto (stocks don't trade between each other in this model).

### Done when
- User can register a buy/sell for PETR4, VALE3, etc.
- Wallet tab shows correct current price from brapi.dev for BR stock positions.
- Crypto and stock positions coexist in the portfolio without conflict.
- `pytest` covers brapi provider (mock HTTP) and mixed asset_type price fetching.

---

## Item 19 — Feature roadmap document
**Branch:** `docs/feature-roadmap`
**Depends on:** nothing

- [ ] Done

### Output
`docs/roadmap.md` with a scored/ranked table of future features not in this plan:
- IR (imposto de renda) tax report — auto-generate monthly DARF for crypto gains above R$35k
- Price alerts — user sets target price; Lambda + EventBridge sends push notification
- Portfolio benchmarking — compare return vs IBOV, CDI, Bitcoin
- Dividend tracking — for FIIs and stocks, income separate from capital gains
- Portfolio sharing — read-only public link
- Dark/light theme toggle
- AI assistant — natural language queries over the user's ops data

Each entry: description, estimated effort (S/M/L/XL), estimated user value (low/medium/high), and any hard dependencies on current plan items.

### Done when
- `docs/roadmap.md` committed to `develop`.

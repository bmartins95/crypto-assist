# Crypto Assist — Implementation Plan

Items are ordered by priority and dependency. Do not start an item until its dependencies are merged.
Check the box in a `chore: tick plan item N` commit when the PR merges to `develop`.

Done/won't-do items are condensed to a one-line pointer here — full spec text, design references, and "Corrections learned during implementation" notes for each live in [`docs/PLAN_ARCHIVE.md`](PLAN_ARCHIVE.md). Only active/not-started items keep their full detail in this file.

---

## Item 1 — Remove Google Drive integration

**Branch:** `chore/remove-google-drive` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-1--remove-google-drive-integration)

---

## Item 2 — Security audit

**Branch:** `chore/security-audit` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-2--security-audit)

---

## Item 3 — OWASP Top 10 hardening

**Branch:** `chore/owasp-hardening` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-3--owasp-top-10-hardening)

---

## Item 4 — i18n framework

**Branch:** `feat/i18n` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-4--i18n-framework)

---

## Item 5 — Settings page refactor

**Branch:** `feat/settings-refactor` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-5--settings-page-refactor)

---

## Item 6 — Collapsible sidebar navigation

**Branch:** `feat/sidebar-collapsible` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-6--collapsible-sidebar-navigation)

---

## Item 7 — Wallet view redesign

**Branch:** `feat/wallet-view-refactor` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-7--wallet-view-redesign)

---

## Item 8 — Profit view redesign

**Branch:** `feat/profit-view-refactor` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-8--profit-view-redesign)

---

## Item 9 — History view redesign with entry drawer

**Branch:** `feat/history-view-refactor` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-9--history-view-redesign-with-entry-drawer)

---

## Item 10 — Multi-currency display

**Branch:** `feat/multi-currency` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-10--multi-currency-display)

---

## Item 11 — Auto-refresh prices

**Branch:** `feat/price-auto-refresh` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-11--auto-refresh-prices)

---

## Item 12 — Fix historical charts + timeframe selector

**Branch:** `feat/historical-prices` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-12--fix-historical-charts--timeframe-selector)

---

## Item 13 — Price provider abstraction + move coin search to backend

**Branch:** `feat/price-provider-abstraction` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-13--price-provider-abstraction--move-coin-search-to-backend)

---

## Item 14 — Test coverage

**Branch:** `test/coverage` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-14--test-coverage)

---

## Item 15 — Facebook login

**Branch:** `feat/facebook-login` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-15--facebook-login)

---

## Item 16 — Cross-provider Cognito account linking

**Branch:** `feat/cognito-account-linking` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-16--cross-provider-cognito-account-linking)

---

## Item 17 — Custom auth UI

**Branch:** `feat/custom-auth-ui` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-17--custom-auth-ui)

---

## Item 18 — Ops/trade UX study

**Branch:** `docs/ops-ux-study` · ✅ Won't do — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-18--opstrade-ux-study)

---

## Item 20 — Feature roadmap document

**Branch:** `docs/feature-roadmap` · ✅ Won't do — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-20--feature-roadmap-document)

---

## Item 22 — Platform field catalog (logo + name + category)

**Branch:** `feat/platform-field-catalog` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-22--platform-field-catalog-logo--name--category)

---

## Item 23 — Signup password validation UX

**Branch:** `fix/signup-password-feedback` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-23--signup-password-validation-ux)

---

## Item 24 — Fix import-wallet messaging and stale state after import

**Branch:** `fix/import-wallet-feedback` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-24--fix-import-wallet-messaging-and-stale-state-after-import)

---

## Item 25 — Fix Pre Sign-up Lambda: block duplicate accounts on native signup

**Branch:** `aws-infra` `fix/pre-signup-block-duplicate-native` (against master); `crypto-assist` `fix/signup-linked-account-error`, `fix/auth-error-message-spacing`, `chore/tick-plan-item-23`, `chore/fix-stale-env-example` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-25--fix-pre-sign-up-lambda-block-duplicate-accounts-on-native-signup)

---

## Item 26 — Position closing, leverage, and history day-grouping

**Branch:** `feat/position-closing` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-26--position-closing-leverage-and-history-day-grouping)

---

## Item 27 — Cycle tag + floating summary for linked operations

**Branch:** `feat/op-cycle-summary` · ⤷ Folded into item 28 (not implemented standalone) — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-27--cycle-tag--floating-summary-for-linked-operations)

---

## Item 28 — Wallet vs. trade operation refactor (History + operation panel)

**Branch:** `feat/wallet-trade-refactor` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-28--wallet-vs-trade-operation-refactor-history--operation-panel)

---

## Item 29 — Leverage custom input + Long/Short pill refactor

**Branch:** `feat/leverage-custom-input` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-29--leverage-custom-input--longshort-pill-refactor)

---

## Item 30 — Per-asset charts & tooltip redesign (design handoff import)

**Branch:** `feat/charts-tooltips-redesign` · ✅ Done — full details: [PLAN_ARCHIVE.md](PLAN_ARCHIVE.md#item-30--per-asset-charts--tooltip-redesign-design-handoff-import)

---

## Item 19 — New investment types (Phase 1: Brazilian stocks)
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

## Item 21 — Extract auth kit to a standalone reusable repository
**Branch:** `chore/extract-auth-kit`
**Depends on:** item 17 (custom auth UI must exist first)

- [ ] Done

### Current state
Item 17 builds the branded hero/login/signup/callback/bootstrap-gate auth flow directly inside `web/src/auth/` for this app only (per Item 17's clarification: no reuse-specific packaging in that item, since this repo forbids speculative abstraction). The components are already token-driven (CSS custom properties for brand colors) and cleanly boundaried, which is what makes a later extraction realistic.

### Goal
Move the auth kit (`AuthShell`, `AuthCard`, `BrandMark`, `ProviderButton`, `AuthField`, `LoadingState`, `SuccessState`, `AuthCallback`, `AppBootstrapGate`, `RequireAuth`, `useAuth`, and the login/signup screen shells) into its own standalone, versioned GitHub repository, published so other apps (starting with any future `bmartins95` project) can install it and get a fully working, brandable auth flow by swapping a token file, a logo, and an auth-backend adapter — without touching crypto-assist-specific code.

### Scope notes (to refine when this item is actually planned)
- Needs a decision on the package's auth-backend abstraction boundary — Item 17's `useAuth()` hook was already designed as the seam for this (per `auth-flow-implementation.md`'s "Reusing the kit in another app" section), but generalizing it beyond Cognito/Amplify is new work.
- `crypto-assist`'s own `web/src/auth/` would become a thin consumer of the published package rather than the source of truth.
- Out of scope: any change to this app's actual auth behavior, screens, or copy — this item is a pure extraction/refactor, not a redesign.

### Done when
- The auth kit lives in its own repository with its own versioning, README, and brand-token override instructions.
- `crypto-assist` consumes it as a dependency and its auth screens behave identically to how Item 17 left them.
- A second, hypothetical app's setup is documented (even if not actually built) to confirm the extraction is genuinely reusable, not reusable-in-theory.

---

## Item 30 — Per-asset charts & tooltip redesign (design handoff import)
**Branch:** `feat/charts-tooltips-redesign`
**Depends on:** item 12 (historical charts + timeframe selector), item 13 (price provider abstraction)

- [ ] Done

### Current state
`ProfitTab.tsx` renders three Chart.js canvases switched by `activeChart` (`by-asset` bar chart, `over-time` and `value` line charts, all portfolio-wide) using Chart.js's built-in canvas tooltip with per-chart `tooltip.callbacks.label` formatters (`web/src/components/ProfitTab.tsx`). There is no per-asset (single-coin) price/PnL chart anywhere in the app — `WalletTab.tsx` only lists position rows, it does not chart an individual asset's history. Tooltip styling is whatever Chart.js renders by default; there is no shared tooltip component reused elsewhere in the UI.

### Design source
Import the handoff design before implementing:
1. Connect to the claude_design MCP (`https://api.anthropic.com/v1/design/mcp`, authenticate via `/design-login`).
2. Import project: https://claude.ai/design/p/7de25ab4-b495-4062-bdb4-ba8895f54eef?file=Handoff+-+Gr%C3%A1ficos+por+Ativo+e+Tooltips.dc.html
3. Implement the file `Handoff - Gráficos por Ativo e Tooltips.dc.html` (per-asset charts + tooltips) exactly as specced — do not freelance layout, spacing, or colors beyond what the handoff defines.

### Files to modify (expected — confirm against the imported handoff)
- `web/src/components/ProfitTab.tsx` — apply the redesigned tooltip treatment to the existing three charts.
- `web/src/components/WalletTab.tsx` — add the new per-asset chart entry point (e.g. opening a chart for a single position).
- New component(s) for the per-asset chart and the shared tooltip, under `web/src/components/`.
- `web/src/app/globals.css` — any new chart/tooltip styling tokens the handoff defines.

### Done when
- The per-asset chart and tooltip UI match the imported handoff.
- Existing portfolio-wide charts in the Profit tab keep working with the redesigned tooltip.
- `npm test` and `npm run coverage` pass for changed modules per the repo's testing rules.

---


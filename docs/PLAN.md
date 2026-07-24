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

## Item 31 — Currency-consistency fixes (wallet balance, money display, exit price)
**Branch:** `fix/wallet-currency-and-money-display`
**Depends on:** none — bug fixes against existing item 10/26/28 behavior, not a new feature

- [ ] Done

### Current state
Found live-debugging a real prod bug: a Troca (swap) op failed with a generic "operation failed" toast despite the wallet holding enough balance. Root-caused via prod CloudWatch logs to the negative-balance guard grouping wallet ops by `(coinId, platformId, currency)` when it only ever needs quantity — no cost-basis math happens server-side at all. The currency split falsely fragmented one real holding the moment a user's op history spanned more than one recorded currency (e.g. after switching their Settings currency preference). Auditing the same code area surfaced three further currency-consistency bugs.

### PR
[PR #104](https://github.com/bmartins95/crypto-assist/pull/104), branch `fix/wallet-currency-and-money-display`, not yet merged. Commits:
1. `fix: stop wallet balance checks from splitting by op currency` — dropped `currency` from the grouping key in `backend/app/routes/ops.py`'s `_wallet_ops_for_group` and `shared/src/walletFifo.ts`'s `walletOpsForTuple`.
2. `fix: show the selected currency symbol on op form fields` — `OpDrawer.tsx`'s price/fee/total inputs hardcoded `prefix="R$"`; added `currencySymbol()` (shared) and a new `web/src/components/MoneyField.tsx` component.
3. `fix: convert wallet P/L to a common currency before math` — `computeWalletRealizedPnl` mixed raw prices across currencies; now converts via `convertOpsToUsd` before the FIFO walk (History's per-row P/L and the drawer's live Sell preview).
4. `fix: label the exit-price input with the selected currency` — `WalletTab.tsx`'s exit-price input had no currency indicator at all.
5. `fix: scale MoneyField's prefix padding to the currency symbol` — a fixed padding-left sized for the widest symbol ("US$") overlapped shorter ones and left an awkward gap for the app's default ("R$"); now scales with `prefix.length`.
6. `chore: remove stale duplicate item 30 block from plan` — unrelated docs cleanup found while editing this file (item 30's full detail had been left behind here instead of only living in PLAN_ARCHIVE.md).

### New rule
`web/AGENTS.md` now requires `MoneyField` (never a raw `NumericField` with a literal prefix) for any money input, and `fmtMoney`/`fmtMoneyCompact`/`fmtFromCurrency` for any money display.

### Known follow-up (not done)
`computeWalletEditImpact`'s internal pnl-delta comparison (used only to decide whether to show an "N operations affected" edit/delete confirmation, never to display an exact figure) still doesn't convert cross-currency lots — lower stakes than the fixes above, left out to keep the PR scoped.

### Done when
- PR #104 merged to `develop`.
- `pytest` (backend) and `npm test` (web) pass; every fix has a regression test confirmed to fail on the pre-fix code.

---


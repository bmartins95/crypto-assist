# Implementation Plan: Wallet View Redesign

**Branch**: `feat/wallet-view-refactor` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-wallet-view-refactor/spec.md`

## Summary

Restyle the Wallet view (`web/src/components/WalletTab.tsx`, routed at `/wallet` inside the Item 6 sidebar shell) to match the prototype: a shared `ContentHeader` (title, subtitle, last-updated, refresh button) and a shared `MetricCard` (Invested, Current value, P/L, Return) replace the old inline header/metric markup; the existing three-way grouping table is restyled onto the prototype's `.tbl`/`.asset`/`.coin`/`.pill.up`/`.pill.down` tokens with a coin image per asset row. `ContentHeader` and `MetricCard` are generic so Items 8–9 can reuse them without rework (explicit PLAN Item 7 deliverable). No portfolio calculation logic changes — `computePositions`/`collectAssets` in `shared/src/portfolio.ts` are consumed as-is.

## Technical Context

**Language/Version**: TypeScript (strict), React 19

**Primary Dependencies**: Vite, TanStack Router (unchanged routing from Item 6), `@crypto-assist/shared` (portfolio calc + i18n), Tabler icon font (already used)

**Storage**: None — purely presentational; reads from the existing `usePortfolio()` context (`web/src/components/AppLayout.tsx`, Item 6)

**Testing**: Vitest + Testing Library (`cd web && npm test`)

**Target Platform**: Web (desktop-first, existing ≤820px sidebar stacking from Item 6 applies to content width automatically via the grid)

**Project Type**: Web frontend restyle within the existing monorepo `web/` package

**Performance Goals**: No new network calls; metric cards and table derive synchronously from already-fetched `ops`/`prices`/`assets`

**Constraints**: No new npm packages. No `shared/` changes (portfolio calc logic is reused unmodified). Item 7 only touches `WalletTab.tsx` + two new shared components + `globals.css` — Profit/History views are NOT restyled in this item (Items 8/9).

**Scale/Scope**: 2 new small components (`MetricCard`, `ContentHeader`), 1 rewritten component (`WalletTab`), CSS additions (chead/metrics/mcard/tbl/asset/coin/pill tokens), test updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared-First | PASS | No `shared/` changes — `computePositions`/`collectAssets`/`fmt`/`fmtPct`/`fmtQty` consumed as-is; mobile unaffected |
| II. Security at Boundary | PASS | No API/backend changes; purely presentational; exit-price input still goes through existing `setExitPrice` validated at the API boundary |
| III. Behavior Coverage | PASS (planned) | Tests: metric card values/colors/placeholders, header refresh + failure states, all three grouping modes, coin-image fallback, tabular-nums presence, balances-hidden masking, empty state |
| IV. No Speculative Code | PASS | Only the two components PLAN Item 7 explicitly names are created generically; no AssetCell/other extraction not requested; History/Profit left untouched |
| V. A11y & i18n | PASS (planned) | Refresh button keeps an accessible label; coin image `alt` text; all new labels via `useLocale()` in all 10 locales |

Post-design re-check: PASS — no violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-wallet-view-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md         # MetricCard/ContentHeader prop contracts
├── quickstart.md        # How to run/verify
├── contracts/
│   └── components.md    # MetricCard / ContentHeader / WalletTab contracts
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
web/src/
├── components/
│   ├── MetricCard.tsx             # NEW: label, value, valueColor?, sub?, subColor?
│   ├── MetricCard.test.tsx        # NEW
│   ├── ContentHeader.tsx          # NEW: title, subtitle, children (right-side actions)
│   ├── ContentHeader.test.tsx     # NEW
│   ├── WalletTab.tsx              # REWRITE: use ContentHeader + MetricCard; restyle table onto .tbl/.asset/.coin/.pill.up/.pill.down; keep 3 grouping modes and exit-price editing
│   └── WalletTab.test.tsx         # UPDATE: cover new structure, preserve existing behavior coverage
└── app/globals.css                # ADD: .chead, .ct, .cs, .refresh, .ts, .metrics, .mcard, .ml, .mv, .msub, .tbl, .tbl.scroll, .asset, .coin, .pill.up, .pill.down, .btn (generic, distinct from existing .btn-sm)
```

**Structure Decision**: Follow the established component pattern (`web/src/components/*.tsx` + colocated `*.test.tsx`). `MetricCard` and `ContentHeader` are presentational, prop-driven, and framework-agnostic beyond React — no context coupling — so Items 8/9 can import them directly. `WalletTab` keeps its existing `Props` shape (same props already passed from `web/src/router.tsx`'s `WalletRoute`); only its internal JSX changes.

## Complexity Tracking

No constitution violations — table not required.

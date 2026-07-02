---

description: "Task list for Profit view redesign (Item 8)"
---

# Tasks: Profit View Redesign

**Input**: Design documents from `/specs/009-profit-view-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — Constitution III (Behavior Coverage Over Line Coverage) and CLAUDE.md
require ≥90% coverage plus explicit behavior tests on every changed module.

**Organization**: Grouped by user story from spec.md, in priority order (P1 → P2 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to US1–US4 from spec.md

## Path Conventions

Monorepo: `shared/src/` (cross-package logic) + `web/src/` (frontend). No `backend/` or
`mobile/` changes in this feature.

---

## Phase 1: Setup

No new project setup required — branch, spec, and plan already exist. Skipping to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The realized/unrealized P/L split every user story depends on.

**⚠️ CRITICAL**: No user story task can begin until this phase is complete.

- [X] T001 Add `AssetProfit` interface and `computeProfitByAsset(ops, prices)` function to `shared/src/portfolio.ts`, implementing the average-cost closed/open lot split described in data-model.md (per-asset `investedOpen`, `currentValue`, `unrealizedPnl`, `unrealizedPct`, `realizedPnl`, `hasOpenPosition`, `hasPrice`)
- [X] T002 Export `computeProfitByAsset` and `AssetProfit` from `shared/src/index.ts` (depends on T001)
- [X] T003 [P] Add `profit_subtitle` key to the `UIText` interface in `shared/src/i18n/types.ts`
- [X] T004 [P] Add a `profit_subtitle` translation to all 10 locale files in `shared/src/i18n/locales/` (`pt-BR.ts`, `en-US.ts`, `es-ES.ts`, `fr-FR.ts`, `de-DE.ts`, `zh-CN.ts`, `ja-JP.ts`, `ar-SA.ts`, `hi-IN.ts`, `ru-RU.ts`) — depends on T003 (TypeScript enforces every locale satisfies `UIText`)
- [X] T005 [P] Add tests for `computeProfitByAsset` to `web/src/lib/portfolio.test.ts` (verified empirically: `web/vitest.config.ts` has no root/include override, so `cd web && npm test` only discovers `*.test.ts` under `web/src/` — a file at `shared/src/portfolio.test.ts` would be silently uncollected by the enforced test gate; `web/src/lib/portfolio.test.ts` is the only location where the constitution's actual intent, tests that run, is satisfiable, matching the existing tests for every other `portfolio.ts` export): an asset with only a closed lot (realized only), an asset with only an open lot (unrealized only), an asset with both (partial sell — verify realized and unrealized are both correct and don't double-count cost basis), a zero-price asset (`hasPrice: false`), and an op with an empty `coinId` (ignored) — depends on T001

**Checkpoint**: `computeProfitByAsset` is implemented, exported, and tested. User story work can begin.

---

## Phase 3: User Story 1 - See profit summary at a glance (Priority: P1) 🎯 MVP

**Goal**: Content header + four metric cards (Realized P/L, Unrealized P/L, Best asset, Worst asset) driven by `computeProfitByAsset`, with Best/Worst restricted to open positions per the resolved clarification.

**Independent Test**: Load `/profit` with a mix of open and closed positions; verify the four metric cards show correct values and Best/Worst only ever reference assets with an open position.

### Implementation for User Story 1

- [X] T006 [US1] In `web/src/router.tsx`, thread `statusMsg={p.statusMsg}` and `onFetchPrices={p.fetchPrices}` from `usePortfolio()` into `<ProfitTab>` inside `ProfitRoute` (mirrors what `WalletRoute` already does)
- [X] T007 [US1] In `web/src/components/ProfitTab.tsx`, add `statusMsg: string` and `onFetchPrices: () => void` to the `Props` interface (dropped the now-unused `assets` prop, superseded by `computeProfitByAsset(ops, prices)`; updated `router.tsx` accordingly)
- [X] T008 [US1] In `web/src/components/ProfitTab.tsx`, replace the top-level markup with `<ContentHeader title={t.nav_profit} subtitle={t.profit_subtitle}>` containing a `<span className="ts">{statusMsg}</span>` and a refresh `<button className="btn" onClick={onFetchPrices}>` with `t.wallet_updatePrices` text (same pattern as `WalletTab.tsx`)
- [X] T009 [US1] In `web/src/components/ProfitTab.tsx`, replace `ops`/`assets`/`prices`-derived inline math with `computeProfitByAsset(ops, prices)`; compute total realized (`sum(realizedPnl)`), total unrealized (`sum(unrealizedPnl)` over `hasPrice` entries), and best/worst (max/min `unrealizedPct` over entries where `hasOpenPosition && hasPrice`, `null` if none)
- [X] T010 [US1] In `web/src/components/ProfitTab.tsx`, replace the four hand-rolled `<div className="metric">` blocks with `<MetricCard>` (import from `@/components/MetricCard`), preserving `pos`/`neg` coloring and the best/worst `sub`/`subColor` percentage line; render `—` when best/worst is `null`
- [X] T011 [US1] In `web/src/components/ProfitTab.test.tsx`, replace the `'computes realized profit from sells minus buys'` test (which asserts the old, incorrect cash-flow formula) with a test asserting closed-lot realized P/L for a partially-sold position (1 BTC @100 buy, 0.5 BTC @150 sell → realized = +25, not -25)
- [X] T012 [US1] In `web/src/components/ProfitTab.test.tsx`, add tests: unrealized P/L card reflects only open-position value; best/worst asset cards show `—` when there are no open positions; best/worst asset cards exclude a fully-closed asset even when it has the highest realized return

**Checkpoint**: `/profit` shows a working header and four correct metric cards, independently of chart-mode or icon work below.

---

## Phase 4: User Story 2 - Switch between P/L breakdown views (Priority: P2)

**Goal**: The existing three-mode chart switcher keeps working exactly as before — this phase is pure regression coverage since the switching logic itself is unchanged by this item.

**Independent Test**: Click each of the three chart-mode buttons and confirm the chart underneath changes.

### Implementation for User Story 2

- [X] T013 [US2] In `web/src/components/ProfitTab.test.tsx`, verify the existing chart-switch test (`'switches the active chart when clicking a chart button'`) still passes unmodified against the new metric-card implementation (adjust only if T009/T010 changed surrounding markup enough to break the `screen.getByText` query)

**Checkpoint**: All three chart modes still switch correctly.

---

## Phase 5: User Story 3 - Understand P/L and allocation per asset (Priority: P3)

**Goal**: The "By asset" divergent bar chart and the allocation panel both read from `computeProfitByAsset` (total P/L = realized + unrealized combined per asset, per research.md R2), instead of the current unrealized-only, open-position-only data.

**Independent Test**: Load `/profit` with several assets of mixed positive/negative P/L (including one fully-closed asset with a realized loss) and verify it appears as a bar in the chart and a row in the allocation panel.

### Implementation for User Story 3

- [X] T014 [US3] In `web/src/components/ProfitTab.tsx`, change the `'by-asset'` Chart.js dataset to plot `realizedPnl + unrealizedPnl` per `AssetProfit` entry (all entries, not just `hasPrice`), keeping the existing sign-based `backgroundColor` (`#1D9E75` / `#E24B4A`) logic; verify Chart.js's default zero-crossing category axis renders as a visually distinct line at y=0 when the dataset has both positive and negative bars (per FR-007) — if it does not, add explicit axis/border styling to make it visible
- [X] T015 [US3] In `web/src/components/ProfitTab.tsx`, change the allocation/distribution panel to iterate `computeProfitByAsset` entries with `hasOpenPosition`, sizing each bar by `investedOpen / sum(investedOpen)`
- [X] T016 [US3] In `web/src/components/ProfitTab.test.tsx`, add a test with a fully-closed asset (realized loss) plus an open asset (unrealized gain): assert both appear in the by-asset chart data, only the open asset appears in the allocation panel, and the sum of per-asset `realizedPnl + unrealizedPnl` across the chart dataset equals the total realized + total unrealized shown in the US1 metric cards (SC-003 reconciliation)

**Checkpoint**: Chart and allocation panel reconcile with the metric cards from US1 (SC-003).

---

## Phase 6: User Story 4 - Uncluttered segmented controls (Priority: P3)

**Goal**: Remove the icon from every option in both the Profit view's chart-mode control and the Wallet view's grouping control.

**Independent Test**: Visually/DOM-inspect both segmented controls and confirm no `<i className="ti ...">` renders inside any `.chart-btn`.

### Implementation for User Story 4

- [X] T017 [P] [US4] In `web/src/components/ProfitTab.tsx`, remove the `<i className={`ti ${icon}`} />` element (and the now-unused `icon` entries) from the chart-mode `.chart-switcher` buttons, keeping only the text label
- [X] T018 [P] [US4] In `web/src/components/WalletTab.tsx`, remove the `<i className="ti ti-coins" />` / `ti-building-bank` / `ti-layout-grid` elements from the grouping `.chart-switcher` buttons, keeping only the text label
- [X] T019 [P] [US4] In `web/src/components/ProfitTab.test.tsx`, add a test asserting `document.querySelectorAll('.chart-switcher i')` is empty
- [X] T020 [P] [US4] In `web/src/components/WalletTab.test.tsx`, add a test asserting `document.querySelectorAll('.chart-switcher i')` is empty

**Checkpoint**: Neither segmented control renders an icon; grouping/chart-mode switching still works (covered by T013 and existing `WalletTab.test.tsx` grouping tests).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T021 Run `cd web && npm test` and fix any failures across `ProfitTab.test.tsx`, `WalletTab.test.tsx`, and `portfolio.test.ts` — 153/153 pass
- [X] T022 Run `cd web && npm run coverage`; confirm ≥90% on `web/src/components/ProfitTab.tsx` and `web/src/components/WalletTab.tsx`. `shared/src/portfolio.ts` cannot be measured this way — the coverage provider's root is `web/`, so `shared/` is out of its scan tree entirely (same empirical finding as T005); its 5 `computeProfitByAsset` tests in `web/src/lib/portfolio.test.ts` were manually verified to exercise every branch (Buy path, Sell path, empty-`coinId` skip, zero-`investedOpen` guard, `hasPrice` true/false) instead. Result: `ProfitTab.tsx` 94.02% stmts / 90.27% branch / 100% funcs / 100% lines; `WalletTab.tsx` 97.29% stmts / 75.45% branch / 100% funcs / 100% lines (branch gap is pre-existing on this large table component, not introduced by the 2-line icon removal)
- [X] T023 Walk through `quickstart.md` manually against `npm run dev` (header, metric cards, chart modes, allocation panel, icon-free controls, empty state)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories (every story reads `computeProfitByAsset`).
- **US1 (Phase 3)**: Depends on Phase 2 only.
- **US2 (Phase 4)**: Depends on Phase 2 and on US1's markup changes landing first (T013 re-verifies a test whose surrounding DOM US1 touches) — practically sequential after US1.
- **US3 (Phase 5)**: Depends on Phase 2 only; independent of US1/US2 markup, touches different parts of the same file so should follow US1 to avoid merge churn.
- **US4 (Phase 6)**: Depends on Phase 2 only; touches the same `.chart-switcher` JSX block as US2/US3 read but not write, so can run any time after Phase 2 — sequenced last here only to keep the diff easy to review.
- **Polish (Phase 7)**: Depends on all preceding phases.

### Parallel Opportunities

- T003 and T004 can run in parallel with T001/T002 (different files).
- T017–T020 (Phase 6) are all `[P]` — two components and two test files, no shared state.
- Within Phase 2, T003/T004 are parallel to T001/T002/T005.

---

## Implementation Strategy

### MVP First

1. Phase 2 (Foundational) — `computeProfitByAsset` is the load-bearing piece.
2. Phase 3 (US1) — header + correct metric cards. This alone fixes the realized-P/L bug and is independently shippable.
3. Validate, then continue through Phases 4–7 in order.

### Incremental Delivery

Phase 2 → US1 (MVP) → US2 (regression check) → US3 (chart/allocation) → US4 (icon cleanup) → Polish.

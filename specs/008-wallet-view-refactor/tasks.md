# Tasks: Wallet View Redesign

**Input**: Design documents from `/specs/008-wallet-view-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md

**Tests**: Included — required by Constitution Principle III.

**Organization**: Tasks grouped by user story; US1 (metric cards) is the MVP increment, US2 (header/refresh) and US3 (grouping/table restyle) layer onto the same view.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New i18n key and CSS primitives every story consumes.

- [X] T001 Add `wallet_subtitle` to `UIText` in `shared/src/i18n/types.ts` and to all 10 locale files in `shared/src/i18n/locales/*.ts` (accurate translation of "Real-time quotes via CoinGecko · BRL"-style subtitle, adapted per locale's currency framing already used elsewhere in that locale file)
- [X] T002 [P] Add content-view CSS primitives to `web/src/app/globals.css`: `.chead`, `.chead .ct`, `.chead .cs`, `.refresh`, `.refresh .ts`, `.metrics` (4-col grid, 2-col at ≤700px matching the existing `@media (max-width: 700px)` block), `.mcard`, `.mcard .ml`, `.mcard .mv`, `.mcard .msub`, `.tbl`, `.tbl.scroll`, `.asset`, `.coin`, `.pill.up`, `.pill.down`, and a generic `.btn` (distinct from `.btn-sm`) — all mapped to existing `--s-*` theme tokens per research.md R2; do not remove or rename the pre-existing `.metric`/`.pill-pos`/`.pill-neg`/`.coin-cell` rules (still used by HistoryTab/ProfitTab)

**Checkpoint**: `cd web && npm test` still green (no consumer changes yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two reusable components every story's UI is built from.

- [X] T003 [P] Create `web/src/components/MetricCard.tsx` per contracts/components.md: props `{ label: string; value: string; valueColor?: 'pos' | 'neg'; sub?: string; subColor?: 'pos' | 'neg' }`; renders `.mcard > .ml + .mv[.pos|.neg] [+ .msub[.pos|.neg]]`; no internal state or formatting logic
- [X] T004 [P] Create `web/src/components/ContentHeader.tsx` per contracts/components.md: props `{ title: string; subtitle: string; children?: React.ReactNode }`; renders `.chead > (.ct title + .cs subtitle) + .refresh (children)`
- [X] T005 [P] Create `web/src/components/MetricCard.test.tsx`: renders label/value, applies `.pos`/`.neg` to value and sub when provided, omits color classes when not provided, renders without `sub`
- [X] T006 [P] Create `web/src/components/ContentHeader.test.tsx`: renders title/subtitle, renders children in the actions area, renders with no children

**Checkpoint**: New components compile and have passing unit tests; not yet wired into WalletTab.

---

## Phase 3: User Story 1 — See portfolio health at a glance (P1) 🎯 MVP

**Goal**: Four metric cards (Invested, Current value, P/L, Return) replace the old inline metrics block, with correct values, colors, and placeholders.

**Independent Test**: Render `WalletTab` with known ops/prices and assert the four `MetricCard` values match the holdings totals, colors follow sign, and cards show `—` when no asset has a price yet.

- [X] T007 [US1] In `web/src/components/WalletTab.tsx`, replace the old `<div className="metrics">...</div>` block with four `<MetricCard>` instances (Invested, Current value, P/L with `valueColor`, Return with `valueColor`) driven by the existing `totalInv`/`totalAtual` computation (unchanged calculation, per research.md R5); preserve the existing `inv && atual` placeholder rule and the `mask()` balances-hidden wrapping
- [X] T008 [US1] Update `web/src/components/WalletTab.test.tsx`: add assertions that the P/L card carries a `pos`/`neg` value color matching sign, that all four cards show `—` when `prices` is empty (no known price for any asset), and that metric values are masked when `BalanceProvider` hides balances (reuse the existing balances-hidden test pattern from `web/src/pages/settings.test.tsx` if one doesn't already exist for WalletTab)

**Checkpoint**: US1 acceptance scenarios 1–3 pass — MVP deliverable.

---

## Phase 4: User Story 2 — Refresh prices from the view header (P2)

**Goal**: A `ContentHeader` replaces the old `.topbar` status/refresh row, showing title, subtitle, last-updated/status text, and the refresh action.

**Independent Test**: Render `WalletTab`, assert the header shows title/subtitle from i18n and the `statusMsg` prop text, click the refresh button, and assert `onFetchPrices` fires.

- [X] T009 [US2] In `web/src/components/WalletTab.tsx`, replace the old `.topbar` status/refresh markup with `<ContentHeader title={t.nav_wallet} subtitle={t.wallet_subtitle}>` containing a `<span className="ts">{statusMsg}</span>` and a `<button className="btn" onClick={onFetchPrices}>` (refresh icon + `t.wallet_updatePrices` label); keep the segmented grouping control as a sibling below the metrics grid (per research.md — prototype places it there, not inside the header)
- [X] T010 [US2] Update `web/src/components/WalletTab.test.tsx`: add assertions that the header renders `t.nav_wallet`/`t.wallet_subtitle`, that the `statusMsg` prop text is visible, and that clicking the refresh button calls `onFetchPrices`

**Checkpoint**: US2 acceptance scenarios 1–3 pass.

---

## Phase 5: User Story 3 — Compare holdings by asset, platform, or both (P3)

**Goal**: The three existing grouping modes are preserved but the by-asset table (and the asset-cell markup shared by "both" mode) is restyled onto `.tbl`/`.asset`/`.coin`/`.pill.up`/`.pill.down`, with coin images and tabular-nums alignment.

**Independent Test**: Render each of the three grouping modes with a two-platform, one-asset fixture and assert the table regroups correctly and asset rows show the `.asset`/`.coin` structure with an image or initials fallback.

- [X] T011 [US3] In `web/src/components/WalletTab.tsx`, restyle the by-asset table's wrapper to `.tbl.scroll`, the coin cell to `.asset > .coin (image or initials fallback per research.md R4) + name/ticker`, and P/L-percentage cells to `.pill.up`/`.pill.down` (replacing `.pill-pos`/`.pill-neg` in this view only); apply the same `.asset`/`.coin` restyle to the "both" grouping mode's per-row cell; keep the by-platform mode's existing row markup (no per-asset coin cell there) but wrap its table in `.tbl.scroll` too; add `font-variant-numeric: tabular-nums` via the new `.tbl td.num` rule (added in T002) to every numeric `<td>` by adding the `num` class
- [X] T012 [US3] Update `web/src/components/WalletTab.test.tsx`: add an assertion that an asset with a cached avatar renders an `<img>` and one without renders initials text, and that switching grouping modes (asset → platform → both → asset) still produces the correct rows per the existing coverage (extend, don't replace, the existing grouping tests)

**Checkpoint**: US3 acceptance scenarios 1–3 pass.

---

## Phase 6: Polish & Cross-Cutting

- [X] T013 [P] Locale sweep: verify no missing-key fallback for `wallet_subtitle` across all 10 locales (compiler-enforced; run `npx tsc --noEmit` in `web/` and `shared/`)
- [X] T014 [P] Verify mobile still type-checks against updated `shared/` (`cd mobile && npx tsc --noEmit`) — Constitution Principle I (should be a no-op since `wallet_subtitle` is additive)
- [X] T015 Run `cd web && npm test` and `cd web && npm run coverage`; ensure ≥90% on changed modules (`MetricCard.tsx`, `ContentHeader.tsx`, `WalletTab.tsx`); run `cd backend && pytest` (should be untouched/green); fix all failures
- [ ] T016 Manual quickstart walkthrough (`specs/008-wallet-view-refactor/quickstart.md`) against `docs/design/dashboard-collapsible-sidebar.html` "Carteira" view, including balances-hidden masking and the empty-wallet state

---

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6
- US2 and US3 both build on the same `WalletTab.tsx` file touched by US1 — sequential within the file, but each phase's acceptance criteria are independently verifiable
- T001 and T002 are independent of each other; both block T003–T012

## Parallel Opportunities

- T001 ∥ T002 (i18n key vs CSS, different files)
- T003 ∥ T004 ∥ T005 ∥ T006 (two components + their tests, four different files)
- T013 ∥ T014 in Phase 6

## Implementation Strategy

MVP = Phases 1–3 (metric cards). US2/US3 are incremental restyles of the same `WalletTab.tsx`; all land in this single branch/PR per PLAN Item 7.

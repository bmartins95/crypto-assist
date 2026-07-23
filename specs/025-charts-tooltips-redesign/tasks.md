---

description: "Task list for Per-Asset Charts & Enriched Tooltips"
---

# Tasks: Per-Asset Charts & Enriched Tooltips

**Input**: Design documents from `/specs/025-charts-tooltips-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no `contracts/` — purely internal frontend feature)

**Tests**: Included — the constitution's Behavior Coverage principle requires an explicit test per user-facing behaviour, so test tasks are not optional for this project.

**Organization**: Tasks are grouped by user story (US1–US4, matching spec.md's priorities) so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Maps the task to US1–US4 from spec.md
- File paths are exact

---

## Phase 1: Setup

**Purpose**: Reference material and i18n scaffolding shared by every story

- [x] T001 [P] Save the imported design handoff as `specs/025-charts-tooltips-redesign/design/handoff.html` (source: claude_design MCP project `7de25ab4-b495-4062-bdb4-ba8895f54eef`, file `Handoff - Gráficos por Ativo e Tooltips.dc.html`) for implementer reference.
- [x] T002 [P] Save the referenced mock file as `specs/025-charts-tooltips-redesign/design/mockups.html` (source: same project, file `Gráficos - Ideias por Ativo e Tooltips.dc.html`, ids 1d/1f/2a/2b/2c) for implementer reference.
- [x] T003 Add the new UI-string keys this feature needs (compare-with control, "Nenhum", asset-list search placeholder, sort options, list column headers, tooltip row labels: Realizado/Não realizado/Operações no dia/Valor atual/Investido/Resultado não realizado/Variação no dia/no dia) to `shared/src/i18n/types.ts`.
- [x] T004 [P] Add matching translations for the T003 keys to every locale file in `shared/src/i18n/locales/` (`en-US.ts`, `pt-BR.ts`, `es-ES.ts`, `fr-FR.ts`, `de-DE.ts`, `ja-JP.ts`, `zh-CN.ts`, `ru-RU.ts`, `ar-SA.ts`, `hi-IN.ts`) — depends on T003 for the key list.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared derived-data functions every user story consumes

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Extend `TimelinePoint` in `shared/src/portfolio.ts`'s `computeTimeline` with `realizedPnl`, `unrealizedPnl`, `dayDeltaAbs`, `dayDeltaPct`, `opsCount`, and `assetContribution` per data-model.md's `DaySnapshot` (additive fields only — existing consumers unaffected).
- [x] T006 [P] Add `computeAssetPeriodSeries(ops, historicalPrices, prices, from, to, closures)` to `shared/src/portfolio.ts`, returning `AssetPeriodSeries[]` per data-model.md (normalized % series, first point = 0, empty series when no price data).
- [x] T007 Export the new `DaySnapshot`/`AssetPeriodSeries` types and `computeAssetPeriodSeries` from `shared/src/index.ts` (depends on T005, T006).
- [x] T008 [P] Tests for the extended `computeTimeline` in `shared/src/portfolio.test.ts`: happy path (realized/unrealized split sums to `pnl`), zero-operations day, first-day-in-range delta (no divide-by-zero), previous-day `pnl` of 0 (no `NaN%`).
- [x] T009 [P] Tests for `computeAssetPeriodSeries` in `shared/src/portfolio.test.ts`: happy path, asset with no price history in range (empty series, not an error), asset with a single data point (`pctChange` is `0`, not `NaN`).
- [x] T010 [P] Create a shared `coinId → color` helper (extract the existing `PALETTE` cycling logic out of `ProfitTab.tsx:45`) in `web/src/lib/assetColor.ts`, so `AssetCompareControl`, `AssetsOverTimeList`, and the chart overlay all resolve an asset's color identically — placed here (not in a story phase) so US1 and US2 stay independently buildable.
- [x] T011 Run the project's mobile build-check (see quickstart.md's Mobile parity check) to confirm the additive `TimelinePoint` change doesn't break `mobile/` (depends on T005).

**Checkpoint**: Shared calculations ready — all four user stories can now start.

---

## Phase 3: User Story 1 - Compare one asset against the portfolio curve (Priority: P1) 🎯 MVP

**Goal**: A "Compare with" control on the Profit-over-time and Portfolio-value charts overlays one asset's period % change on an independent right-hand axis, replacing (never stacking) the prior selection, and persists per chart.

**Independent Test**: Open the Profit tab, select an asset from "Compare with" on each chart, confirm the dashed overlay + right axis appear and swap cleanly, confirm "Nenhum" clears it, and confirm the choice survives a reload.

### Tests for User Story 1

- [x] T012 [P] [US1] Component test for `AssetCompareControl` in `web/src/components/AssetCompareControl.test.tsx`: renders "Nenhum" plus one option per held asset, selecting an option fires the change handler with that `coinId`, selecting a second option replaces (does not add to) the prior selection.
- [x] T013 [P] [US1] `ProfitTab.test.tsx` additions: selecting an asset adds a dashed overlay dataset with its own `y1` scale to the active chart's config; selecting "Nenhum" removes it; the selection is written to and restored from `localStorage` per chart; a persisted `coinId` for an asset no longer held falls back to "Nenhum"; a selected asset with no price history for the period renders the existing empty-state rather than a blank/broken overlay (FR-013).

### Implementation for User Story 1

- [x] T014 [P] [US1] Create `AssetCompareControl.tsx` in `web/src/components/AssetCompareControl.tsx` — segmented radio group ("Nenhum" + one entry per held asset), each option colored via the T010 palette helper, `aria-label`led per the constitution's accessibility rule.
- [x] T015 [US1] In `ProfitTab.tsx`, compute the selected asset's series via `computeAssetPeriodSeries` (T006) and add a `y1` percent scale plus a dashed overlay dataset (`yAxisID: 'y1'`) to the `over-time` and `value` Chart.js configs when a comparison is active (depends on T006, T010).
- [x] T016 [US1] Add the overlay's legend entry ("Asset (% no período)") and tint the `y1` axis ticks in the asset's color (depends on T015).
- [x] T017 [US1] Persist/restore the selection via `localStorage` keyed `profit_compare_asset_${chart}`, mirroring the existing `TIMEFRAME_STORAGE_KEY` pattern (`ProfitTab.tsx:16,34-37,75-78`); fall back to "Nenhum" when the stored `coinId` is no longer held (depends on T015).
- [x] T018 [US1] Route all new copy in `AssetCompareControl`/`ProfitTab` through the T003/T004 i18n keys, replacing any literal strings (depends on T003, T004, T014, T015).

**Checkpoint**: Story 1 fully functional and testable independently.

---

## Phase 4: User Story 2 - Scan every asset's period performance in one list (Priority: P1) 🎯 MVP

**Goal**: A searchable, sortable, scrollable list of every held asset with a sparkline, price, and period % change, below the Profit/Value chart; clicking a row opens a dedicated full chart for that asset.

**Independent Test**: Load the Profit tab with a small and a large (30+) portfolio, confirm the list renders/searches/sorts/scrolls identically in shape, follows the chart's timeframe, and that a row click opens the asset's detail chart.

### Tests for User Story 2

- [x] T019 [P] [US2] Component test for `AssetsOverTimeList` in `web/src/components/AssetsOverTimeList.test.tsx`: one row per held asset with icon/name/sparkline/price/%; search filters rows by name/symbol; sort reorders by biggest-movement, alphabetical, and allocation; rows scroll inside a fixed-height container; an empty search shows an empty state; an asset with no price history for the period renders the existing empty-state row instead of a blank sparkline (FR-013).
- [x] T020 [P] [US2] Component test for `AssetDetailChart` in `web/src/components/AssetDetailChart.test.tsx`: opens showing the clicked asset's series for the active timeframe; closes on dismiss.

### Implementation for User Story 2

- [x] T021 [P] [US2] Add a lightweight inline-SVG sparkline renderer (per research.md §3) as a small helper inside `web/src/components/AssetsOverTimeList.tsx` (no new charting dependency).
- [x] T022 [US2] Create `AssetsOverTimeList.tsx` in `web/src/components/AssetsOverTimeList.tsx`: header (search input + sort dropdown), fixed-height scrollable row list built from `computeAssetPeriodSeries` (T006), colored via the T010 palette helper (depends on T006, T010, T021).
- [x] T023 [US2] Create `AssetDetailChart.tsx` in `web/src/components/AssetDetailChart.tsx` — a modal/overlay (matching the existing drawer pattern used by `OpDrawer`, including its dialog role, focus trap, and close-button `aria-label`) rendering one asset's full chart for the active timeframe.
- [x] T024 [US2] Wire an `AssetsOverTimeList` row click to open `AssetDetailChart` for that asset (depends on T022, T023).
- [x] T025 [US2] Mount `AssetsOverTimeList` below the chart area in `ProfitTab.tsx`, following the tab's existing timeframe state (depends on T022).
- [x] T026 [US2] Add `aria-label`s to the search input and sort control, and route all list/detail-chart copy through the T003/T004 i18n keys (depends on T003, T004, T022, T023).

**Checkpoint**: Stories 1 and 2 both fully functional independently — this is the MVP slice.

---

## Phase 5: User Story 3 - Understand a day's profit result at a glance (Priority: P2)

**Goal**: Hovering the Profit-over-time chart shows the exact 1d tooltip (date/weekday, colored cumulative profit, day delta, Realizado/Não realizado/Operações no dia) with no per-asset list, while Components A/B highlight that day's per-asset contribution.

**Independent Test**: Hover points on the Profit chart and verify every tooltip field and the absence of per-asset text; with US1/US2 present, verify hovering highlights the matching day's contribution in the overlay/list.

### Tests for User Story 3

- [x] T027 [P] [US3] Test the new tooltip DOM output in `web/src/components/ProfitTab.test.tsx`: date+weekday, colored cumulative profit, day delta (R$ and %), Realizado/Não realizado/Operações no dia rows present, and no per-asset symbol text anywhere in the tooltip.
- [x] T028 [P] [US3] Test that hovering a day updates the lifted hover-day state and that `AssetCompareControl`/`AssetsOverTimeList` reflect that day's `assetContribution` values.

### Implementation for User Story 3

- [x] T029 [US3] Build the shared HTML-tooltip DOM helper (per research.md §2) in `web/src/components/ProfitTab.tsx` rendering the 1d layout from a `DaySnapshot` (T005).
- [x] T030 [US3] Wire the Profit-over-time chart's `tooltip.external` to the T029 helper, replacing the current `callbacks.label` tooltip at `ProfitTab.tsx:143` (depends on T029).
- [x] T031 [US3] Lift hovered-day state into `ProfitTab.tsx` (set via the chart's hover/`tooltip.external` callback) and pass it to `AssetCompareControl` and `AssetsOverTimeList` (depends on T015, T022, T030).
- [x] T032 [US3] Add the hovered-day highlight styling in `AssetCompareControl`/`AssetsOverTimeList`, driven by the passed-in day's `assetContribution` (depends on T031).

**Checkpoint**: Stories 1–3 functional; US3's tooltip scenario is independently testable, its hover-sync scenario exercises US1/US2 per FR-010.

---

## Phase 6: User Story 4 - Understand current value vs. invested at a glance (Priority: P2)

**Goal**: Hovering the Portfolio-value chart shows current value, invested amount, a highlighted unrealized-result block, and the day's variation.

**Independent Test**: Hover points on the Portfolio-value chart and verify every tooltip field and its color-by-sign behavior.

### Tests for User Story 4

- [x] T033 [P] [US4] Test the value-chart tooltip DOM output in `web/src/components/ProfitTab.test.tsx`: Valor atual / Investido rows with their existing series swatches, highlighted Resultado não realizado block (R$ and %, colored by sign), Variação no dia row.

### Implementation for User Story 4

- [x] T034 [US4] Build the value-chart tooltip layout reusing the T029 DOM-helper pattern (depends on T029).
- [x] T035 [US4] Wire the Portfolio-value chart's `tooltip.external` to the T034 layout, replacing the current `callbacks.label` tooltip at `ProfitTab.tsx:162` (depends on T034).

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T036 [P] Update `web/src/components/skeleton/ProfitSkeleton.tsx` with loading placeholders for the new overlay control and asset list, if their absence during load is visually jarring.
- [x] T037 Run `cd web && npm run coverage` and close any gap below 90% on every file touched by T005–T035.
- [x] T038 Run `cd backend && pytest` (sanity check — no backend changes expected) and `cd web && npm test`; fix all failures.
- [x] T039 Execute the quickstart.md manual verification checklist against the running dev server for all four stories plus the regression check (By-asset chart, currency switching, balance masking, allocation bars); explicitly confirm the new overlay/tooltip colors match the existing teal/periwinkle/green/red usage (FR-012).
- [x] T040 Re-run the T011 mobile build-check now that all `shared/` changes are final.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup's i18n keys existing (T003) only for T018/T026-type wiring later; T005/T006/T007/T008/T009/T010/T011 have no Setup dependency and can start immediately in parallel with Phase 1.
- **User Stories (Phase 3–6)**: All require Foundational (Phase 2) complete for their shared-calculation dependencies (T005–T007, T010).
- **Polish (Phase 7)**: Depends on all four stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Independently testable.
- **US2 (P1)**: Depends only on Foundational. Independently testable — no dependency on US1; the color-palette helper both stories use lives in Foundational (T010), not in either story's phase.
- **US3 (P2)**: Depends on Foundational for its tooltip-content scenario (independently testable on its own). Its hover-sync scenario (FR-010) additionally depends on US1 (T015) and US2 (T022) existing, per the confirmed Clarification that sync is required now, not deferred.
- **US4 (P2)**: Depends only on Foundational and the T029 helper built in US3's phase (shared DOM-tooltip pattern) — no dependency on US1/US2.

### Parallel Opportunities

- T001–T004 (Setup) can all run in parallel.
- T005, T006, T008, T009, T010 (Foundational) can run in parallel; T007 depends on T005+T006; T011 depends on T005.
- Within US1: T012, T013, T014 are parallel; T015 depends on T006+T010.
- Within US2: T019, T020, T021 are parallel; T022 depends on T006+T010+T021.
- Across stories: once Foundational is done, US1 and US2 can be built fully in parallel by different sessions/developers — neither reads the other's files.

---

## Parallel Example: Foundational

```bash
Task: "Extend TimelinePoint in shared/src/portfolio.ts's computeTimeline with DaySnapshot fields"
Task: "Add computeAssetPeriodSeries to shared/src/portfolio.ts"
Task: "Tests for the extended computeTimeline in shared/src/portfolio.test.ts"
Task: "Tests for computeAssetPeriodSeries in shared/src/portfolio.test.ts"
```

## Parallel Example: User Story 1

```bash
Task: "Component test for AssetCompareControl in web/src/components/AssetCompareControl.test.tsx"
Task: "ProfitTab.test.tsx additions for overlay wiring"
Task: "Create AssetCompareControl.tsx in web/src/components/AssetCompareControl.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) and Phase 4 (US2) — both P1, both independently testable — this is the MVP: the comparison overlay and the asset list.
3. **STOP and VALIDATE**: run T012/T013/T019/T020 plus the relevant quickstart.md checks.

### Incremental Delivery

1. Setup + Foundational → shared calculations ready.
2. US1 → validate independently (overlay works, persists, replaces cleanly).
3. US2 → validate independently (list works, search/sort/scroll, detail chart opens).
4. US3 → validate tooltip content independently, then validate hover-sync against US1/US2.
5. US4 → validate independently.
6. Polish (Phase 7) → coverage, full test suite, quickstart walkthrough, mobile build-check.

## Notes

- [P] tasks touch different files with no unmet dependency.
- Tests are written before their corresponding implementation tasks within each story, per the constitution's Behavior Coverage principle.
- Every new/changed `shared/` export must appear in `shared/src/index.ts` (T007) per the constitution's Shared-First Architecture principle.
- No backend changes are in scope for this feature — T038's `pytest` run is a regression sanity check, not new backend test coverage.

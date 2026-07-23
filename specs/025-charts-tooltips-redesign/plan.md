# Implementation Plan: Per-Asset Charts & Enriched Tooltips

**Branch**: `feat/charts-tooltips-redesign` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-charts-tooltips-redesign/spec.md`

## Summary

Add a single-asset dual-axis comparison overlay and a sortable/searchable per-asset list to the Profit tab's existing charts, and enrich the Profit-over-time and Portfolio-value hover tooltips with a realized/unrealized/day-delta breakdown — all sourced from the imported Claude Design handoff "Handoff - Gráficos por Ativo e Tooltips.dc.html". The work is entirely additive on top of `web/`'s existing Chart.js-based `ProfitTab.tsx`; new per-day and per-asset derived calculations are added to `shared/src/portfolio.ts` so both the overlay/list and the tooltips read from one source of truth, per the Shared-First Architecture principle.

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: `chart.js` 4.5.1 (already the only charting library in `web/`; the handoff's dual-axis overlay and enriched tooltips are implemented as Chart.js scale/plugin configuration — no new charting library is introduced), `@tanstack/react-router`, existing `@crypto-assist/shared` calculations

**Storage**: N/A — reads existing price/op data already fetched by `ProfitTab.tsx` (`api.getPriceHistory`, `prices`, `ops`, `closures`); no new backend endpoints or schema changes

**Testing**: Vitest + Testing Library (`web/src/**/*.test.tsx`), plus `shared/src/*.test.ts` alongside any new `shared/src/portfolio.ts` functions

**Target Platform**: Web browser (Vite SPA), Profit tab only

**Project Type**: Web frontend feature inside the existing `web/` + `shared/` monorepo packages; no `backend/` or `mobile/` changes required by this feature, but `shared/` type/function changes must keep `mobile/` building per the constitution

**Performance Goals**: No new performance targets beyond existing chart responsiveness; the asset list must stay smooth (no visible jank) scrolling 30+ rows, satisfying SC-003

**Constraints**: Must reuse `chart.js` and existing i18n/currency/locale layers (`useLocale`, `useCurrency`) — no new charting or state-management dependency; all new UI strings go through `t.*` per the i18n principle; every new interactive/non-button element needs an `aria-label`

**Scale/Scope**: Portfolios ranging from a couple of assets to several dozen (per SC-003); single feature area (Profit tab) — Wallet/History tabs are unaffected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture**: New derived calculations (per-day realized/unrealized/operation-count breakdown, per-asset normalized % series, per-day per-asset contribution) go into `shared/src/portfolio.ts`, not duplicated in `web/`. No mobile screen currently imports `computeTimeline`/`computeProfitByAsset`, but mobile MUST still build after the `TimelinePoint` shape changes (verified in Phase 1/tasks, not skipped because "mobile doesn't use it today"). PASS (with follow-through required at implementation time).
- **II. Security at the Boundary**: No new inputs cross the API boundary; all data is already-fetched client-side portfolio data. Search/sort in the asset list operate over local state only. PASS.
- **III. Behavior Coverage Over Line Coverage**: New `shared/` functions require `shared/src/*.test.ts` covering happy path + edge cases (single-data-point %, no price data, zero operations) identified in spec.md's Edge Cases. `ProfitTab.tsx` changes and new components require `web/src/components/*.test.tsx` covering overlay selection/clear, list search/sort, tooltip field rendering, and the new dedicated per-asset chart view. PASS (planned in tasks).
- **IV. No Speculative Code**: Scope is bounded to the four handoff pieces confirmed in Clarifications — no extra chart types, no new asset classes (BR stocks, item 19, are out of scope), no backend changes. PASS.
- **V. Accessibility and Internationalisation**: New controls ("Compare with" radio group, search input, sort dropdown, asset list rows, dedicated chart view) need labels/`aria-label`s and route all copy through `t.*`. PASS (planned in tasks).

No violations requiring the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```text
specs/025-charts-tooltips-redesign/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
shared/
├── src/
│   ├── portfolio.ts          # extend TimelinePoint; add asset % series, per-day per-asset contribution
│   ├── portfolio.test.ts     # new/updated tests for the above (co-located per existing convention)
│   └── index.ts               # export any new types/functions

web/
├── src/
│   ├── components/
│   │   ├── ProfitTab.tsx              # dual-axis overlay wiring, enriched tooltips, mounts the asset list
│   │   ├── ProfitTab.test.tsx         # updated coverage
│   │   ├── AssetCompareControl.tsx    # new: "Compare with" radio/segmented control (Component A)
│   │   ├── AssetsOverTimeList.tsx     # new: searchable/sortable asset list (Component B)
│   │   ├── AssetsOverTimeList.test.tsx
│   │   ├── AssetDetailChart.tsx       # new: dedicated full chart view opened from a list row
│   │   └── AssetDetailChart.test.tsx
│   └── lib/
│       └── format.ts                  # reused for currency/percent formatting; no changes expected unless a gap is found
```

**Structure Decision**: Single existing web app (`web/`) plus its `shared/` dependency — no new package, no backend or mobile changes. New components live alongside `ProfitTab.tsx` under `web/src/components/`, following the existing flat component-per-file convention (see `TimeframeSelector.tsx`, `MetricCard.tsx`); shared derived-data functions extend the existing `shared/src/portfolio.ts` rather than introducing a new module, since they operate on the same `Op`/`OpClosure`/`Prices` inputs already defined there.

## Complexity Tracking

*No Constitution Check violations — table not applicable.*

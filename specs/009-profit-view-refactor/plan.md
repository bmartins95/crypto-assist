# Implementation Plan: Profit View Redesign

**Branch**: `feat/profit-view-refactor` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-profit-view-refactor/spec.md`

## Summary

Redesign `web/src/components/ProfitTab.tsx` (the `/profit` route) to match the pattern
item 7 established for `/wallet`: a `<ContentHeader>` with refresh action, four
`<MetricCard>`s, and a text-only chart-mode segmented control. The functional gap is
larger than the plan item's original text suggested — the existing realized/unrealized
P/L math double-counts cost basis and has no concept of a "closed position" — so this
item adds a new shared function, `computeProfitByAsset`, to `shared/src/portfolio.ts`
and rewires the metric cards, "By asset" chart, and allocation panel to use it. Also
strips the icon from the segmented-control options in both `ProfitTab.tsx` and
`WalletTab.tsx`.

## Technical Context

**Language/Version**: TypeScript (strict), React 19

**Primary Dependencies**: Vite, TanStack Router, `chart.js` (already a dependency — no
new charting library added, see research.md R1), Vitest + Testing Library

**Storage**: N/A — reads from in-memory `ops`/`prices` already fetched by `AppLayout`'s
`usePortfolio()` hook; no backend or database change

**Testing**: `cd web && npm test` (Vitest); coverage via `npm run coverage`; new shared
logic tested in `web/src/lib/portfolio.test.ts` (existing convention, see research.md R6)

**Target Platform**: Web (Vite SPA), desktop and mobile browser widths

**Project Type**: Web application (monorepo: `shared/` + `web/` touched; `mobile/` and
`backend/` untouched by this item)

**Performance Goals**: N/A beyond existing app baseline — pure client-side recomputation
of already-loaded data, no new network calls

**Constraints**: No new npm dependencies (Constitution IV); no changes to `Op`/`Asset`
types in `shared/src/types.ts`; must not regress `WalletTab`'s existing grouping
behavior while removing its icons

**Scale/Scope**: Two components (`ProfitTab.tsx`, `WalletTab.tsx`), one new shared
function + tests, one new i18n key across 10 locale files, one route prop threading
change (`router.tsx`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture**: PASS. New `computeProfitByAsset` logic goes in
  `shared/src/portfolio.ts` and is exported from `shared/src/index.ts`; `web/` consumes
  it via the existing `@crypto-assist/shared` re-export in `web/src/lib/portfolio.ts`.
  No mobile screen consumes `ProfitTab`, so mobile parity is not implicated — confirmed
  by grepping `mobile/src` for `ProfitTab`/`computeProfitByAsset` usage (none).
- **II. Security at the Boundary**: PASS (N/A). No new inputs cross the API boundary;
  this item is pure frontend presentation and client-side computation over data already
  fetched through existing, already-validated endpoints.
- **III. Behavior Coverage Over Line Coverage**: PASS, enforced in Phase 2 tasks —
  `computeProfitByAsset` gets happy-path + edge-case tests (closed-only, open-only,
  mixed, zero-price, tie) in `web/src/lib/portfolio.test.ts`; `ProfitTab.test.tsx` and
  `WalletTab.test.tsx` get updated/new tests for the header, metric cards, icon removal,
  and empty states.
- **IV. No Speculative Code**: PASS. Reuses `ContentHeader`/`MetricCard`/`chart.js`
  rather than introducing new abstractions or dependencies (research.md R1, R4, R5).
- **V. Accessibility and Internationalisation**: PASS, enforced in tasks — new
  `profit_subtitle` key added to `UIText` and all 10 locale files; refresh button already
  has visible text (`t.wallet_updatePrices`, reused) so no missing `aria-label`.

No violations. Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/009-profit-view-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
├── portfolio.ts          # + computeProfitByAsset
├── portfolio.test.ts      # (unaffected — repo convention tests this from web/)
├── i18n/
│   ├── types.ts           # + profit_subtitle key
│   └── locales/*.ts       # + profit_subtitle in all 10 locale files
└── index.ts                # already re-exports portfolio.ts's public surface

web/src/
├── components/
│   ├── ProfitTab.tsx       # ContentHeader + MetricCard + icon removal + new data source
│   ├── ProfitTab.test.tsx  # rewritten realized-P/L test + new coverage
│   ├── WalletTab.tsx       # icon removal only (chart-switcher)
│   └── WalletTab.test.tsx  # icon-removal assertion added
├── lib/
│   └── portfolio.test.ts   # + computeProfitByAsset tests
└── router.tsx               # ProfitRoute: thread statusMsg + onFetchPrices props
```

**Structure Decision**: Existing monorepo layout (`shared/` + `web/`) is unchanged; no
new directories. All work lands inside files that already exist for this exact purpose.

## Complexity Tracking

*No violations — table omitted.*

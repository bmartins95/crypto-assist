# Implementation Plan: History View Redesign with Entry Drawer

**Branch**: `feat/history-view-refactor` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-history-view-refactor/spec.md`

## Summary

Redesign `web/src/components/HistoryTab.tsx` (the `/history` route) to match the pattern
items 7-8 established for `/wallet` and `/profit`: a `<ContentHeader>` with a primary
action, and no always-visible form. The two always-visible forms (Buy/Sell, Trade) are
extracted into a new `web/src/components/OpDrawer.tsx` — a right-side slide-over with a
Buy/Sell/Trade type selector, reusing the existing `.seg-ctrl` segmented-control pattern,
`.tbl.scroll` table styling, and `.icon-btn` row actions already established by prior
items. The drawer implements focus trap, Escape/backdrop close, and body-scroll lock with
plain DOM APIs (no new dependency). The one deliberate behavior change (per
`docs/design/dashboard-refactor-notes.md` §6.1, the authoritative design source for this
item): the Buy/Sell fieldset's Total field becomes read-only/auto-calculated, replacing
the current unit/total entry toggle. Trade computation logic (`syncTradeTotal`,
`handleAddTrade`) is relocated into the drawer unchanged.

## Technical Context

**Language/Version**: TypeScript (strict), React 19

**Primary Dependencies**: Vite, TanStack Router, Vitest + Testing Library. No new
dependency — focus trap and body-scroll lock are implemented with plain DOM APIs
(research.md R5).

**Storage**: N/A — reads/writes `ops` via the existing `usePortfolio()` hook's
`addOp`/`editOp`/`removeOp` callbacks already wired through `AppLayout.tsx` and
`router.tsx`'s `HistoryRoute`; no backend or database change.

**Testing**: `cd web && npm test` (Vitest); coverage via `npm run coverage`. New
`OpDrawer.test.tsx` covers open/close, type switching, focus trap, Escape/backdrop close,
Buy/Sell/Trade submission, and edit pre-fill. `HistoryTab.test.tsx` updated for the new
header + table-only structure.

**Target Platform**: Web (Vite SPA), desktop and mobile browser widths.

**Project Type**: Web application (monorepo: only `web/` and `shared/src/i18n/` touched
by this item; `mobile/` and `backend/` untouched).

**Performance Goals**: N/A beyond existing app baseline — pure client-side UI
restructuring, no new network calls.

**Constraints**: No new npm dependencies (Constitution IV); no changes to
`Op`/`NewOp`/`Asset` in `shared/src/types.ts`; must preserve the existing Trade
computation semantics (`syncTradeTotal`/`handleAddTrade`) and existing edit/delete
behavior for individual ops.

**Scale/Scope**: One new component (`OpDrawer.tsx`) + its test file, one rewritten
component (`HistoryTab.tsx`) + its test file, one new i18n key (`history_subtitle`)
across 10 locale files, CSS additions to `globals.css` (`.drawer*`, `.trade-block*`,
`.trade-arrow`, `.fhint`, `.tag`, `.btn-accent`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture**: PASS. No new cross-package logic is introduced —
  this item is pure `web/` presentation over the existing `Op`/`NewOp`/`Asset` shapes and
  existing `usePortfolio()` callbacks. `mobile/` does not consume `HistoryTab` or
  `OpDrawer` (confirmed by grepping `mobile/src` for both names — no results), so mobile
  parity is not implicated.
- **II. Security at the Boundary**: PASS (N/A). No new inputs cross the API boundary;
  `onAddOp`/`onEditOp`/`onRemoveOp` are unchanged, already-validated callbacks.
- **III. Behavior Coverage Over Line Coverage**: PASS, enforced in Phase 2 tasks —
  `OpDrawer.test.tsx` covers happy paths (Buy, Sell, Trade submission, edit pre-fill) and
  edge/error paths (missing fields, same-asset trade rejected, Escape/backdrop/Cancel
  discard changes, focus trap, body-scroll lock). `HistoryTab.test.tsx` updated for the
  header-plus-table-only structure and empty state.
- **IV. No Speculative Code**: PASS. Reuses `.seg-ctrl`/`.seg-btn`, `.tbl`, `.chead`,
  `.icon-btn`, `.empty-state` rather than introducing parallel abstractions
  (research.md R2); no new npm dependency for focus trap (research.md R5); Trade
  computation logic is moved, not rewritten (research.md R4).
- **V. Accessibility and Internationalisation**: PASS, enforced in tasks — drawer gets
  `role="dialog" aria-modal="true" aria-labelledby`; every drawer `<input>`/`<select>`
  keeps an associated `<label>` (carried over from the existing form markup); one new
  i18n key (`history_subtitle`) added to `UIText` and all 10 locale files; all other
  drawer copy reuses existing `history_form_*`/`trade_form_*` keys (research.md R6).

No violations. Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-history-view-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/src/
├── i18n/
│   ├── types.ts           # + history_subtitle key
│   └── locales/*.ts       # + history_subtitle in all 10 locale files
└── index.ts                # unaffected — no new exports needed

web/src/
├── components/
│   ├── OpDrawer.tsx        # new — drawer shell, type selector, both fieldsets,
│   │                       #   focus trap, scroll lock, Escape/backdrop close
│   ├── OpDrawer.test.tsx   # new — open/close, type switch, submit x3, edit prefill
│   ├── HistoryTab.tsx      # rewritten — ContentHeader + table + <OpDrawer>, form
│   │                       #   state and coin-search wiring moved into OpDrawer
│   └── HistoryTab.test.tsx # updated — header/button/table assertions, drawer trigger
└── app/globals.css          # + .drawer, .drawer-backdrop, .drawer-head, .drawer-body,
                              #   .drawer-foot, .drawer-grid, .trade-block(.out/.in),
                              #   .trade-arrow, .fhint, .tag, .btn-accent
```

**Structure Decision**: Existing monorepo layout (`shared/` + `web/`) is unchanged; no
new directories. `router.tsx`'s `HistoryRoute` needs no prop changes — it already passes
`ops`, `assets`, `prices`, `onAddOp`, `onEditOp`, `onRemoveOp` to `HistoryTab`, which is
exactly what `OpDrawer` needs once relocated one level down.

## Complexity Tracking

*No violations — table omitted.*

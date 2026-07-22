# Implementation Plan: Wallet vs. Trade Operation Refactor

**Branch**: `feat/wallet-trade-refactor` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-wallet-trade-refactor/spec.md`

## Summary

Split every recorded operation into one of two classifications — `wallet` (Buy/Sell/Swap of assets the
user holds) or `trade` (leveraged long/short speculative position) — replacing item 26's one-size-fits-all
model where any Buy/Sell could carry a status and a close action. Wallet Sell/Swap stop using the
`op_closures` link mechanism entirely: balance, average cost, and realized P/L are derived via
first-in-first-out (FIFO) matching over the asset/platform's wallet operation history. Trade operations
keep item 26's `op_closures`/status/close mechanism unchanged, but the close side is now locked to
whichever type resolves the position's direction (short→Buy, long→Sell only, no Swap). History gains two
entry points ("Move wallet" / "New trade") instead of one, wallet rows lose their status/close column,
trade rows gain a direction label and visual marker, and item 27's cycle tag + floating summary ships as
part of this feature, rescoped to trade rows only (`shared/src/cycles.ts`, `CyclePopover.tsx`). Editing or
deleting a wallet operation that a later operation's FIFO-derived balance depends on triggers a recompute,
a confirmation dialog (reusing the existing `ConfirmDialog` component), and is blocked outright if it would
produce a negative balance at any later date. `computePositions`/`computeProfitByAsset` are updated to
exclude trade-classified operations, per spec clarification. An additive migration adds `op_kind`/`side`
columns and, in the same backfill pass, classifies pre-existing operations and removes any `op_closures`
row that would otherwise dangle off a newly-wallet-classified operation.

## Technical Context

**Language/Version**: TypeScript (web/shared), Python 3.12 (backend)

**Primary Dependencies**: FastAPI + Mangum (backend), Vite + React + TanStack Router (web), pure TS
(shared) — all fixed by the constitution; no new dependency needed

**Storage**: AWS RDS Aurora (PostgreSQL) via `backend/app/db/postgres_client.py`; additive migration
(`op_kind`, `side` columns) plus a `.py` migration for the classification/cleanup backfill, mirroring item
22's `011_backfill_platform_fields.py` pattern (SQL migrations can't express the catalog/closure-lookup
logic the backfill needs)

**Testing**: `pytest` (backend, `cd backend && pytest`), Vitest + Testing Library (web, `cd web && npm
test`)

**Target Platform**: AWS Lambda (backend, via SST), browser SPA (web); mobile has no History screen and
is unaffected beyond the shared type contract (`kind`/`side` additions to `Op`/`NewOp` must not break the
mobile build)

**Project Type**: Web application (existing `backend/` + `web/` + `shared/` monorepo, no new project)

**Performance Goals**: No new performance target; FIFO balance/avg-cost derivation walks one user's own
operations for a single asset+platform pair (small, bounded set), matching the existing
`computePositions`/`computeProfitByAsset` derive-on-read pattern

**Constraints**: Additive-only migration; no new npm/pip package; `shared/` changes must not break the
mobile type contract; the edit/delete recompute confirmation must use the existing `ConfirmDialog`
component (`web/src/components/ConfirmDialog.tsx`), not `window.confirm`, per this repo's established
preference against native browser dialogs in this app's UI

**Scale/Scope**: Single-user-scoped queries (`WHERE user_id = %s`, existing pattern); FIFO recompute and
cycle derivation both operate on one user's own operation history for a bounded asset/platform pair or
`op_closures` connected component, not a cross-user or bulk operation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture**: New cross-package logic (`kind`/`side` on `Op`/`NewOp`, the FIFO
  balance/avg-cost/realized-P/L derivation, `computeCycles`) lands in `shared/src/` (new
  `shared/src/walletFifo.ts` and `shared/src/cycles.ts`, plus additions to `shared/src/types.ts` and
  `shared/src/portfolio.ts`), exported from `shared/src/index.ts`. `web/` consumes it; mobile is
  unaffected but must still build against the widened `Op`/`NewOp` shape. **PASS**.
- **II. Security at the Boundary**: `backend/app/models.py`/`routes/ops.py` validate `kind`/`side`/
  `leverage` combinations server-side (leverage only valid when `kind: 'trade'`; classification immutable
  on edit — rejected with 400, not silently ignored). `routes/op_closures.py` enforces the locked close
  side server-side rather than trusting the client to only submit the correct type. **PASS**.
- **III. Behavior Coverage Over Line Coverage**: Plan includes explicit test tasks for the happy path
  (wallet Buy/Sell/Swap with correct FIFO balance, trade open/close), primary error paths (over-balance
  wallet sell rejected, over-close trade rejected, leverage-on-wallet rejected, classification-change-on-
  edit rejected, negative-balance-producing edit/delete blocked), and the edge cases the spec names
  (pre-existing leveraged ops migrating correctly, pre-existing non-leveraged closures being cleaned up,
  multi-entry cycle fallback). **PASS** (enforced in Tasks phase).
- **IV. No Speculative Code**: Reuses the existing `ConfirmDialog` component rather than building a new
  one; reuses item 26's `op_closures`/status/close machinery for trades rather than rebuilding it; no new
  abstraction beyond what the spec requires (e.g., no generic "ledger" framework — FIFO logic is scoped
  to wallet ops only, as today's `computePositions` is scoped to the data it actually needs). **PASS**.
- **V. Accessibility and Internationalisation**: New UI (two header buttons, wallet balance/Max card,
  trade direction label, cycle tag/popover) goes through `useLocale()`/`UIText` for every string; the
  cycle tag is keyboard-operable (`button`, opens on focus, closes on `Esc`) per the spec's User Story 4.
  **PASS** (enforced in Tasks phase).

No violations requiring the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```text
specs/024-wallet-trade-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── close-endpoint-delta.md   # what changes in POST /api/ops/{id}/close's contract
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── db/
│   └── migrations/
│       ├── 014_op_kind_and_side.sql            # new, additive: op_kind, side columns
│       └── 015_backfill_op_kind.py             # new: classify pre-existing ops, clean up
│                                                #      dangling op_closures on now-wallet ops
├── app/
│   ├── models.py                 # + kind, side; leverage validated as trade-only
│   └── routes/
│       ├── ops.py                 # classification-immutable-on-edit guard
│       └── op_closures.py         # locked-side enforcement (short→Buy, long→Sell only)
└── tests/
    ├── test_ops.py                 # + kind/side/leverage validation, immutability-on-edit
    └── test_op_closures.py         # + locked-side enforcement

shared/
└── src/
    ├── types.ts          # + kind, side on NewOp/Op
    ├── portfolio.ts       # computePositions/computeProfitByAsset exclude kind: 'trade'
    ├── walletFifo.ts      # new: computeWalletBalance, computeWalletRealizedPnl,
    │                      #      computeWalletEditImpact (recompute + negative-balance check)
    ├── cycles.ts           # new (folded from item 27): computeCycles, Cycle type — trade ops only
    ├── i18n/
    │   ├── types.ts    # + history_action_moveWallet/newTrade, wallet_*, trade_side_*, cycle_*
    │   └── locales/*.ts
    └── index.ts        # + new exports

web/
└── src/
    ├── lib/
    │   ├── walletFifo.test.ts    # new (per this repo's convention: shared-module tests live
    │   │                         #      under web/src/lib/, not shared/src/ — see project memory)
    │   └── cycles.test.ts        # new
    ├── components/
    │   ├── HistoryTab.tsx        # two header buttons, wallet/trade row split, collapsed Swap
    │   │                         #   rows, cycle tag, edit/delete recompute confirmation via
    │   │                         #   ConfirmDialog
    │   ├── HistoryTab.test.tsx
    │   ├── OpDrawer.tsx           # mode-dependent segmented control (wallet: Buy/Sell/Swap;
    │   │                         #   trade: Buy·Long/Sell·Short; close: locked single segment),
    │   │                         #   wallet balance/Max card, leverage restricted to trade mode
    │   ├── OpDrawer.test.tsx
    │   ├── CyclePopover.tsx       # new (folded from item 27)
    │   └── CyclePopover.test.tsx  # new
    ├── lib/api/client.ts          # no new endpoints; existing addOp/closeOp/updateOp carry kind/side
    └── app/globals.css            # Swap chip color, trade-row border marker, Long/Short label,
                                    #   wallet balance card, cycle tag/popover styles
```

**Structure Decision**: Existing monorepo layout (`backend/` + `shared/` + `web/`), no new top-level
project. Backend gets one additive migration plus one Python backfill migration and validation additions
to existing route modules — no new route module (item 26's `op_closures.py` is modified, not replaced).
Shared gets two new modules (`walletFifo.ts`, `cycles.ts`) plus additions to existing type/portfolio/i18n
files. Web modifies the two existing History/Drawer components and adds one new component
(`CyclePopover.tsx`, the one genuinely new piece of UI the spec requires — everything else is a
restructuring of existing panels/rows, not new surface area).

## Complexity Tracking

*No violations — table omitted.*

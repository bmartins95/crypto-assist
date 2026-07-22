# Phase 0 Research: Wallet vs. Trade Operation Refactor

All technology choices are fixed by the constitution (FastAPI/Postgres/React/TS) — no framework or
library research was needed. The items below are the concrete decisions needed to turn the spec's FIFO
wallet accounting and wallet/trade split into an implementable backend + frontend design.

## Decision: FIFO lot matching lives in a new `shared/src/walletFifo.ts`, derived on read like `computePositions`

**Rationale**: Matches this codebase's existing pattern — `computePositions`/`computeProfitByAsset`
(`shared/src/portfolio.ts`) are pure functions over the raw `ops` array, never persisted aggregates. A
wallet operation's available balance and average cost are computed the same way: walk a user's wallet
Buy/Sell/Swap operations for one asset+platform pair in chronological order, consuming Buy/Swap-in lots
oldest-first as later Sell/Swap-out operations draw against them. No new stored balance/lot table.

**Tie-break for chronological order**: same as item 26's `op_closures` allocation — `date` ascending,
then `created_at` ascending (existing column, stable, already the established tie-break in this codebase
for "oldest first" — see `specs/023-position-closing/research.md`).

**Alternatives considered**: Storing running balance/lot state per operation at write time — rejected,
would require every wallet write (create, edit, delete) to correctly maintain that state transactionally,
duplicating information already fully derivable from the operation log, and contradicting the "derive,
don't store" pattern already established for `computePositions`.

## Decision: `computePositions`/`computeProfitByAsset` filter to `kind: 'wallet'` at the top of each function

**Rationale**: Spec clarification (Session 2026-07-21, Q1) — trade positions must never contribute to
Wallet/Profit view calculations. The minimal change is an early filter (`ops.filter(o => o.kind ===
'wallet')`) inside both functions, not a new parameter threaded through every call site — call sites
already just pass the full `ops` array today and don't need to know about the wallet/trade split.

**Alternatives considered**: Filtering at each call site before passing `ops` in — rejected, every call
site would need the same filter repeated, and a future call site could easily forget it, silently
reintroducing trade P/L into portfolio figures.

## Decision: edit/delete impact detection walks forward from the edited operation's date, recomputing FIFO once

**Rationale**: FR-020/021 need to know, before applying an edit or delete, (a) which later operations'
derived figures change, and (b) whether any resulting balance would go negative. Since FIFO balance is
already computed as a pure function of the operation list, the check is: build the hypothetical post-edit
operation list, run the same FIFO derivation used for display, and compare the running balance at every
later date against zero. No separate "impact analysis" algorithm — it reuses `computeWalletBalance`'s
per-date running total that the display path already needs to compute anyway (exposed as
`computeWalletEditImpact(ops, editedOp, proposedChange)`, returning affected-later-op count + first
negative-balance date if any).

**Alternatives considered**: A dedicated dependency graph tracking which sells "belong to" which buy —
rejected, FIFO allocation is already a full re-walk of the list on every read in this codebase's style;
a graph would be a second representation of the same information with no derivation benefit at this
data scale (single user, bounded operation count).

## Decision: classification migration and `op_closures` cleanup run in one `.py` migration, in a fixed order

**Rationale**: Mirrors item 22's `011_backfill_platform_fields.py` pattern (a `.py` migration for logic
plain SQL can't express — here, "does this op have a closure link, and does its new classification make
that link legal"). Order within the single migration: (1) set `op_kind = 'trade'`, derive `side` from
`type`, for every op with `leverage > 1`; (2) everything else defaults to `op_kind = 'wallet'` (column
default, no per-row write needed); (3) delete every `op_closures` row whose `source_op_id` or
`closing_op_id` now points at a `wallet`-classified op (per spec clarification Q2) — done last, after
classification, so the query can simply join on the now-populated `op_kind` column.

**Alternatives considered**: Two separate migration files — rejected, the cleanup step is only correct
once classification has run, and splitting them risks a partial deploy where cleanup runs against
not-yet-classified rows if migration ordering is ever disturbed. One file with an internal, explicit
order is simpler and matches how `011`'s single-file catalog-lookup-then-write pattern already works.

## Decision: trade close's locked side is derived from `side`, enforced server-side in `op_closures.py`

**Rationale**: Spec FR-015 — a short (`side: 'short'`) closes only via Buy, a long (`side: 'long'`) only
via Sell. `POST /api/ops/{id}/close` already validates the closing op's `type` against the source op
today (item 26); this adds one more server-side check (`side == 'short' → closing type must be Buy`,
`side == 'long' → closing type must be Sell`) rejected with 400, matching this codebase's "never trust
client-supplied data" boundary-validation convention (constitution II) — the drawer UI locks the choice,
but the server does not trust the UI to have enforced it.

**Alternatives considered**: Deriving the allowed close type purely from the source op's own `type`
(Buy source → close type Sell) without a `side` field at all — rejected, `side` is the more direct,
readable representation the spec and design reference both use ("a short closes with a Buy"), and is
needed anyway for display (History's Long/Short label, the close panel's locked-segment microcopy).

## Decision: `computeCycles` (folded from item 27) filters to `kind: 'trade'` before building the graph

**Rationale**: Item 27's original design built cycles from the full `op_closures` graph. Since wallet
Sell/Swap no longer produce `op_closures` rows at all after this feature (decision above), and any
pre-existing closure rows on now-wallet ops are deleted by the migration, `computeCycles` naturally only
ever encounters trade-classified ops in practice — but filtering explicitly at the top of the function
(rather than relying on the data always being clean) keeps the function correct even if fed a raw,
unfiltered `ops`/`closures` pair from a caller, avoiding a subtle bug in a future caller.

**Alternatives considered**: No explicit filter, relying on the migration to have already removed all
non-trade closures — rejected, correctness of a pure derivation function should not depend on an
assumption about a one-time migration having already run cleanly; the filter is one line and removes
that assumption entirely.

## Decision: migration files are `014_op_kind_and_side.sql` and `015_backfill_op_kind.py`

**Rationale**: `backend/db/migrations/` currently ends at `013_trade_group_id.sql` (item 26's follow-up
migration); `014`/`015` are the next sequential numbers, following the existing `NNN_description.{sql,py}`
convention.

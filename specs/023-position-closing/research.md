# Phase 0 Research: Position Closing, Leverage, and History Day-Grouping

All technology choices are fixed by the constitution (FastAPI/Postgres/React/TS) — no framework or
library research was needed. The items below are the concrete decisions needed to turn the spec's
"same asset + platform + currency, oldest-open-first" rule into an implementable, race-safe backend
and a derivable frontend status calculation.

## Decision: `op_closures` as an explicit link table, not a column on `ops`

**Rationale**: A single close can span multiple older open operations (spec FR-008), and a single
open operation can be closed piecemeal by several later operations over time (spec User Story 1,
Acceptance Scenario 3). Neither is representable with a single `parent_op_id` column on `ops`. A
join table (`source_op_id`, `closing_op_id`, `qty_closed`, `realized_pnl`) supports both without a
schema change later.

**Alternatives considered**: A single nullable `closes_op_id` column on `ops` — rejected, cannot
represent a close spanning multiple sources or a source closed by multiple later ops without adding
a second linking mechanism anyway.

## Decision: realized P/L is computed and frozen at closure-creation time, price-only (no fee blending)

**Rationale**: Matches the existing style of `shared/src/portfolio.ts`'s `computeProfitByAsset`,
which computes `realizedPnl` from `qty * (sellPrice - avgCost)` without folding `fee` into the P/L
math (fee is tracked and displayed as its own column, never blended into P/L anywhere in the current
codebase). Freezing at creation time (rather than recomputing from live prices) matches the design
reference, where a closed row's `pnl` is a fixed historical value, not something that moves later.

**Formula**: for a closure of `qtyClosed` between a source op (price `sourcePrice`) and a closing op
(price `closingPrice`), `realizedPnl = qtyClosed * (sellPrice - buyPrice)` where `sellPrice`/`buyPrice`
are whichever of the two legs is the Sell vs the Buy (order-independent of which one is "source" vs
"closing" — a Sell closing an open Buy and a Buy closing an open Sell use the same formula).

**Alternatives considered**: Recomputing realized P/L live from current market price on every read —
rejected, contradicts "realized" (a closed lot's P/L should not fluctuate with today's price; that's
what the existing unrealized-P/L machinery in the Profit tab already does).

## Decision: oldest-open-first tie-break is `date` ascending, then `created_at` ascending

**Rationale**: The spec (FR-008) requires deterministic "oldest first" allocation across multiple
source ops. `ops.date` is a user-entered calendar date, not a timestamp, so two ops recorded on the
same day need a secondary key. `created_at` (already a column, populated by `DEFAULT now()`) gives a
stable, existing tie-break with no new column.

**Alternatives considered**: Ordering by `id` (UUID) — rejected, UUIDs are not chronologically
sortable in this schema (no UUIDv7), so it would be an arbitrary tie-break rather than a meaningful
one.

## Decision: status/remaining-qty is derived client-side from `ops` + `op_closures`, not stored

**Rationale**: Matches the existing pattern where `computePositions`/`computeProfitByAsset` are pure
functions over the raw `ops` array rather than server-persisted aggregates. Keeping status derived
(not a stored column) avoids a second source of truth that could drift from the closure rows.

**Alternatives considered**: A stored `status` column on `ops`, updated by the close endpoint —
rejected, requires the close endpoint to also correctly update every previously-affected row's status
in the same transaction (more surface area for a bug) for no benefit over deriving it, given the
existing op list per user is small enough that client-side derivation is already how every other
aggregate (`computePositions`, `computeProfitByAsset`) works in this codebase.

## Decision: closures exposed via a new `GET /api/op-closures` endpoint, not joined into `GET /api/ops`

**Rationale**: `GET /api/ops` already has a stable, tested response shape (`list[Op]`) consumed by
several call sites (`HistoryTab`, `WalletTab`, `ProfitTab`). Adding a second, small, purpose-specific
endpoint avoids widening that shape for every consumer when only `HistoryTab` needs closure data,
consistent with "No Speculative Code" (don't change a shared response shape for one new caller).

**Alternatives considered**: Embedding `closures: OpClosure[]` on each `Op` — rejected, would require
every existing `GET /api/ops` caller (and every existing test asserting the `Op` shape) to account for
a field they don't use.

## Decision: the close endpoint takes a row-level lock on candidate source ops within its transaction

**Rationale**: `backend/app/routes/ops.py`'s existing routes never use `SELECT ... FOR UPDATE` because
none of them need to read-then-conditionally-write based on other rows' current state. The close
endpoint does (it computes remaining open quantity from `ops` + `op_closures`, then decides how much
it may allocate) — without a lock, two concurrent closes against the same open operation could each
read the same "remaining quantity" and together over-allocate past what's actually available,
violating FR-009. `SELECT ... FOR UPDATE` on the candidate source `ops` rows for the duration of the
transaction is the minimal fix, using the same `psycopg` connection/transaction pattern every other
route already uses (no new locking primitive, no advisory lock — unrelated to the existing
migration-time advisory lock in `postgres_client.py`).

**Alternatives considered**: Optimistic retry (re-check after insert, roll back on conflict) —
rejected as unnecessary added complexity for a single-user-scoped table where true concurrent closes
from the same user are rare; a plain row lock is simpler and sufficient.

## Decision: `op_closures` FKs cascade on delete; edits to closure-linked ops are rejected in code

**Rationale**: Found during `/speckit-analyze` — the spec's FR-018 and FR-019 need a concrete
mechanism, not just a stated intent. Deletion is a pure referential-integrity concern with no
"recompute" needed (status/P&L are derived, not stored), so `ON DELETE CASCADE` on both
`op_closures` FKs is sufficient and requires no application code. Editing is not a constraint
violation to express in SQL (an `UPDATE` on `ops` doesn't touch `op_closures` at all), so it must be
an explicit check in `update_op` (query `op_closures` for the target id as either role; 409 if any
row exists) before the update is applied — otherwise `PUT /api/ops/{id}` would silently invalidate an
already-frozen `realized_pnl` with no error at all.

**Alternatives considered**: `ON DELETE RESTRICT` (reject the delete outright) — rejected, contradicts
FR-018's explicit wording ("removing dependent closure records", not "reject the delete"), and would
leave a user unable to delete an old operation at all once anything referenced it, with no path to
clean it up.

## Decision: migration file is `012_leverage_and_op_closures.sql`

**Rationale**: `backend/db/migrations/` currently ends at `011_backfill_platform_fields.py`; `012` is
the next sequential number, following the existing naming convention (`NNN_description.sql`).

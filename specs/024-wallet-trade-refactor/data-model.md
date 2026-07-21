# Phase 1 Data Model: Wallet vs. Trade Operation Refactor

## Operation (`ops` table / `Op` type) — extended, not replaced

Existing fields (unchanged, from item 26 and earlier): `id`, `user_id`, `date`, `coin_id`, `symbol`,
`name`, `type` (`'Buy' | 'Sell'`), `qty`, `price`, `fee`, `total`, `platform_id`, `platform_name`,
`currency`, `leverage`, `trade_group_id`, `created_at`.

New fields:

| Field     | Type                          | Notes                                                                 |
|-----------|-------------------------------|-------------------------------------------------------------------------|
| `op_kind` | `VARCHAR(10) NOT NULL DEFAULT 'wallet'` | `'wallet' \| 'trade'`. Fixed at creation (spec FR-025) — `PUT /api/ops/{id}` MUST reject a request that attempts to change it. |
| `side`    | `VARCHAR(5) NULL`             | `'long' \| 'short'`, only meaningful when `op_kind = 'trade'`. `NULL` for wallet ops. Fixed at creation, same as `op_kind`. |

Validation (`backend/app/models.py`, enforced at the API boundary):
- `leverage` MUST be `NULL` when `op_kind = 'wallet'` (spec FR-002) — rejected with 400 otherwise.
- `side` MUST be non-`NULL` when `op_kind = 'trade'` and `NULL` when `op_kind = 'wallet'`.
- `side` is derived server-side from `type` when a trade is created (`Buy → 'long'`, `Sell → 'short'`),
  not client-supplied independently of `type` — prevents a mismatched `type`/`side` pair.

## Wallet balance (derived, not stored) — `shared/src/walletFifo.ts`

For a given `(coinId, platformId, currency)` tuple, walk the user's `op_kind: 'wallet'` operations for
that tuple in chronological order (`date` ascending, then `created_at` ascending — same tie-break as
item 26's closure allocation):

```
lots = []  # FIFO queue of {qty, unitCost}
realizedPnl = 0

for op in walletOpsForTuple (chronological order):
  if op.type == 'Buy':
    lots.push({ qty: op.qty, unitCost: op.price })
  elif op.type == 'Sell':
    remaining = op.qty
    while remaining > 0:
      lot = lots[0]
      consumed = min(remaining, lot.qty)
      realizedPnl += consumed * (op.price - lot.unitCost)
      lot.qty -= consumed; remaining -= consumed
      if lot.qty == 0: lots.shift()
  elif op.type == 'Swap' (both legs share a trade_group_id, this is the "give up" leg):
    # same lot-consuming behavior as Sell, but no realizedPnl contribution (spec FR-006) —
    # the "receive" leg instead pushes a new lot at the consumed lots' blended unit cost
    ... consume lots identically to Sell, tracking blendedCost instead of realizedPnl ...

availableQty = sum(lot.qty for lot in lots)
avgCost = weighted average unitCost across remaining lots
```

Exposed as `computeWalletBalance(ops, coinId, platformId, currency): { availableQty, avgCost }` and
`computeWalletRealizedPnl(sellOp, ops): number` (the realized P/L attributable to one specific Sell,
for the History row display — same walk, but returns the `realizedPnl` accrued during that one op's own
consumption rather than a running total).

## Edit/delete impact check (derived, not stored) — `computeWalletEditImpact`

`computeWalletEditImpact(ops, editedOpId, proposedOp | null): { affectedCount, firstNegativeBalanceDate
| null }`. `proposedOp: null` represents a delete. Implementation: build the hypothetical post-change
operation list, re-run the FIFO walk above for the affected `(coinId, platformId, currency)` tuple, and
compare the running `availableQty` after every later operation against zero — the first date where it
would go negative, if any, is returned. `affectedCount` is the number of later operations whose derived
balance/cost actually differs between the current and hypothetical walks (spec FR-020, FR-021).

Frontend: `HistoryTab.tsx`'s edit/delete handlers call this before submitting; if `affectedCount > 0`,
show the existing `ConfirmDialog` describing the count; if `firstNegativeBalanceDate` is set, block the
action entirely (no dialog — the change is simply rejected) instead of offering to confirm it.

## Trade position (`op_closures` — unchanged shape from item 26, scope narrowed)

`op_closures` (`id`, `source_op_id`, `closing_op_id`, `qty_closed`, `realized_pnl`, `created_at`) is
unchanged from item 26 — see `specs/023-position-closing/data-model.md` for its full shape and
invariants. What changes in this feature:
- Both `source_op_id` and `closing_op_id` MUST now resolve to `op_kind: 'trade'` operations. The close
  endpoint (`POST /api/ops/{id}/close`) rejects with 400 if `{id}` is `op_kind: 'wallet'` (spec FR-014
  — wallet ops no longer have a close action at all).
- The closing operation's `type` is no longer a free choice among "whatever can close it" — it MUST
  match the locked side: `source.side == 'short' → closingOp.type MUST be 'Buy'`,
  `source.side == 'long' → closingOp.type MUST be 'Sell'`. Rejected with 400 otherwise (spec FR-015).
- The Trade/Swap-based close path item 26 built (`onSubmitTradeClose`, a closing leg + a new received
  leg sharing `trade_group_id`) is removed for trade positions — closing is Buy/Sell only, never Swap.

Status derivation (`computeOpStatus`, `openQtyRemaining`) and realized-P/L-per-closure are unchanged
from item 26.

## Cycle (derived, not stored) — folded from item 27, `shared/src/cycles.ts`

Unchanged in shape and algorithm from item 27's original design (`specs` reference:
`docs/design/op-cycle-tag-summary.html`), with one narrowing: `computeCycles(ops, closures)` filters
its input to `op_kind: 'trade'` operations before building the `op_closures` connected-component graph
(see research.md's rationale — this is a defensive filter, not a behavior change, since wallet ops no
longer produce closure rows after this feature's migration). A `Cycle` has `entries`, `exits`,
`qtyEntry`, `qtyClosed`, `qtyRemaining`, `realizedPnl`, `status: 'partial' | 'closed'`.

## Migration and backfill

1. `014_op_kind_and_side.sql` (additive): `ALTER TABLE ops ADD COLUMN op_kind VARCHAR(10) NOT NULL
   DEFAULT 'wallet'`, `ADD COLUMN side VARCHAR(5)`.
2. `015_backfill_op_kind.py` (run automatically on first backend connection, same migration runner as
   `011_backfill_platform_fields.py`), in order:
   a. `UPDATE ops SET op_kind = 'trade', side = CASE type WHEN 'Buy' THEN 'long' ELSE 'short' END WHERE
      leverage IS NOT NULL AND leverage > 1`.
   b. Every other row keeps the column default (`op_kind = 'wallet'`, `side = NULL`) — no write needed.
   c. `DELETE FROM op_closures WHERE source_op_id IN (SELECT id FROM ops WHERE op_kind = 'wallet') OR
      closing_op_id IN (SELECT id FROM ops WHERE op_kind = 'wallet')` — removes any closure link left
      over from before this feature, when any operation (not just leveraged ones) could be closed (spec
      FR-024, Clarifications Q2). Runs after step (a) so the `op_kind` values it joins against are
      already correct.

Idempotent: re-running against an already-migrated database is a no-op (step a's `WHERE` no longer
matches anything once `op_kind` is already set correctly; step c's subquery returns nothing once no
`wallet`-classified op has a lingering closure).

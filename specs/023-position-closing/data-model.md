# Phase 1 Data Model: Position Closing, Leverage, and History Day-Grouping

## Operation (`ops` table / `Op` type) — extended, not replaced

Existing fields (unchanged): `id`, `user_id`, `date`, `coin_id`, `symbol`, `name`, `type`
(`'Buy' | 'Sell'`), `qty`, `price`, `fee`, `total`, `platform_id`, `platform_name`, `currency`,
`created_at`.

New field:

| Field       | Type            | Notes                                                              |
|-------------|-----------------|---------------------------------------------------------------------|
| `leverage`  | `SMALLINT NULL` | One of `2, 3, 5, 10`, or absent/`NULL` meaning 1x (unleveraged). Settable only on a brand-new, non-closing Buy or Sell (FR-012, FR-013). Never set on a closing operation. |

Validation: if present, `leverage` MUST be one of `{2, 3, 5, 10}` — enforced at the API boundary
(`backend/app/models.py`), not just in the UI.

## Closure link (`op_closures` table / `OpClosure` type) — new entity

| Field           | Type                | Notes                                                                 |
|-----------------|---------------------|------------------------------------------------------------------------|
| `id`            | `uuid PRIMARY KEY`  | `DEFAULT gen_random_uuid()`                                             |
| `source_op_id`  | `uuid NOT NULL`     | FK → `ops(id) ON DELETE CASCADE`. The earlier, open operation being (partially) closed. |
| `closing_op_id` | `uuid NOT NULL`     | FK → `ops(id) ON DELETE CASCADE`. The later operation recorded to close it. |
| `qty_closed`    | `numeric(30,10) NOT NULL` | Quantity of `source_op_id` accounted for by this link. > 0.       |
| `realized_pnl`  | `numeric(30,10) NOT NULL` | Frozen at creation time — see research.md's formula.              |
| `created_at`    | `timestamptz DEFAULT now()` | Used nowhere in status/P&L math; audit trail only.               |

Indexes: `source_op_id`, `closing_op_id` (both looked up independently — deriving a source op's
status needs its closures by `source_op_id`; showing a closing op's own realized P/L needs its
closures by `closing_op_id`).

**Invariants** (enforced server-side by the close endpoint, not by a DB constraint, since they
require reading sibling rows):
- `source_op_id` and `closing_op_id` refer to operations belonging to the same `user_id`.
- `source_op_id`'s operation and `closing_op_id`'s operation share the same `coin_id`, `platform_id`,
  and `currency` (spec FR-009a; "Currency handling" / "Close scope" clarifications).
- The sum of `qty_closed` across all closure links referencing a given `source_op_id` MUST NOT exceed
  that operation's own `qty` (spec FR-009).
- `source_op_id` and `closing_op_id` are never the same row, and a given pair of operations is never
  linked more than once in the same direction for overlapping quantity (each close creates its own
  link row(s); the endpoint does not merge into an existing link).

## Position status (derived, not stored)

For any operation `op`, given the set of closure links where `op.id == source_op_id`:

```
closedQty = sum(qty_closed for links where source_op_id == op.id)
remainingQty = op.qty - closedQty
status =
  closedQty == 0        → "open"
  0 < remainingQty       → "partial"
  remainingQty <= 0      → "closed"
```

Computed by `shared/src/positions.ts`'s `computeOpStatus(op, closures)` and
`openQtyRemaining(op, closures)`. Pure functions over the already-fetched `Op[]` and `OpClosure[]`
arrays — no new persisted field, matching the existing `computePositions`/`computeProfitByAsset`
pattern of deriving aggregates from raw ops rather than storing them.

## Per-operation realized P/L (derived, not stored on `ops`)

For any operation (as either a source or a closing leg of one or more links), its displayed realized
P/L is the sum of `realized_pnl` across every closure link referencing it in either role. An operation
with no closure links has no realized P/L (History shows a neutral placeholder, not zero — spec
FR-011).

## State transitions

```
[new operation created] → open
open --(a closure link is recorded against it, qty < op.qty)--> partial
open --(a closure link is recorded against it, qty == op.qty)--> closed
partial --(another closure link recorded, cumulative qty == op.qty)--> closed
partial --(another closure link recorded, cumulative qty < op.qty)--> partial (remaining decreases)
```

There is no transition out of `closed` (no un-close in this feature — deleting a closure-linked
operation is a delete, not a status transition; see spec Edge Cases and FR-018/FR-019).

## Delete and edit interactions with closure links (FR-018, FR-019)

- **Delete** (`DELETE /api/ops/{id}`, `DELETE /api/ops`): handled at the database level —
  `op_closures.source_op_id` and `.closing_op_id` are both `ON DELETE CASCADE`. Deleting an operation
  that has closure links (as either source or closing leg) removes those links along with it; no
  application code needs to "recompute" anything, since status and P/L are derived, not stored.
- **Edit** (`PUT /api/ops/{id}`): handled at the application level, since it isn't a constraint
  violation to prevent — `update_op` MUST check whether any `op_closures` row references `{id}` as
  either `source_op_id` or `closing_op_id` before applying the update, and reject with 409 if so
  (altering a closure-linked operation's quantity or price after the fact would invalidate the
  already-frozen `realized_pnl` on that link).

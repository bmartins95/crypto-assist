import type { Op, OpClosure, PositionStatus } from './types';

// Rounding tolerance: a closing op's consumed qty is summed from per-source closure rows
// (e.g. 0.03 + 0.02), which isn't exact in floating point, so an exact `<= 0` check would
// misreport a fully-consumed op as still partially open.
const QTY_EPSILON = 1e-9;

// Quantity of `op` consumed by closure links — whether it played the source role (being
// closed) or the closing role (the leg that closed another op). Both roles use up the op's
// quantity, so both count toward it being closed. A single closure row links two distinct
// ops, so for any one op it matches on exactly one side and is never double-counted.
function consumedQtyFor(opId: string, closures: OpClosure[]): number {
  return closures
    .filter((c) => c.sourceOpId === opId || c.closingOpId === opId)
    .reduce((sum, c) => sum + c.qtyClosed, 0);
}

// Quantity of `op` not yet accounted for by any closure link (source or closing side).
export function openQtyRemaining(op: Op, closures: OpClosure[]): number {
  return op.qty - consumedQtyFor(op.id, closures);
}

export function computeOpStatus(op: Op, closures: OpClosure[]): PositionStatus {
  const consumed = consumedQtyFor(op.id, closures);
  if (consumed <= QTY_EPSILON) return 'open';
  return op.qty - consumed <= QTY_EPSILON ? 'closed' : 'partial';
}

// Sum of realized P/L across every closure link referencing `opId`, whether it played
// the source or the closing role — an op with no closures has no realized P/L at all
// (distinct from zero, callers should treat an empty closures list as "no figure to show").
export function realizedPnlFor(opId: string, closures: OpClosure[]): number {
  return closures
    .filter((c) => c.sourceOpId === opId || c.closingOpId === opId)
    .reduce((sum, c) => sum + c.realizedPnl, 0);
}

export function hasClosure(opId: string, closures: OpClosure[]): boolean {
  return closures.some((c) => c.sourceOpId === opId || c.closingOpId === opId);
}

// Price-only realized P/L for closing `qty` of sourceOp against closingOp — matches
// backend/app/routes/op_closures.py's formula exactly (fee is never blended into P/L
// anywhere in this codebase, see shared/src/portfolio.ts's computeProfitByAsset).
export function estimateClosePnl(
  sourceOp: Pick<Op, 'type' | 'price'>,
  closingOp: Pick<Op, 'price'>,
  qty: number,
): number {
  const [sellPrice, buyPrice] =
    sourceOp.type === 'Buy' ? [closingOp.price, sourceOp.price] : [sourceOp.price, closingOp.price];
  return qty * (sellPrice - buyPrice);
}

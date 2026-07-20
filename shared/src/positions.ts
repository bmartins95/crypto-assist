import type { Op, OpClosure, PositionStatus } from './types';

function closedQtyFor(opId: string, closures: OpClosure[]): number {
  return closures
    .filter((c) => c.sourceOpId === opId)
    .reduce((sum, c) => sum + c.qtyClosed, 0);
}

// Quantity of `op` not yet accounted for by any closure link referencing it as source.
export function openQtyRemaining(op: Op, closures: OpClosure[]): number {
  return op.qty - closedQtyFor(op.id, closures);
}

export function computeOpStatus(op: Op, closures: OpClosure[]): PositionStatus {
  const closed = closedQtyFor(op.id, closures);
  if (closed <= 0) return 'open';
  return openQtyRemaining(op, closures) <= 0 ? 'closed' : 'partial';
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

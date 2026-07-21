import type { Op, OpClosure, PositionStatus } from './types';

// Rounding tolerance: consumed quantities are summed from per-source closure rows
// (e.g. 0.03 + 0.02), which isn't exact in floating point, so an exact `<= 0` check
// would misreport a fully-consumed op as still partially open.
const QTY_EPSILON = 1e-9;

function consumedAsSource(opId: string, closures: OpClosure[]): number {
  return closures
    .filter((c) => c.sourceOpId === opId)
    .reduce((sum, c) => sum + c.qtyClosed, 0);
}

// A closing op only consumes its OWN quantity when it's a same-asset cash-out close
// (a Sell that closed a Buy of the same coin — qty_closed is in the op's own units).
// A cross-asset trade-close's received leg (different coin) is a brand-new open
// position, so its closing role never counts toward its own consumption. When the
// source op can't be resolved (no `ops` provided) we assume same-asset, preserving the
// simple-close behaviour callers relied on before cross-asset closes existed.
function consumedAsSameAssetClosing(op: Op, closures: OpClosure[], byId: Map<string, Op>): number {
  return closures
    .filter((c) => {
      if (c.closingOpId !== op.id) return false;
      const source = byId.get(c.sourceOpId);
      return !source || source.coinId === op.coinId;
    })
    .reduce((sum, c) => sum + c.qtyClosed, 0);
}

function indexOps(ops: Op[]): Map<string, Op> {
  return new Map(ops.map((o) => [o.id, o]));
}

// Quantity of `op` still available to be closed as a source position. Only the source
// role matters here — being used as a closer elsewhere doesn't reduce what a position
// has left to close.
export function openQtyRemaining(op: Op, closures: OpClosure[]): number {
  return op.qty - consumedAsSource(op.id, closures);
}

export function computeOpStatus(op: Op, closures: OpClosure[], ops: Op[] = []): PositionStatus {
  const consumed = consumedAsSource(op.id, closures) + consumedAsSameAssetClosing(op, closures, indexOps(ops));
  if (consumed <= QTY_EPSILON) return 'open';
  return op.qty - consumed <= QTY_EPSILON ? 'closed' : 'partial';
}

// Realized P/L belongs to the position that was closed (the source side). A closing op
// — whether a same-asset Sell or a cross-asset received leg — is not itself where the
// gain/loss is reported.
export function realizedPnlForSource(opId: string, closures: OpClosure[]): number {
  return closures
    .filter((c) => c.sourceOpId === opId)
    .reduce((sum, c) => sum + c.realizedPnl, 0);
}

export function isClosedSource(opId: string, closures: OpClosure[]): boolean {
  return closures.some((c) => c.sourceOpId === opId);
}

// Price-only realized P/L for closing `qty` of sourceOp against a same-asset closing
// price — matches backend/app/routes/op_closures.py's same-asset formula, used for the
// drawer's live preview before submission. Keying off `type` (rather than `side`)
// already produces the correct sign for both directions: a short's source is a Sell, so
// profit (entryPrice > closePrice) falls out of the same subtraction a long uses — no
// separate sign-inversion is needed, only the leverage scale-up (spec FR-017).
export function estimateClosePnl(
  sourceOp: Pick<Op, 'type' | 'price' | 'leverage'>,
  closingOp: Pick<Op, 'price'>,
  qty: number,
): number {
  const [sellPrice, buyPrice] =
    sourceOp.type === 'Buy' ? [closingOp.price, sourceOp.price] : [sourceOp.price, closingOp.price];
  return qty * (sellPrice - buyPrice) * (sourceOp.leverage ?? 1);
}

import type { Op } from './types';

const QTY_EPSILON = 1e-9;

interface Lot {
  qty: number;
  unitCost: number;
}

function sortKey(op: Op): string {
  return `${op.date}|${op.id}`;
}

// Wallet ops for one asset/platform/currency tuple, oldest-first. `date` is the primary
// key; `id` is a stable (if arbitrary) tie-break for same-date ops — matches this
// codebase's general "oldest first" convention (see specs/023-position-closing/research.md)
// closely enough for FIFO purposes without needing a real timestamp on the client.
function walletOpsForTuple(ops: Op[], coinId: string, platformId: string | undefined, currency: string | undefined): Op[] {
  return ops
    .filter(o => (o.kind ?? 'wallet') === 'wallet' && o.coinId === coinId && (o.platformId ?? undefined) === (platformId ?? undefined) && (o.currency ?? 'BRL') === (currency ?? 'BRL'))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export interface WalletBalance {
  availableQty: number;
  avgCost: number;
}

// Walks a wallet's Buy/Sell/Swap history in chronological order, consuming Buy (and
// Swap-in) lots oldest-first with each Sell (and Swap-out). Returns the remaining
// balance and its weighted-average cost across whatever lots are left.
export function computeWalletBalance(ops: Op[], coinId: string, platformId: string | undefined, currency?: string): WalletBalance {
  const lots: Lot[] = [];
  for (const op of walletOpsForTuple(ops, coinId, platformId, currency)) {
    if (op.type === 'Buy') {
      lots.push({ qty: op.qty, unitCost: op.price });
      continue;
    }
    let remaining = op.qty;
    while (remaining > QTY_EPSILON && lots.length > 0) {
      const lot = lots[0];
      const consumed = Math.min(lot.qty, remaining);
      lot.qty -= consumed;
      remaining -= consumed;
      if (lot.qty <= QTY_EPSILON) lots.shift();
    }
  }
  const availableQty = lots.reduce((sum, l) => sum + l.qty, 0);
  const totalCost = lots.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
  return { availableQty, avgCost: availableQty > QTY_EPSILON ? totalCost / availableQty : 0 };
}

// Realized P/L attributable to one specific wallet Sell — the sum of (sellPrice -
// lotUnitCost) * consumedQty across whichever lots that Sell drew from at the time it
// was recorded (spec FR-009). Swap-out legs never realize P/L (spec FR-006) — the cost
// basis is inherited by the received asset instead, so this only applies to a Sell.
export function computeWalletRealizedPnl(sellOp: Op, ops: Op[]): number {
  if (sellOp.type !== 'Sell') return 0;
  const lots: Lot[] = [];
  let realizedPnl = 0;
  for (const op of walletOpsForTuple(ops, sellOp.coinId, sellOp.platformId, sellOp.currency)) {
    if (op.type === 'Buy') {
      lots.push({ qty: op.qty, unitCost: op.price });
      continue;
    }
    let remaining = op.qty;
    let pnlThisOp = 0;
    while (remaining > QTY_EPSILON && lots.length > 0) {
      const lot = lots[0];
      const consumed = Math.min(lot.qty, remaining);
      pnlThisOp += consumed * (op.price - lot.unitCost);
      lot.qty -= consumed;
      remaining -= consumed;
      if (lot.qty <= QTY_EPSILON) lots.shift();
    }
    if (op.id === sellOp.id) realizedPnl = pnlThisOp;
  }
  return realizedPnl;
}

export interface WalletEditImpact {
  affectedCount: number;
  firstNegativeBalanceDate: string | null;
}

// Simulates the FIFO walk with `editedOpId` replaced by `proposedOp` (or removed
// entirely, for a delete when `proposedOp` is null), against the same-tuple ops as they
// stand today. `affectedCount` is how many later ops see a different running balance in
// the hypothetical walk vs. today's; `firstNegativeBalanceDate` is set the moment any
// Sell would consume more than is available (spec FR-020, FR-021).
export function computeWalletEditImpact(ops: Op[], editedOpId: string, proposedOp: Op | null): WalletEditImpact {
  const edited = ops.find(o => o.id === editedOpId);
  if (!edited) return { affectedCount: 0, firstNegativeBalanceDate: null };

  const tuples = new Set<string>();
  tuples.add(`${edited.coinId}||${edited.platformId ?? ''}||${edited.currency ?? 'BRL'}`);
  if (proposedOp) tuples.add(`${proposedOp.coinId}||${proposedOp.platformId ?? ''}||${proposedOp.currency ?? 'BRL'}`);

  let affectedCount = 0;
  let firstNegativeBalanceDate: string | null = null;

  for (const tupleKey of tuples) {
    const [coinId, platformId, currency] = tupleKey.split('||');
    const current = walletOpsForTuple(ops, coinId, platformId || undefined, currency);
    const hypothetical = walletOpsForTuple(
      proposedOp ? ops.map(o => (o.id === editedOpId ? proposedOp : o)) : ops.filter(o => o.id !== editedOpId),
      coinId,
      platformId || undefined,
      currency,
    );

    // Tracks both the running balance and each Sell's own realized P/L — a source op's
    // price can change without changing any later balance, but it still changes what a
    // later Sell realized, which FR-020 requires surfacing too.
    const runningState = (list: Op[]): Map<string, { qty: number; pnl: number }> => {
      const lots: Lot[] = [];
      const state = new Map<string, { qty: number; pnl: number }>();
      for (const op of list) {
        let pnlThisOp = 0;
        if (op.type === 'Buy') {
          lots.push({ qty: op.qty, unitCost: op.price });
        } else {
          let remaining = op.qty;
          while (remaining > QTY_EPSILON && lots.length > 0) {
            const lot = lots[0];
            const consumed = Math.min(lot.qty, remaining);
            pnlThisOp += consumed * (op.price - lot.unitCost);
            lot.qty -= consumed;
            remaining -= consumed;
            if (lot.qty <= QTY_EPSILON) lots.shift();
          }
          if (remaining > QTY_EPSILON && firstNegativeBalanceDate === null) firstNegativeBalanceDate = op.date;
        }
        state.set(op.id, { qty: lots.reduce((sum, l) => sum + l.qty, 0), pnl: pnlThisOp });
      }
      return state;
    };

    const currentState = runningState(current);
    const hypotheticalState = runningState(hypothetical);
    for (const [id, after] of hypotheticalState) {
      if (id === editedOpId) continue;
      const before = currentState.get(id);
      if (!before) continue;
      if (Math.abs(before.qty - after.qty) > QTY_EPSILON || Math.abs(before.pnl - after.pnl) > QTY_EPSILON) affectedCount++;
    }
  }

  return { affectedCount, firstNegativeBalanceDate };
}

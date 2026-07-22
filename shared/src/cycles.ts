import type { Op, OpClosure } from './types';

const QTY_EPSILON = 1e-9;

export interface Cycle {
  cycleLabel: string;
  entries: Op[];
  exits: Op[];
  qtyEntry: number;
  qtyClosed: number;
  qtyRemaining: number;
  realizedPnl: number;
  status: 'partial' | 'closed';
}

interface Component {
  ids: string[];
  entries: Op[];
  exits: Op[];
  qtyEntry: number;
  qtyClosed: number;
  qtyRemaining: number;
  realizedPnl: number;
  status: 'partial' | 'closed';
  symbol: string;
  earliestDate: string;
}

// A "cycle" is a connected component of the op_closures graph, restricted to
// trade-kind ops (folded from item 27 — wallet ops never produce op_closures rows
// after this feature, so this filter is defensive rather than load-bearing, but a
// pure derivation function shouldn't depend on the migration having already run
// cleanly). An op is an entry if it's ever a source and never a closing leg; an op is
// an exit if it's ever a closing leg. The common shape is one entry + N partial exits;
// a component with more than one entry (a rare pre-feature data shape) still resolves,
// just with multiple entries in the same Cycle.
export function computeCycles(ops: Op[], closures: OpClosure[]): Map<string, Cycle> {
  const tradeOps = ops.filter(o => (o.kind ?? 'wallet') === 'trade');
  const byId = new Map(tradeOps.map(o => [o.id, o]));
  const relevantClosures = closures.filter(c => byId.has(c.sourceOpId) && byId.has(c.closingOpId));

  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };
  relevantClosures.forEach(c => addEdge(c.sourceOpId, c.closingOpId));

  const closingIds = new Set(relevantClosures.map(c => c.closingOpId));
  const visited = new Set<string>();
  const componentsByCoin = new Map<string, Component[]>();

  for (const opId of adjacency.keys()) {
    if (visited.has(opId)) continue;
    const ids: string[] = [];
    const queue = [opId];
    visited.add(opId);
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      ids.push(cur);
      for (const next of adjacency.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    const entries = ids.filter(id => !closingIds.has(id)).map(id => byId.get(id)).filter((o): o is Op => !!o);
    const exits = ids.filter(id => closingIds.has(id)).map(id => byId.get(id)).filter((o): o is Op => !!o);
    if (entries.length === 0) continue;

    const qtyEntry = entries.reduce((sum, e) => sum + e.qty, 0);
    const cycleClosures = relevantClosures.filter(c => ids.includes(c.sourceOpId));
    const qtyClosed = cycleClosures.reduce((sum, c) => sum + c.qtyClosed, 0);
    const realizedPnl = cycleClosures.reduce((sum, c) => sum + c.realizedPnl, 0);
    const qtyRemaining = Math.max(0, qtyEntry - qtyClosed);
    const status: 'partial' | 'closed' = qtyRemaining > QTY_EPSILON ? 'partial' : 'closed';
    const earliestDate = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);

    const coinId = entries[0].coinId;
    if (!componentsByCoin.has(coinId)) componentsByCoin.set(coinId, []);
    componentsByCoin.get(coinId)?.push({
      ids, entries, exits, qtyEntry, qtyClosed, qtyRemaining, realizedPnl, status,
      symbol: entries[0].symbol, earliestDate,
    });
  }

  const result = new Map<string, Cycle>();
  for (const comps of componentsByCoin.values()) {
    comps.sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));
    comps.forEach((c, index) => {
      const cycle: Cycle = {
        cycleLabel: `${c.symbol}-${index + 1}`,
        entries: c.entries,
        exits: c.exits,
        qtyEntry: c.qtyEntry,
        qtyClosed: c.qtyClosed,
        qtyRemaining: c.qtyRemaining,
        realizedPnl: c.realizedPnl,
        status: c.status,
      };
      c.ids.forEach(id => result.set(id, cycle));
    });
  }
  return result;
}

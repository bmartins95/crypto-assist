"""Server-side mirror of shared/src/walletFifo.ts's FIFO balance walk — used to
reject a wallet Sell/Swap (create) or an edit/delete that would produce a
negative balance, at the API boundary rather than trusting the client to have
already enforced it (spec FR-004, FR-021).
"""
from dataclasses import dataclass

_EPSILON = 1e-9


@dataclass
class WalletOpRow:
    id: str
    date: str
    created_at: str
    type: str
    qty: float


def _sort_key(op: WalletOpRow) -> tuple[str, str]:
    return (op.date, op.created_at)


def first_negative_balance_op_id(ops: list[WalletOpRow]) -> str | None:
    """Walks `ops` (one coin/platform/currency's wallet Buy/Sell history) oldest-first,
    consuming Buy lots with each Sell. Returns the id of the first Sell that would
    consume more than is available, or None if the balance never goes negative."""
    lots: list[float] = []
    for op in sorted(ops, key=_sort_key):
        if op.type == "Buy":
            lots.append(op.qty)
            continue
        remaining = op.qty
        while remaining > _EPSILON and lots:
            consume = min(lots[0], remaining)
            lots[0] -= consume
            remaining -= consume
            if lots[0] <= _EPSILON:
                lots.pop(0)
        if remaining > _EPSILON:
            return op.id
    return None

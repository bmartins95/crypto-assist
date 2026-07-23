from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import CloseOpRequest, CloseOpResponse, OpClosure
from app.routes.ops import _SELECT, _row_to_op, _validate_platform_pair

# Mounted at prefix="/api/ops" in main.py, giving POST /api/ops/{op_id}/close.
router = APIRouter()
# Mounted at prefix="/api/op-closures" in main.py, giving GET /api/op-closures.
closures_router = APIRouter()

_EPSILON = 1e-9


def _realized_pnl(source_type: str, source_price: float, closing_price: float, qty: float, leverage: int | None) -> float:
    if source_type == "Buy":
        sell_price, buy_price = closing_price, source_price
    else:
        sell_price, buy_price = source_price, closing_price
    return qty * (sell_price - buy_price) * (leverage or 1)


def _row_to_closure(row: dict) -> OpClosure:
    return OpClosure(
        id=str(row["id"]),
        sourceOpId=str(row["source_op_id"]),
        closingOpId=str(row["closing_op_id"]),
        qtyClosed=float(row["qty_closed"]),
        realizedPnl=float(row["realized_pnl"]),
    )


@router.post("/{op_id}/close", response_model=CloseOpResponse, status_code=status.HTTP_201_CREATED)
def close_op(op_id: str, body: CloseOpRequest, auth: AuthContext = Depends(require_auth)):
    closing_op = body.closingOp
    _validate_platform_pair(closing_op)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SELECT} FROM ops WHERE id = %s AND user_id = %s",  # nosec B608
                (op_id, auth.user_id),
            )
            source = cur.fetchone()
            if source is None:
                raise HTTPException(status_code=404, detail="Operation not found.")

            # Wallet operations have no close action at all (spec FR-014) — balance and
            # realized P/L for wallet ops are derived via FIFO instead (see wallet_fifo.py).
            if source["op_kind"] == "wallet":
                raise HTTPException(status_code=400, detail="A wallet operation cannot be closed.")

            if closing_op.coinId != source["coin_id"]:
                raise HTTPException(
                    status_code=400,
                    detail="A trade position can only be closed with a plain Buy or Sell of the same asset, not a swap.",
                )
            if closing_op.currency != source["currency"]:
                raise HTTPException(
                    status_code=400,
                    detail="A close must use the same currency as the position being closed.",
                )
            # The closing type is locked to whichever side resolves the position — a
            # short (side='short') closes only via Buy, a long only via Sell (spec
            # FR-015). The UI locks this choice, but the server does not trust it.
            required_type = "Buy" if source["side"] == "short" else "Sell"
            if closing_op.type != required_type:
                raise HTTPException(
                    status_code=400,
                    detail=f"A {source['side']} position can only be closed with a {required_type}.",
                )
            if closing_op.platformId != source["platform_id"]:
                raise HTTPException(
                    status_code=400,
                    detail="A close must use the same platform as the position being closed.",
                )
            proceeds_per_unit = closing_op.price

            # Locks every open op in this coin/type/platform/currency group so a
            # concurrent close against the same rows can't over-allocate past what's
            # actually available (see specs/023-position-closing/research.md).
            cur.execute(
                "SELECT id, qty, price, leverage FROM ops"
                " WHERE user_id = %s AND coin_id = %s AND type = %s AND op_kind = 'trade'"
                " AND platform_id IS NOT DISTINCT FROM %s AND currency = %s"
                " ORDER BY date ASC, created_at ASC"
                " FOR UPDATE",
                (auth.user_id, source["coin_id"], source["type"], source["platform_id"], source["currency"]),
            )
            candidates = cur.fetchall()
            candidate_ids = [c["id"] for c in candidates]

            cur.execute(
                "SELECT source_op_id, COALESCE(SUM(qty_closed), 0) AS closed_qty"
                " FROM op_closures WHERE source_op_id = ANY(%s) GROUP BY source_op_id",
                (candidate_ids,),
            )
            closed_by_id = {str(row["source_op_id"]): float(row["closed_qty"]) for row in cur.fetchall()}

            remaining_by_id = {
                str(c["id"]): float(c["qty"]) - closed_by_id.get(str(c["id"]), 0.0) for c in candidates
            }

            if remaining_by_id.get(op_id, 0.0) <= _EPSILON:
                raise HTTPException(status_code=404, detail="Operation not found.")

            total_available = sum(r for r in remaining_by_id.values() if r > _EPSILON)
            if body.qtyToClose > total_available + _EPSILON:
                raise HTTPException(
                    status_code=400,
                    detail="Requested quantity exceeds the outstanding balance available to close.",
                )

            # The closing leg is itself a trade-kind op (it resolves this position, it
            # isn't a new independent one) — kind/side are derived server-side, never
            # trusting whatever the client sent on closing_op.
            closing_side = "long" if closing_op.type == "Buy" else "short"
            cur.execute(
                f"INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency, leverage, trade_group_id, op_kind, side)"  # nosec B608
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                f" RETURNING {_SELECT}",  # nosec B608
                (auth.user_id, closing_op.date, closing_op.coinId, closing_op.symbol, closing_op.name, closing_op.type,
                 closing_op.qty, closing_op.price, closing_op.fee, closing_op.total,
                 closing_op.platformId, closing_op.platformName, closing_op.currency, closing_op.leverage,
                 closing_op.tradeGroupId, "trade", closing_side),
            )
            closing_row = cur.fetchone()

            remaining_to_allocate = body.qtyToClose
            closure_rows = []
            for c in candidates:
                if remaining_to_allocate <= _EPSILON:
                    break
                available = remaining_by_id[str(c["id"])]
                if available <= _EPSILON:
                    continue
                qty_alloc = min(available, remaining_to_allocate)
                # Each candidate lot's own leverage applies to its own portion — a close
                # spanning multiple source ops (opened at different multipliers) must not
                # apply the URL-targeted op's leverage to every lot uniformly.
                pnl = _realized_pnl(source["type"], float(c["price"]), proceeds_per_unit, qty_alloc, c["leverage"])
                cur.execute(
                    "INSERT INTO op_closures (source_op_id, closing_op_id, qty_closed, realized_pnl)"
                    " VALUES (%s, %s, %s, %s)"
                    " RETURNING id, source_op_id, closing_op_id, qty_closed, realized_pnl",
                    (c["id"], closing_row["id"], qty_alloc, pnl),
                )
                closure_rows.append(cur.fetchone())
                remaining_to_allocate -= qty_alloc

        conn.commit()
        return CloseOpResponse(
            closingOp=_row_to_op(closing_row),
            closures=[_row_to_closure(r) for r in closure_rows],
        )
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@closures_router.get("", response_model=list[OpClosure])
def list_op_closures(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT oc.id, oc.source_op_id, oc.closing_op_id, oc.qty_closed, oc.realized_pnl"
                " FROM op_closures oc"
                " JOIN ops o ON o.id = oc.source_op_id OR o.id = oc.closing_op_id"
                " WHERE o.user_id = %s",
                (auth.user_id,),
            )
            rows = cur.fetchall()
        return [_row_to_closure(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

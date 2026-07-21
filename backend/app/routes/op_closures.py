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


def _realized_pnl(source_type: str, source_price: float, closing_price: float, qty: float) -> float:
    if source_type == "Buy":
        sell_price, buy_price = closing_price, source_price
    else:
        sell_price, buy_price = source_price, closing_price
    return qty * (sell_price - buy_price)


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

            # A cross-asset trade-close (e.g. closing a BTC long by receiving Solana) records
            # only the received op as the closer, so its coin/type/platform legitimately
            # differ from the source; the source's realized P/L is the trade value received.
            # A same-asset close keeps the original opposite-type / same-coin / same-platform
            # rules and prices the P/L off the closing op's own unit price.
            is_cross_asset = closing_op.coinId != source["coin_id"]
            if closing_op.currency != source["currency"]:
                raise HTTPException(
                    status_code=400,
                    detail="A close must use the same currency as the position being closed.",
                )
            if is_cross_asset:
                if body.qtyToClose <= 0:
                    raise HTTPException(status_code=400, detail="Quantity to close must be positive.")
                proceeds_per_unit = (closing_op.total - closing_op.fee) / body.qtyToClose
            else:
                if closing_op.type == source["type"]:
                    raise HTTPException(
                        status_code=400,
                        detail="A closing operation must be the opposite type of the position being closed.",
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
                "SELECT id, qty, price FROM ops"
                " WHERE user_id = %s AND coin_id = %s AND type = %s"
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

            cur.execute(
                f"INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency, leverage, trade_group_id)"  # nosec B608
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                f" RETURNING {_SELECT}",  # nosec B608
                (auth.user_id, closing_op.date, closing_op.coinId, closing_op.symbol, closing_op.name, closing_op.type,
                 closing_op.qty, closing_op.price, closing_op.fee, closing_op.total,
                 closing_op.platformId, closing_op.platformName, closing_op.currency, closing_op.leverage,
                 closing_op.tradeGroupId),
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
                pnl = _realized_pnl(source["type"], float(c["price"]), proceeds_per_unit, qty_alloc)
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

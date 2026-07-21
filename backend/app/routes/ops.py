from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import Op, NewOp, DeleteAllOpsResponse, DeleteOpResponse
from app.wallet_fifo import WalletOpRow, first_negative_balance_op_id

router = APIRouter()

_SELECT = "id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency, leverage, trade_group_id, op_kind, side"

_NEW_OP_SENTINEL_CREATED_AT = "9999-12-31T23:59:59.999999"


def _row_to_op(row: dict) -> Op:
    return Op(
        id=str(row["id"]),
        date=str(row["date"]),
        coinId=row["coin_id"],
        symbol=row["symbol"],
        name=row["name"],
        type=row["type"],
        qty=float(row["qty"]),
        price=float(row["price"]),
        fee=float(row["fee"]),
        total=float(row["total"]),
        platformId=row["platform_id"],
        platformName=row["platform_name"],
        currency=row["currency"],
        leverage=row["leverage"],
        tradeGroupId=str(row["trade_group_id"]) if row["trade_group_id"] else None,
        kind=row["op_kind"],
        side=row["side"],
    )


def _validate_platform_pair(op: NewOp) -> None:
    if (op.platformId is None) != (op.platformName is None):
        raise HTTPException(
            status_code=422,
            detail="platformId and platformName must both be set or both be absent.",
        )


def _validate_kind_fields(op: NewOp) -> None:
    if op.kind == "wallet":
        if op.leverage is not None:
            raise HTTPException(status_code=400, detail="A wallet operation cannot have leverage.")
        if op.side is not None:
            raise HTTPException(status_code=400, detail="A wallet operation cannot have a side.")


def _derive_side(op: NewOp) -> str | None:
    if op.kind != "trade":
        return None
    return "long" if op.type == "Buy" else "short"


def _wallet_ops_for_group(cur, user_id: str, coin_id: str, platform_id: str | None, currency: str) -> list[WalletOpRow]:
    cur.execute(
        "SELECT id, date, created_at, type, qty FROM ops"
        " WHERE user_id = %s AND op_kind = 'wallet' AND coin_id = %s"
        " AND platform_id IS NOT DISTINCT FROM %s AND currency = %s",
        (user_id, coin_id, platform_id, currency),
    )
    return [
        WalletOpRow(id=str(r["id"]), date=str(r["date"]), created_at=str(r["created_at"]), type=r["type"], qty=float(r["qty"]))
        for r in cur.fetchall()
    ]


def _reject_if_negative_balance(ops: list[WalletOpRow]) -> None:
    if first_negative_balance_op_id(ops) is not None:
        raise HTTPException(
            status_code=400,
            detail="This change would leave a negative balance for this asset/platform.",
        )


@router.get("", response_model=list[Op])
def list_ops(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SELECT} FROM ops WHERE user_id = %s ORDER BY date",  # nosec B608
                (auth.user_id,),
            )
            return [_row_to_op(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Op, status_code=status.HTTP_201_CREATED)
def create_op(op: NewOp, auth: AuthContext = Depends(require_auth)):
    _validate_platform_pair(op)
    _validate_kind_fields(op)
    side = _derive_side(op)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if op.kind == "wallet" and op.type == "Sell":
                existing = _wallet_ops_for_group(cur, auth.user_id, op.coinId, op.platformId, op.currency)
                proposed = WalletOpRow(
                    id="__new__", date=op.date, created_at=_NEW_OP_SENTINEL_CREATED_AT, type=op.type, qty=op.qty
                )
                _reject_if_negative_balance([*existing, proposed])

            cur.execute(
                f"INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency, leverage, trade_group_id, op_kind, side)"  # nosec B608
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                f" RETURNING {_SELECT}",  # nosec B608
                (auth.user_id, op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platformId, op.platformName, op.currency, op.leverage,
                 op.tradeGroupId, op.kind, side),
            )
            row = cur.fetchone()
        conn.commit()
        return _row_to_op(row)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{op_id}", response_model=Op)
def update_op(op_id: str, op: NewOp, auth: AuthContext = Depends(require_auth)):
    _validate_platform_pair(op)
    _validate_kind_fields(op)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT coin_id, platform_id, currency, op_kind, side, created_at FROM ops"
                " WHERE id = %s AND user_id = %s",
                (op_id, auth.user_id),
            )
            current = cur.fetchone()
            if current is None:
                raise HTTPException(status_code=404, detail="Operation not found.")

            # Classification and trade direction are fixed at creation (spec FR-025) —
            # checked before the closure-link check below, since a wallet op with no
            # closures at all still cannot be edited into a trade.
            if op.kind != current["op_kind"] or op.side != current["side"]:
                raise HTTPException(
                    status_code=400,
                    detail="An operation's classification (wallet/trade) and side cannot be changed after creation.",
                )

            if op.kind == "wallet":
                same_group = (
                    op.coinId == current["coin_id"]
                    and op.platformId == current["platform_id"]
                    and op.currency == current["currency"]
                )
                if same_group:
                    others = [
                        w for w in _wallet_ops_for_group(cur, auth.user_id, op.coinId, op.platformId, op.currency)
                        if w.id != op_id
                    ]
                    proposed = WalletOpRow(
                        id=op_id, date=op.date, created_at=str(current["created_at"]), type=op.type, qty=op.qty
                    )
                    _reject_if_negative_balance([*others, proposed])
                else:
                    old_group = [
                        w for w in _wallet_ops_for_group(cur, auth.user_id, current["coin_id"], current["platform_id"], current["currency"])
                        if w.id != op_id
                    ]
                    _reject_if_negative_balance(old_group)
                    new_group = _wallet_ops_for_group(cur, auth.user_id, op.coinId, op.platformId, op.currency)
                    proposed = WalletOpRow(
                        id=op_id, date=op.date, created_at=str(current["created_at"]), type=op.type, qty=op.qty
                    )
                    _reject_if_negative_balance([*new_group, proposed])

            # An operation with a closure link (as either side) has already produced a
            # frozen realized_pnl elsewhere — changing its qty/price after the fact would
            # silently invalidate that figure, so the update is blocked in the same
            # statement rather than with a separate up-front check (keeps the success
            # path at one round trip, matching every other route in this file).
            cur.execute(
                f"UPDATE ops SET date=%s, coin_id=%s, symbol=%s, name=%s, type=%s,"  # nosec B608
                f" qty=%s, price=%s, fee=%s, total=%s, platform_id=%s, platform_name=%s, currency=%s, leverage=%s"
                f" WHERE id=%s AND user_id=%s"
                f" AND NOT EXISTS (SELECT 1 FROM op_closures WHERE source_op_id = ops.id OR closing_op_id = ops.id)"
                f" RETURNING {_SELECT}",  # nosec B608
                (op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platformId, op.platformName, op.currency, op.leverage,
                 op_id, auth.user_id),
            )
            row = cur.fetchone()
            has_closure = False
            if row is None:
                cur.execute(
                    "SELECT 1 FROM op_closures WHERE source_op_id = %s OR closing_op_id = %s",
                    (op_id, op_id),
                )
                has_closure = cur.fetchone() is not None
        conn.commit()
        if row is None:
            if has_closure:
                raise HTTPException(
                    status_code=409,
                    detail="This operation has a closure recorded against it and can no longer be edited.",
                )
            raise HTTPException(status_code=404, detail="Operation not found.")
        return _row_to_op(row)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("", response_model=DeleteAllOpsResponse)
def delete_all_ops(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM ops WHERE user_id = %s",
                (auth.user_id,),
            )
            count = cur.rowcount
        conn.commit()
        return DeleteAllOpsResponse(deleted=count)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{op_id}", response_model=DeleteOpResponse)
def delete_op(op_id: str, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT trade_group_id, op_kind, coin_id, platform_id, currency FROM ops WHERE id = %s AND user_id = %s",
                (op_id, auth.user_id),
            )
            found = cur.fetchone()
            if found is None:
                conn.rollback()
                raise HTTPException(status_code=404, detail="Operation not found.")

            if found["op_kind"] == "wallet":
                remaining = [
                    w for w in _wallet_ops_for_group(cur, auth.user_id, found["coin_id"], found["platform_id"], found["currency"])
                    if w.id != op_id
                ]
                _reject_if_negative_balance(remaining)

            group_id = found["trade_group_id"]
            if group_id is not None:
                # Both legs of a trade are one unit — deleting either removes the whole
                # group. op_closures cascades, so any position a leg had closed reverts.
                cur.execute(
                    "DELETE FROM ops WHERE trade_group_id = %s AND user_id = %s RETURNING id",
                    (group_id, auth.user_id),
                )
            else:
                cur.execute(
                    "DELETE FROM ops WHERE id = %s AND user_id = %s RETURNING id",
                    (op_id, auth.user_id),
                )
            deleted_ids = [str(r["id"]) for r in cur.fetchall()]
        conn.commit()
        return DeleteOpResponse(deletedIds=deleted_ids)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

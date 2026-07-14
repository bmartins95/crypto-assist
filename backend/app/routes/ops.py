from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import Op, NewOp, DeleteAllOpsResponse

router = APIRouter()

_SELECT = "id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency"


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
    )


def _validate_platform_pair(op: NewOp) -> None:
    if (op.platformId is None) != (op.platformName is None):
        raise HTTPException(
            status_code=422,
            detail="platformId and platformName must both be set or both be absent.",
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
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency)"  # nosec B608
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                f" RETURNING {_SELECT}",  # nosec B608
                (auth.user_id, op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platformId, op.platformName, op.currency),
            )
            row = cur.fetchone()
        conn.commit()
        return _row_to_op(row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{op_id}", response_model=Op)
def update_op(op_id: str, op: NewOp, auth: AuthContext = Depends(require_auth)):
    _validate_platform_pair(op)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE ops SET date=%s, coin_id=%s, symbol=%s, name=%s, type=%s,"  # nosec B608
                f" qty=%s, price=%s, fee=%s, total=%s, platform_id=%s, platform_name=%s, currency=%s"
                f" WHERE id=%s AND user_id=%s"
                f" RETURNING {_SELECT}",  # nosec B608
                (op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platformId, op.platformName, op.currency,
                 op_id, auth.user_id),
            )
            row = cur.fetchone()
        conn.commit()
        if row is None:
            raise HTTPException(status_code=404, detail="Operation not found.")
        return _row_to_op(row)
    except HTTPException:
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


@router.delete("/{op_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_op(op_id: str, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM ops WHERE id = %s AND user_id = %s",
                (op_id, auth.user_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import Op, NewOp

router = APIRouter()

_SELECT = "id, date, coin_id, symbol, name, type, qty, price, fee, total, platform"


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
        platform=row["platform"],
    )


@router.get("/", response_model=list[Op])
def list_ops(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SELECT} FROM ops WHERE user_id = %s ORDER BY date",
                (auth.user_id,),
            )
            return [_row_to_op(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Op, status_code=status.HTTP_201_CREATED)
def create_op(op: NewOp, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform)"
                f" VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                f" RETURNING {_SELECT}",
                (auth.user_id, op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platform),
            )
            row = cur.fetchone()
        conn.commit()
        return _row_to_op(row)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{op_id}", response_model=Op)
def update_op(op_id: str, op: NewOp, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE ops SET date=%s, coin_id=%s, symbol=%s, name=%s, type=%s,"
                f" qty=%s, price=%s, fee=%s, total=%s, platform=%s"
                f" WHERE id=%s AND user_id=%s"
                f" RETURNING {_SELECT}",
                (op.date, op.coinId, op.symbol, op.name, op.type,
                 op.qty, op.price, op.fee, op.total, op.platform,
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

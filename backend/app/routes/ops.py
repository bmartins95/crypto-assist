from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.supabase_client import get_admin_client
from app.models import Op, NewOp

router = APIRouter()

_DB_COLS = "id,date,coin_id,symbol,name,type,qty,price,fee,total,platform"


def _row_to_op(row: dict) -> Op:
    return Op(
        id=row["id"],
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


def _new_op_to_row(op: NewOp, user_id: str) -> dict:
    return {
        "user_id": user_id,
        "date": op.date,
        "coin_id": op.coinId,
        "symbol": op.symbol,
        "name": op.name,
        "type": op.type,
        "qty": op.qty,
        "price": op.price,
        "fee": op.fee,
        "total": op.total,
        "platform": op.platform,
    }


@router.get("/", response_model=list[Op])
def list_ops(auth: AuthContext = Depends(require_auth)):
    try:
        result = get_admin_client().from_("ops").select(_DB_COLS).eq("user_id", auth.user_id).order("date", desc=False).execute()
        return [_row_to_op(r) for r in result.data]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/", response_model=Op, status_code=status.HTTP_201_CREATED)
def create_op(op: NewOp, auth: AuthContext = Depends(require_auth)):
    try:
        result = (
            get_admin_client().from_("ops")
            .insert(_new_op_to_row(op, auth.user_id))
            .select(_DB_COLS)
            .single()
            .execute()
        )
        return _row_to_op(result.data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{op_id}", response_model=Op)
def update_op(op_id: str, op: NewOp, auth: AuthContext = Depends(require_auth)):
    try:
        result = (
            get_admin_client().from_("ops")
            .update(_new_op_to_row(op, auth.user_id))
            .eq("id", op_id)
            .eq("user_id", auth.user_id)
            .select(_DB_COLS)
            .single()
            .execute()
        )
        if result.data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")
        return _row_to_op(result.data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{op_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_op(op_id: str, auth: AuthContext = Depends(require_auth)):
    try:
        get_admin_client().from_("ops").delete().eq("id", op_id).eq("user_id", auth.user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

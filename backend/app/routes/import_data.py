from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.dependencies import AuthContext, require_auth
from app.models import BackupPayload

router = APIRouter()


@router.post("/", status_code=status.HTTP_204_NO_CONTENT)
def import_backup(payload: BackupPayload, auth: AuthContext = Depends(require_auth)):
    sb = auth.supabase
    user_id = auth.user_id

    try:
        sb.from_("ops").delete().eq("user_id", user_id).execute()

        if payload.ops:
            rows = [
                {
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
                for op in payload.ops
            ]
            sb.from_("ops").insert(rows).execute()

        if payload.exitPrices:
            sb.from_("exit_prices").delete().eq("user_id", user_id).execute()
            exit_rows = [
                {"user_id": user_id, "coin_id": coin_id, "exit_price": price}
                for coin_id, price in payload.exitPrices.items()
                if price > 0
            ]
            if exit_rows:
                sb.from_("exit_prices").insert(exit_rows).execute()

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return Response(status_code=status.HTTP_204_NO_CONTENT)

import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.models import BackupPayload, Op

router = APIRouter()


@router.get("/", response_model=BackupPayload)
def export_backup(auth: AuthContext = Depends(require_auth)):
    try:
        ops_result = auth.supabase.from_("ops").select("*").order("date", desc=False).execute()
        exit_result = auth.supabase.from_("exit_prices").select("coin_id,exit_price").execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    ops = [
        Op(
            id=r["id"],
            date=str(r["date"]),
            coinId=r["coin_id"],
            symbol=r["symbol"],
            name=r["name"],
            type=r["type"],
            qty=float(r["qty"]),
            price=float(r["price"]),
            fee=float(r["fee"]),
            total=float(r["total"]),
            platform=r["platform"],
        )
        for r in ops_result.data
    ]

    exit_prices = {r["coin_id"]: float(r["exit_price"]) for r in exit_result.data}

    return BackupPayload(
        version=1,
        exportedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ops=ops,
        exitPrices=exit_prices,
    )

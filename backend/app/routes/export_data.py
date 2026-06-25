import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import BackupPayload, Op

router = APIRouter()

_SELECT = "id, date, coin_id, symbol, name, type, qty, price, fee, total, platform"


@router.get("", response_model=BackupPayload)
def export_backup(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SELECT} FROM ops WHERE user_id = %s ORDER BY date",
                (auth.user_id,),
            )
            ops_rows = cur.fetchall()

            cur.execute(
                "SELECT coin_id, exit_price FROM exit_prices WHERE user_id = %s",
                (auth.user_id,),
            )
            exit_rows = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ops = [
        Op(
            id=str(r["id"]),
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
        for r in ops_rows
    ]
    exit_prices = {r["coin_id"]: float(r["exit_price"]) for r in exit_rows}

    return BackupPayload(
        version=1,
        exportedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ops=ops,
        exitPrices=exit_prices,
    )

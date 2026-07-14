from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import ImportPayload
from app.platform_resolve import resolve_platform

router = APIRouter()


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def import_backup(payload: ImportPayload, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    user_id = auth.user_id
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ops WHERE user_id = %s", (user_id,))

            if payload.ops:
                rows = []
                for op in payload.ops:
                    # A legacy backup (pre-Item-22) carries a free-text `platform` string
                    # instead of platformId/platformName — resolve it the same way the
                    # one-time historical-ops migration does (FR-014).
                    platform_id, platform_name = (
                        (op.platformId, op.platformName)
                        if op.platformId is not None
                        else resolve_platform(op.platform, user_id, conn)
                    )
                    rows.append((
                        user_id, op.date, op.coinId, op.symbol, op.name, op.type,
                        op.qty, op.price, op.fee, op.total, platform_id, platform_name, op.currency,
                    ))
                cur.executemany(
                    "INSERT INTO ops (user_id, date, coin_id, symbol, name, type, qty, price, fee, total, platform_id, platform_name, currency)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    rows,
                )

            cur.execute("DELETE FROM exit_prices WHERE user_id = %s", (user_id,))

            if payload.exitPrices:
                rows = [
                    (user_id, coin_id, price)
                    for coin_id, price in payload.exitPrices.items()
                    if price > 0
                ]
                if rows:
                    cur.executemany(
                        "INSERT INTO exit_prices (user_id, coin_id, exit_price) VALUES (%s, %s, %s)",
                        rows,
                    )

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return Response(status_code=status.HTTP_204_NO_CONTENT)

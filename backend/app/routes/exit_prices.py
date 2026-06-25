from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.dependencies import AuthContext, require_auth
from app.db.postgres_client import get_conn
from app.models import ExitPriceUpdate

router = APIRouter()


@router.get("/", response_model=dict[str, float])
def get_exit_prices(auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT coin_id, exit_price FROM exit_prices WHERE user_id = %s",
                (auth.user_id,),
            )
            return {row["coin_id"]: float(row["exit_price"]) for row in cur.fetchall()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/", status_code=status.HTTP_204_NO_CONTENT)
def set_exit_price(body: ExitPriceUpdate, auth: AuthContext = Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if body.exitPrice <= 0:
                cur.execute(
                    "DELETE FROM exit_prices WHERE user_id = %s AND coin_id = %s",
                    (auth.user_id, body.coinId),
                )
            else:
                cur.execute(
                    "INSERT INTO exit_prices (user_id, coin_id, exit_price)"
                    " VALUES (%s, %s, %s)"
                    " ON CONFLICT (user_id, coin_id) DO UPDATE SET exit_price = EXCLUDED.exit_price,"
                    " updated_at = now()",
                    (auth.user_id, body.coinId, body.exitPrice),
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.dependencies import AuthContext, require_auth
from app.models import ExitPriceUpdate

router = APIRouter()


@router.get("/", response_model=dict[str, float])
def get_exit_prices(auth: AuthContext = Depends(require_auth)):
    try:
        result = auth.supabase.from_("exit_prices").select("coin_id,exit_price").execute()
        return {row["coin_id"]: float(row["exit_price"]) for row in result.data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/", status_code=status.HTTP_204_NO_CONTENT)
def set_exit_price(body: ExitPriceUpdate, auth: AuthContext = Depends(require_auth)):
    try:
        if body.exitPrice <= 0:
            auth.supabase.from_("exit_prices").delete().eq("coin_id", body.coinId).eq("user_id", auth.user_id).execute()
        else:
            auth.supabase.from_("exit_prices").upsert({
                "user_id": auth.user_id,
                "coin_id": body.coinId,
                "exit_price": body.exitPrice,
            }).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)

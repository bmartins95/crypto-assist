import datetime
import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.config import get_settings
from app.models import PriceInfo
import httpx

router = APIRouter()

_CACHE_TTL_S = 5 * 60


def _fetch_from_coingecko(ids: list[str]) -> list[dict]:
    api_key = get_settings().coingecko_api_key
    key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
    url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids={','.join(ids)}{key_param}"

    with httpx.Client(timeout=10) as client:
        r = client.get(url)

    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="CoinGecko rate limit exceeded.")
    if not r.is_success:
        raise HTTPException(status_code=502, detail="Failed to fetch prices from CoinGecko.")

    data = r.json()
    if not isinstance(data, list):
        raise HTTPException(status_code=502, detail="Unexpected CoinGecko response.")

    return [
        {"id": c["id"], "price": float(c["current_price"]), "image": c.get("image")}
        for c in data
        if c.get("current_price") is not None
    ]


@router.get("/", response_model=dict[str, PriceInfo])
def get_prices(
    ids: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    _auth=Depends(require_auth),
):
    coin_ids = list({s.strip() for s in ids.split(",") if s.strip()})
    if not coin_ids:
        raise HTTPException(status_code=400, detail='Query param "ids" is required.')

    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT coin_id, price_brl, image_url, updated_at FROM price_cache"
                " WHERE coin_id = ANY(%s)",
                (coin_ids,),
            )
            cached = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    now = time.time()
    fresh: dict[str, dict] = {}
    for row in cached:
        updated = row["updated_at"]
        ts = updated.timestamp() if hasattr(updated, "timestamp") else datetime.datetime.fromisoformat(str(updated).replace("Z", "+00:00")).timestamp()
        if now - ts < _CACHE_TTL_S:
            fresh[row["coin_id"]] = row

    stale_ids = [cid for cid in coin_ids if cid not in fresh]
    result: dict[str, PriceInfo] = {
        cid: PriceInfo(price=float(row["price_brl"]), image=row.get("image_url"))
        for cid, row in fresh.items()
    }

    if stale_ids:
        try:
            fetched = _fetch_from_coingecko(stale_ids)
            if fetched:
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO price_cache (coin_id, price_brl, image_url, updated_at)"
                        " VALUES (%s, %s, %s, %s)"
                        " ON CONFLICT (coin_id) DO UPDATE SET price_brl = EXCLUDED.price_brl,"
                        " image_url = EXCLUDED.image_url, updated_at = EXCLUDED.updated_at",
                        [(c["id"], c["price"], c.get("image"), now_iso) for c in fetched],
                    )
                conn.commit()
            for c in fetched:
                result[c["id"]] = PriceInfo(price=c["price"], image=c.get("image"))
        except HTTPException:
            # On CoinGecko failure, fall back to stale cache rather than erroring
            for row in cached:
                if row["coin_id"] in stale_ids and row["coin_id"] not in result:
                    result[row["coin_id"]] = PriceInfo(price=float(row["price_brl"]), image=row.get("image_url"))
            if not result:
                raise
        except Exception as e:
            conn.rollback()
            for row in cached:
                if row["coin_id"] in stale_ids and row["coin_id"] not in result:
                    result[row["coin_id"]] = PriceInfo(price=float(row["price_brl"]), image=row.get("image_url"))
            if not result:
                raise HTTPException(status_code=502, detail=str(e))

    return result

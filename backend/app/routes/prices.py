import datetime
import re
import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.models import PriceInfo
from app.price_provider import get_provider, PricedAsset

router = APIRouter()

_CACHE_TTL_S = 5 * 60
_COIN_ID_RE = re.compile(r'^[a-z0-9-]{1,120}$')


@router.get("", response_model=dict[str, PriceInfo])
def get_prices(
    ids: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    _auth=Depends(require_auth),
):
    coin_ids = list({s.strip() for s in ids.split(",") if s.strip()})
    if not coin_ids:
        raise HTTPException(status_code=400, detail='Query param "ids" is required.')

    invalid = [cid for cid in coin_ids if not _COIN_ID_RE.fullmatch(cid)]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid coin_id(s): {', '.join(invalid)}")

    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT coin_id, price_usd, image_url, updated_at FROM price_cache"
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
        cid: PriceInfo(price=float(row["price_usd"]), image=row.get("image_url"))
        for cid, row in fresh.items()
    }

    if stale_ids:
        try:
            fetched = get_provider().get_prices([PricedAsset(coin_id=cid) for cid in stale_ids])
            if fetched:
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO price_cache (coin_id, price_usd, image_url, updated_at)"
                        " VALUES (%s, %s, %s, %s)"
                        " ON CONFLICT (coin_id) DO UPDATE SET price_usd = EXCLUDED.price_usd,"
                        " image_url = EXCLUDED.image_url, updated_at = EXCLUDED.updated_at",
                        [(c["id"], c["price"], c.get("image"), now_iso) for c in fetched],
                    )
                conn.commit()
            for c in fetched:
                result[c["id"]] = PriceInfo(price=c["price"], image=c.get("image"))
        except NotImplementedError as e:
            # Must precede `except Exception` below: a provider that doesn't implement
            # this capability is a permanent condition, not a transient upstream hiccup,
            # so it must never be treated as stale-cache-fallback material.
            raise HTTPException(status_code=501, detail=str(e))
        except HTTPException:
            # On CoinGecko failure, fall back to stale cache rather than erroring
            for row in cached:
                if row["coin_id"] in stale_ids and row["coin_id"] not in result:
                    result[row["coin_id"]] = PriceInfo(price=float(row["price_usd"]), image=row.get("image_url"))
            if not result:
                raise
        except Exception as e:
            conn.rollback()
            for row in cached:
                if row["coin_id"] in stale_ids and row["coin_id"] not in result:
                    result[row["coin_id"]] = PriceInfo(price=float(row["price_usd"]), image=row.get("image_url"))
            if not result:
                raise HTTPException(status_code=502, detail=str(e))

    return result

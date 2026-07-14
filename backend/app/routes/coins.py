import datetime
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.price_provider import get_provider
from psycopg.types.json import Jsonb

router = APIRouter()

_CACHE_TTL_S = 60 * 60


def _row_ts(row: dict) -> float:
    updated = row["updated_at"]
    if hasattr(updated, "timestamp"):
        return updated.timestamp()
    return datetime.datetime.fromisoformat(str(updated).replace("Z", "+00:00")).timestamp()


@router.get("", response_model=list[dict])
def search_coins(
    q: str = Query(""),
    limit: int = Query(7),
    _auth=Depends(require_auth),
):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail='Query param "q" is required.')

    cache_key = query.lower()
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT results, updated_at FROM coin_search_cache WHERE query = %s", (cache_key,))
            cached = cur.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if cached and time.time() - _row_ts(cached) < _CACHE_TTL_S:
        return cached["results"][:limit]

    try:
        results = get_provider().search_coins(query)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except HTTPException:
        if cached:
            # Serve stale results rather than failing the search on upstream trouble.
            return cached["results"][:limit]
        raise

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO coin_search_cache (query, results, updated_at)"
                " VALUES (%s, %s, %s)"
                " ON CONFLICT (query) DO UPDATE SET results = EXCLUDED.results,"
                " updated_at = EXCLUDED.updated_at",
                (cache_key, Jsonb(results), now_iso),
            )
        conn.commit()
    except Exception:
        # Freshly fetched results are still valid for this response even if caching failed.
        conn.rollback()

    return results[:limit]

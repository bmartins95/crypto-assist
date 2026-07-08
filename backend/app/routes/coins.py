from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import require_auth
from app.price_provider import get_provider

router = APIRouter()


@router.get("", response_model=list[dict])
def search_coins(
    q: str = Query(""),
    limit: int = Query(7),
    _auth=Depends(require_auth),
):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail='Query param "q" is required.')

    results = get_provider().search_coins(query)
    return results[:limit]

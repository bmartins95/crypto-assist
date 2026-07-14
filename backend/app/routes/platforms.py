import base64
import datetime
import time
from fastapi import APIRouter, Depends, HTTPException, Response
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.config import get_settings
from app.models import PlatformExchangeEntry, PlatformsExchangesResponse
import httpx

router = APIRouter()
logo_router = APIRouter()

_CACHE_TTL_S = 60 * 60 * 24


def _fetch_exchanges_from_coingecko() -> list[dict]:
    api_key = get_settings().coingecko_api_key
    key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
    url = f"https://api.coingecko.com/api/v3/exchanges?per_page=250{key_param}"

    with httpx.Client(timeout=10) as client:
        r = client.get(url)

    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="CoinGecko rate limit exceeded.")
    if not r.is_success:
        raise HTTPException(status_code=502, detail="Failed to fetch exchanges from CoinGecko.")

    data = r.json()
    if not isinstance(data, list):
        raise HTTPException(status_code=502, detail="Unexpected CoinGecko response.")

    return [
        {"id": e["id"], "name": e["name"], "logo_url": e.get("image")}
        for e in data
        if e.get("id") and e.get("name")
    ]


def _row_ts(row: dict) -> float:
    updated = row["updated_at"]
    if hasattr(updated, "timestamp"):
        return updated.timestamp()
    return datetime.datetime.fromisoformat(str(updated).replace("Z", "+00:00")).timestamp()


def _to_entry(platform_id: str, name: str, logo_url: str | None, kind: str) -> PlatformExchangeEntry:
    return PlatformExchangeEntry(
        id=platform_id,
        name=name,
        logoUrl=f"/api/platforms/logo/{platform_id}" if logo_url else None,
        kind=kind,
    )


@router.get("", response_model=PlatformsExchangesResponse)
def get_platform_exchanges(_auth=Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, logo_url, updated_at FROM platform_cache WHERE kind = 'exchange'")
            cached = cur.fetchall()
            # Curated wallet/DeFi entries (Item: platform icon sourcing) are static, seeded
            # once by a migration — they never come from CoinGecko and never go stale, so
            # they're excluded from the freshness check below and always returned as-is.
            cur.execute("SELECT id, name, logo_url, kind FROM platform_cache WHERE kind != 'exchange'")
            curated = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    curated_entries = [_to_entry(row["id"], row["name"], row["logo_url"], row["kind"]) for row in curated]
    fresh = bool(cached) and all(time.time() - _row_ts(row) < _CACHE_TTL_S for row in cached)

    if fresh:
        return PlatformsExchangesResponse(
            exchanges=[_to_entry(row["id"], row["name"], row["logo_url"], "exchange") for row in cached] + curated_entries,
            updatedAt=max(str(row["updated_at"]) for row in cached),
        )

    try:
        exchanges = _fetch_exchanges_from_coingecko()
    except HTTPException:
        if cached:
            # Serve stale exchanges rather than failing the whole picker on upstream trouble.
            return PlatformsExchangesResponse(
                exchanges=[_to_entry(row["id"], row["name"], row["logo_url"], "exchange") for row in cached] + curated_entries,
                updatedAt=max(str(row["updated_at"]) for row in cached),
            )
        raise

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO platform_cache (id, name, logo_url, kind, updated_at)"
                " VALUES (%s, %s, %s, 'exchange', %s)"
                " ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,"
                " logo_url = EXCLUDED.logo_url, updated_at = EXCLUDED.updated_at",
                [(e["id"], e["name"], e["logo_url"], now_iso) for e in exchanges],
            )
        conn.commit()
    except Exception:
        # Freshly fetched exchanges are still valid for this response even if caching failed.
        conn.rollback()

    return PlatformsExchangesResponse(
        exchanges=[_to_entry(e["id"], e["name"], e["logo_url"], "exchange") for e in exchanges] + curated_entries,
        updatedAt=now_iso,
    )


# No require_auth here: an <img src> request cannot carry a Bearer token, and
# this route only ever re-serves a small, non-sensitive brand-mark image for a
# known platform_cache id — never user or ops data (research.md §3).
@logo_router.get("/{platform_id}")
def get_platform_logo(platform_id: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT logo_url FROM platform_cache WHERE id = %s", (platform_id,))
        row = cur.fetchone()
    if not row or not row["logo_url"]:
        raise HTTPException(status_code=404, detail="Unknown platform id.")

    logo_url = row["logo_url"]

    # Curated wallet/DeFi logos are embedded inline (no upstream host to proxy —
    # see 010_curated_platform_logos.sql for why) — decode straight from the
    # stored data: URI instead of trying to httpx.get() a non-network scheme.
    if logo_url.startswith("data:"):
        header, _, b64_data = logo_url.partition(",")
        content_type = header[len("data:"):].split(";")[0] or "image/png"
        try:
            content = base64.b64decode(b64_data)
        except Exception:
            raise HTTPException(status_code=500, detail="Malformed stored logo data.")
        return Response(
            content=content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=604800"},
        )

    with httpx.Client(timeout=10) as client:
        r = client.get(logo_url)
    if not r.is_success:
        raise HTTPException(status_code=502, detail="Failed to fetch platform logo.")

    content_type = r.headers.get("content-type", "image/png")
    return Response(
        content=r.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=604800"},
    )

import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.config import get_settings
import httpx

router = APIRouter()

_COIN_ID_RE = re.compile(r'^[a-z0-9-]{1,120}$')
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _today_utc() -> datetime.date:
    return datetime.datetime.now(datetime.timezone.utc).date()


def _fetch_market_chart(coin_id: str, days: int) -> dict[str, float]:
    api_key = get_settings().coingecko_api_key
    key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
    url = (
        f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
        f"?vs_currency=usd&days={days}&interval=daily{key_param}"
    )

    with httpx.Client(timeout=10) as client:
        r = client.get(url)

    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="CoinGecko rate limit exceeded.")
    if not r.is_success:
        raise HTTPException(status_code=502, detail="Failed to fetch price history from CoinGecko.")

    data = r.json()
    prices = data.get("prices") if isinstance(data, dict) else None
    if not isinstance(prices, list):
        raise HTTPException(status_code=502, detail="Unexpected CoinGecko response.")

    result: dict[str, float] = {}
    for point in prices:
        if not isinstance(point, list) or len(point) != 2:
            continue
        ts_ms, price = point
        day = datetime.datetime.fromtimestamp(ts_ms / 1000, tz=datetime.timezone.utc).date().isoformat()
        result[day] = float(price)
    return result


@router.get("", response_model=dict[str, dict[str, float]])
def get_price_history(
    ids: str = Query(..., description="Comma-separated CoinGecko coin IDs"),
    from_: str = Query(..., alias="from", description="Inclusive start date, YYYY-MM-DD"),
    to: str = Query(..., description="Inclusive end date, YYYY-MM-DD"),
    _auth=Depends(require_auth),
):
    coin_ids = list({s.strip() for s in ids.split(",") if s.strip()})
    if not coin_ids:
        raise HTTPException(status_code=400, detail='Query param "ids" is required.')

    invalid = [cid for cid in coin_ids if not _COIN_ID_RE.fullmatch(cid)]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid coin_id(s): {', '.join(invalid)}")

    if not _DATE_RE.fullmatch(from_) or not _DATE_RE.fullmatch(to):
        raise HTTPException(status_code=400, detail="Invalid date range.")
    try:
        from_date = datetime.date.fromisoformat(from_)
        to_date = datetime.date.fromisoformat(to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date range.")
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="Invalid date range.")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT coin_id, date, price_usd FROM price_history"
                " WHERE coin_id = ANY(%s) AND date BETWEEN %s AND %s",
                (coin_ids, from_date, to_date),
            )
            cached = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    result: dict[str, dict[str, float]] = {}
    cached_dates: dict[str, set[str]] = {cid: set() for cid in coin_ids}
    for row in cached:
        cid = row["coin_id"]
        d = row["date"]
        day = d.isoformat() if hasattr(d, "isoformat") else str(d)
        result.setdefault(cid, {})[day] = float(row["price_usd"])
        cached_dates.setdefault(cid, set()).add(day)

    total_days = (to_date - from_date).days + 1
    all_days = {(from_date + datetime.timedelta(days=i)).isoformat() for i in range(total_days)}
    today = _today_utc()

    to_upsert: list[tuple[str, str, float]] = []
    for cid in coin_ids:
        missing = all_days - cached_dates.get(cid, set())
        if not missing:
            continue
        earliest_missing = datetime.date.fromisoformat(min(missing))
        days_back = (today - earliest_missing).days + 1
        try:
            fetched = _fetch_market_chart(cid, max(days_back, 1))
        except HTTPException:
            # Best-effort: leave this coin with only whatever was already cached.
            continue
        for day, price in fetched.items():
            if day in all_days:
                result.setdefault(cid, {})[day] = price
                to_upsert.append((cid, day, price))

    if to_upsert:
        try:
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO price_history (coin_id, date, price_usd) VALUES (%s, %s, %s)"
                    " ON CONFLICT (coin_id, date) DO UPDATE SET price_usd = EXCLUDED.price_usd",
                    to_upsert,
                )
            conn.commit()
        except Exception:
            conn.rollback()

    if not result:
        raise HTTPException(status_code=502, detail="Failed to fetch price history from CoinGecko.")

    return result

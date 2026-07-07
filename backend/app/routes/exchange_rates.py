import datetime
import time
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import require_auth
from app.db.postgres_client import get_conn
from app.config import get_settings
from app.models import ExchangeRatesResponse
import httpx

router = APIRouter()

_CACHE_TTL_S = 60 * 60
_FIAT_CURRENCIES = ["brl", "eur", "gbp", "jpy"]


def _fetch_rates_from_coingecko() -> dict[str, float]:
    api_key = get_settings().coingecko_api_key
    key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
    vs = ",".join(["usd", *_FIAT_CURRENCIES])
    url = f"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies={vs}{key_param}"

    with httpx.Client(timeout=10) as client:
        r = client.get(url)

    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="CoinGecko rate limit exceeded.")
    if not r.is_success:
        raise HTTPException(status_code=502, detail="Failed to fetch exchange rates from CoinGecko.")

    btc = r.json().get("bitcoin")
    if not isinstance(btc, dict) or not btc.get("usd"):
        raise HTTPException(status_code=502, detail="Unexpected CoinGecko exchange-rate response.")

    usd_price = float(btc["usd"])
    rates = {"USD": 1.0}
    for c in _FIAT_CURRENCIES:
        if btc.get(c) is None:
            raise HTTPException(status_code=502, detail=f"CoinGecko response missing {c.upper()} rate.")
        rates[c.upper()] = float(btc[c]) / usd_price
    return rates


def _row_ts(row: dict) -> float:
    updated = row["updated_at"]
    if hasattr(updated, "timestamp"):
        return updated.timestamp()
    return datetime.datetime.fromisoformat(str(updated).replace("Z", "+00:00")).timestamp()


@router.get("", response_model=ExchangeRatesResponse)
def get_exchange_rates(_auth=Depends(require_auth)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT currency_code, rate_vs_usd, updated_at FROM exchange_rates")
            cached = cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    expected = {"USD", *(c.upper() for c in _FIAT_CURRENCIES)}
    have_all = expected <= {row["currency_code"] for row in cached}
    fresh = have_all and all(time.time() - _row_ts(row) < _CACHE_TTL_S for row in cached)

    if fresh:
        newest = max(str(row["updated_at"]) for row in cached)
        return ExchangeRatesResponse(
            rates={row["currency_code"]: float(row["rate_vs_usd"]) for row in cached},
            updatedAt=newest,
        )

    try:
        rates = _fetch_rates_from_coingecko()
    except HTTPException:
        if have_all:
            # Serve stale rates rather than failing the whole UI on upstream trouble.
            newest = max(str(row["updated_at"]) for row in cached)
            return ExchangeRatesResponse(
                rates={row["currency_code"]: float(row["rate_vs_usd"]) for row in cached},
                updatedAt=newest,
            )
        raise

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO exchange_rates (currency_code, rate_vs_usd, updated_at)"
                " VALUES (%s, %s, %s)"
                " ON CONFLICT (currency_code) DO UPDATE SET rate_vs_usd = EXCLUDED.rate_vs_usd,"
                " updated_at = EXCLUDED.updated_at",
                [(code, rate, now_iso) for code, rate in rates.items()],
            )
        conn.commit()
    except Exception:
        # Freshly fetched rates are still valid for this response even if caching failed.
        conn.rollback()

    return ExchangeRatesResponse(rates=rates, updatedAt=now_iso)

import datetime
from datetime import date
import httpx
from fastapi import HTTPException
from app.config import get_settings
from app.price_provider import PriceProvider, PricedAsset


class CoinGeckoProvider(PriceProvider):
    def search_coins(self, query: str) -> list[dict]:
        api_key = get_settings().coingecko_api_key
        key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
        url = f"https://api.coingecko.com/api/v3/search?query={query}{key_param}"

        with httpx.Client(timeout=10) as client:
            r = client.get(url)

        if r.status_code == 429:
            raise HTTPException(status_code=429, detail="CoinGecko rate limit exceeded.")
        if not r.is_success:
            raise HTTPException(status_code=502, detail="Failed to search coins from CoinGecko.")

        data = r.json()
        coins = data.get("coins") if isinstance(data, dict) else None
        if not isinstance(coins, list):
            raise HTTPException(status_code=502, detail="Unexpected CoinGecko response.")

        return [
            {
                "id": c["id"],
                "symbol": c["symbol"],
                "name": c["name"],
                "market_cap_rank": c.get("market_cap_rank"),
            }
            for c in coins
            if c.get("id") and c.get("symbol") and c.get("name")
        ]

    def get_prices(self, assets: list[PricedAsset]) -> list[dict]:
        ids = [a.coin_id for a in assets]
        api_key = get_settings().coingecko_api_key
        key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
        url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={','.join(ids)}{key_param}"

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

    def get_history(self, asset: PricedAsset, from_date: date, to_date: date) -> dict[str, float]:
        today = datetime.datetime.now(datetime.timezone.utc).date()
        days = max((today - from_date).days + 1, 1)

        api_key = get_settings().coingecko_api_key
        key_param = f"&x_cg_demo_api_key={api_key}" if api_key else ""
        url = (
            f"https://api.coingecko.com/api/v3/coins/{asset.coin_id}/market_chart"
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

from datetime import date
from app.price_provider import PriceProvider, PricedAsset

_NOT_IMPLEMENTED = "CryptoCompareProvider is not yet implemented"


class CryptoCompareProvider(PriceProvider):
    def search_coins(self, query: str) -> list[dict]:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    def get_prices(self, assets: list[PricedAsset]) -> list[dict]:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    def get_history(self, asset: PricedAsset, from_date: date, to_date: date) -> dict[str, float]:
        raise NotImplementedError(_NOT_IMPLEMENTED)

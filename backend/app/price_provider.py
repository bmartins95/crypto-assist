from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from app.config import get_settings


@dataclass(frozen=True)
class PricedAsset:
    coin_id: str
    symbol: str | None = None


class PriceProvider(ABC):
    @abstractmethod
    def search_coins(self, query: str) -> list[dict]:
        ...

    @abstractmethod
    def get_prices(self, assets: list[PricedAsset]) -> list[dict]:
        ...

    @abstractmethod
    def get_history(self, asset: PricedAsset, from_date: date, to_date: date) -> dict[str, float]:
        ...


@lru_cache
def _coingecko_provider() -> PriceProvider:
    from app.providers.coingecko import CoinGeckoProvider
    return CoinGeckoProvider()


@lru_cache
def _cryptocompare_provider() -> PriceProvider:
    from app.providers.cryptocompare import CryptoCompareProvider
    return CryptoCompareProvider()


def get_provider() -> PriceProvider:
    provider = get_settings().price_provider
    if provider == "cryptocompare":
        return _cryptocompare_provider()
    return _coingecko_provider()

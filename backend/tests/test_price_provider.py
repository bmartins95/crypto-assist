from datetime import date
from unittest.mock import patch
import pytest

from app.price_provider import get_provider, PricedAsset
from app.providers.coingecko import CoinGeckoProvider
from app.providers.cryptocompare import CryptoCompareProvider


def test_default_provider_is_coingecko():
    with patch("app.price_provider.get_settings") as mock_settings:
        mock_settings.return_value.price_provider = "coingecko"
        assert isinstance(get_provider(), CoinGeckoProvider)


def test_cryptocompare_provider_selected_via_config():
    with patch("app.price_provider.get_settings") as mock_settings:
        mock_settings.return_value.price_provider = "cryptocompare"
        assert isinstance(get_provider(), CryptoCompareProvider)


def test_cryptocompare_search_not_implemented():
    provider = CryptoCompareProvider()
    with pytest.raises(NotImplementedError):
        provider.search_coins("bitcoin")


def test_cryptocompare_get_prices_not_implemented():
    provider = CryptoCompareProvider()
    with pytest.raises(NotImplementedError):
        provider.get_prices([PricedAsset(coin_id="bitcoin")])


def test_cryptocompare_get_history_not_implemented():
    provider = CryptoCompareProvider()
    with pytest.raises(NotImplementedError):
        provider.get_history(PricedAsset(coin_id="bitcoin"), date(2026, 1, 1), date(2026, 1, 2))

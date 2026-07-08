from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext


def _auth_client():
    app.dependency_overrides[require_auth] = lambda: AuthContext(user_id="user-test")
    client = TestClient(app)
    return client


def _cleanup():
    app.dependency_overrides.clear()


def _mock_httpx(status_code=200, is_success=True, json_data=None):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = is_success
    mock_resp.json.return_value = json_data if json_data is not None else {"coins": []}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return patch("app.providers.coingecko.httpx.Client", return_value=mock_client)


def test_search_returns_results():
    client = _auth_client()
    cg_data = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1}]}
    try:
        with _mock_httpx(json_data=cg_data):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        body = res.json()
        assert body == [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1}]
    finally:
        _cleanup()


def test_search_respects_limit():
    client = _auth_client()
    cg_data = {"coins": [
        {"id": f"coin{i}", "symbol": f"c{i}", "name": f"Coin {i}", "market_cap_rank": i}
        for i in range(10)
    ]}
    try:
        with _mock_httpx(json_data=cg_data):
            res = client.get("/api/coins/search?q=coin&limit=3")
        assert res.status_code == 200
        assert len(res.json()) == 3
    finally:
        _cleanup()


def test_empty_query_rejected():
    client = _auth_client()
    try:
        res = client.get("/api/coins/search?q=")
        assert res.status_code == 400
        assert "q" in res.json()["detail"]
    finally:
        _cleanup()


def test_missing_query_rejected():
    client = _auth_client()
    try:
        res = client.get("/api/coins/search")
        assert res.status_code == 400
    finally:
        _cleanup()


def test_missing_auth_returns_401():
    client = TestClient(app)
    res = client.get("/api/coins/search?q=bitcoin")
    assert res.status_code == 401


def test_coingecko_rate_limit_propagates():
    client = _auth_client()
    try:
        with _mock_httpx(status_code=429, is_success=False):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 429
    finally:
        _cleanup()


def test_coingecko_upstream_failure_returns_502():
    client = _auth_client()
    try:
        with _mock_httpx(status_code=503, is_success=False):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 502
    finally:
        _cleanup()


def test_not_implemented_provider_returns_501():
    client = _auth_client()
    try:
        with patch("app.routes.coins.get_provider") as mock_provider:
            mock_provider.return_value.search_coins.side_effect = NotImplementedError("nope")
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 501
    finally:
        _cleanup()

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

_FRESH_ROWS = [
    {"currency_code": "USD", "rate_vs_usd": "1", "updated_at": "2099-01-01T00:00:00+00:00"},
    {"currency_code": "BRL", "rate_vs_usd": "5.4321", "updated_at": "2099-01-01T00:00:00+00:00"},
    {"currency_code": "EUR", "rate_vs_usd": "0.9215", "updated_at": "2099-01-01T00:00:00+00:00"},
    {"currency_code": "GBP", "rate_vs_usd": "0.7844", "updated_at": "2099-01-01T00:00:00+00:00"},
    {"currency_code": "JPY", "rate_vs_usd": "157.32", "updated_at": "2099-01-01T00:00:00+00:00"},
]

_STALE_ROWS = [{**row, "updated_at": "2000-01-01T00:00:00+00:00"} for row in _FRESH_ROWS]

_CG_BODY = {"bitcoin": {"usd": 100000.0, "brl": 543210.0, "eur": 92150.0, "gbp": 78440.0, "jpy": 15732000.0}}


def _make_auth_client(db_data):
    pg_conn, cur = make_pg_stub(db_data)

    def _auth():
        return AuthContext(user_id="user-test")

    app.dependency_overrides[require_auth] = _auth
    patches = [patch(t, return_value=pg_conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    return TestClient(app), pg_conn, cur, patches


def _cleanup(patches):
    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


def _mock_httpx(status_code=200, is_success=True, json_data=None):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = is_success
    mock_resp.json.return_value = json_data if json_data is not None else {}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return mock_client, patch("app.routes.exchange_rates.httpx.Client", return_value=mock_client)


@pytest.fixture
def fresh_client():
    client, _, _, patches = _make_auth_client(_FRESH_ROWS)
    yield client
    _cleanup(patches)


@pytest.fixture
def stale_client():
    client, _, _, patches = _make_auth_client(_STALE_ROWS)
    yield client
    _cleanup(patches)


@pytest.fixture
def empty_client():
    client, _, _, patches = _make_auth_client([])
    yield client
    _cleanup(patches)


def test_requires_auth():
    res = TestClient(app).get("/api/exchange-rates")
    assert res.status_code == 401


def test_fresh_cache_served_without_upstream_call(fresh_client):
    mock_client, httpx_patch = _mock_httpx(json_data=_CG_BODY)
    with httpx_patch:
        res = fresh_client.get("/api/exchange-rates")
    assert res.status_code == 200
    body = res.json()
    assert body["rates"]["USD"] == 1.0
    assert body["rates"]["BRL"] == pytest.approx(5.4321)
    assert set(body["rates"]) == {"USD", "BRL", "EUR", "GBP", "JPY"}
    mock_client.get.assert_not_called()


def test_empty_cache_fetches_and_derives_cross_rates(empty_client):
    mock_client, httpx_patch = _mock_httpx(json_data=_CG_BODY)
    with httpx_patch:
        res = empty_client.get("/api/exchange-rates")
    assert res.status_code == 200
    body = res.json()
    assert body["rates"]["USD"] == 1.0
    assert body["rates"]["BRL"] == pytest.approx(5.4321)
    assert body["rates"]["JPY"] == pytest.approx(157.32)
    mock_client.get.assert_called_once()


def test_stale_cache_refreshes_from_upstream(stale_client):
    mock_client, httpx_patch = _mock_httpx(json_data=_CG_BODY)
    with httpx_patch:
        res = stale_client.get("/api/exchange-rates")
    assert res.status_code == 200
    assert res.json()["rates"]["BRL"] == pytest.approx(5.4321)
    mock_client.get.assert_called_once()


def test_upstream_failure_falls_back_to_stale(stale_client):
    _, httpx_patch = _mock_httpx(status_code=429, is_success=False)
    with httpx_patch:
        res = stale_client.get("/api/exchange-rates")
    assert res.status_code == 200
    assert res.json()["rates"]["BRL"] == pytest.approx(5.4321)


def test_upstream_failure_without_cache_errors(empty_client):
    _, httpx_patch = _mock_httpx(status_code=503, is_success=False)
    with httpx_patch:
        res = empty_client.get("/api/exchange-rates")
    assert res.status_code == 502


def test_rate_limit_without_cache_returns_429(empty_client):
    _, httpx_patch = _mock_httpx(status_code=429, is_success=False)
    with httpx_patch:
        res = empty_client.get("/api/exchange-rates")
    assert res.status_code == 429


def test_malformed_upstream_response_errors(empty_client):
    _, httpx_patch = _mock_httpx(json_data={"unexpected": True})
    with httpx_patch:
        res = empty_client.get("/api/exchange-rates")
    assert res.status_code == 502


def test_missing_fiat_rate_errors(empty_client):
    _, httpx_patch = _mock_httpx(json_data={"bitcoin": {"usd": 100000.0, "brl": 543210.0}})
    with httpx_patch:
        res = empty_client.get("/api/exchange-rates")
    assert res.status_code == 502

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

_CACHED_ROW = {
    "coin_id": "bitcoin",
    "price_usd": "250000",
    "image_url": None,
    "updated_at": "2099-01-01T00:00:00+00:00",
}

_STALE_ROW = {
    "coin_id": "bitcoin",
    "price_usd": "200000",
    "image_url": None,
    "updated_at": "2000-01-01T00:00:00+00:00",
}


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
    """Return a patched httpx.Client that yields a fake response."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = is_success
    mock_resp.json.return_value = json_data or []

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return patch("app.routes.prices.httpx.Client", return_value=mock_client)


# ── Validation tests ────────────────────────────────────────────────────────

@pytest.fixture
def fresh_client():
    client, _, _, patches = _make_auth_client([_CACHED_ROW])
    yield client
    _cleanup(patches)


@pytest.fixture
def empty_client():
    client, _, _, patches = _make_auth_client([])
    yield client
    _cleanup(patches)


@pytest.fixture
def stale_client():
    client, _, _, patches = _make_auth_client([_STALE_ROW])
    yield client
    _cleanup(patches)


def test_path_traversal_coin_id_rejected(fresh_client):
    res = fresh_client.get("/api/prices?ids=../evil")
    assert res.status_code == 400
    assert "Invalid coin_id" in res.json()["detail"]


def test_oversized_coin_id_rejected(fresh_client):
    long_id = "a" * 121
    res = fresh_client.get(f"/api/prices?ids={long_id}")
    assert res.status_code == 400
    assert "Invalid coin_id" in res.json()["detail"]


def test_mixed_valid_invalid_rejected(fresh_client):
    res = fresh_client.get("/api/prices?ids=bitcoin,../evil")
    assert res.status_code == 400
    assert "Invalid coin_id" in res.json()["detail"]


def test_empty_ids_rejected(fresh_client):
    res = fresh_client.get("/api/prices?ids=,")
    assert res.status_code == 400
    assert "ids" in res.json()["detail"]


# ── Cache hit ───────────────────────────────────────────────────────────────

def test_valid_coin_id_fresh_cache(fresh_client):
    res = fresh_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 200
    assert "bitcoin" in res.json()


# ── DB error ────────────────────────────────────────────────────────────────

def test_db_error_returns_500():
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.execute.side_effect = Exception("db error")
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _auth():
        return AuthContext(user_id="user-test")

    app.dependency_overrides[require_auth] = _auth
    patches = [patch(t, return_value=conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    client = TestClient(app)

    try:
        res = client.get("/api/prices?ids=bitcoin")
        assert res.status_code == 500
    finally:
        _cleanup(patches)


# ── Cache miss — CoinGecko fetch paths ──────────────────────────────────────

def test_cache_miss_fetches_from_coingecko(empty_client):
    cg_data = [{"id": "bitcoin", "current_price": 250000.0, "image": None}]
    with _mock_httpx(json_data=cg_data):
        res = empty_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 200
    assert "bitcoin" in res.json()


def test_coingecko_rate_limit_reraises_when_no_stale(empty_client):
    with _mock_httpx(status_code=429, is_success=False):
        res = empty_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 429


def test_coingecko_upstream_failure_reraises_when_no_stale(empty_client):
    with _mock_httpx(status_code=503, is_success=False):
        res = empty_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 502


def test_coingecko_rate_limit_falls_back_to_stale(stale_client):
    with _mock_httpx(status_code=429, is_success=False):
        res = stale_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 200
    body = res.json()
    assert "bitcoin" in body
    assert body["bitcoin"]["price"] == 200000.0


def test_coingecko_non_list_response_returns_502(empty_client):
    with _mock_httpx(json_data={"error": "unexpected"}):
        res = empty_client.get("/api/prices?ids=bitcoin")
    assert res.status_code == 502

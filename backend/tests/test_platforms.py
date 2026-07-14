import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

_FRESH_ROWS = [
    {"id": "binance", "name": "Binance", "logo_url": "https://cg.example/binance.png", "updated_at": "2099-01-01T00:00:00+00:00"},
]
_STALE_ROWS = [{**row, "updated_at": "2000-01-01T00:00:00+00:00"} for row in _FRESH_ROWS]

_CG_BODY = [
    {"id": "binance", "name": "Binance", "image": "https://cg.example/binance.png"},
    {"id": "kraken", "name": "Kraken", "image": "https://cg.example/kraken.png"},
    {"id": "no-name"},
]


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


def _mock_httpx_get(status_code=200, is_success=True, json_data=None, content=b"", headers=None):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = is_success
    mock_resp.json.return_value = json_data if json_data is not None else {}
    mock_resp.content = content
    mock_resp.headers = headers or {}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return mock_client


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
    res = TestClient(app).get("/api/platforms/exchanges")
    assert res.status_code == 401


def test_fresh_cache_served_without_upstream_call(fresh_client):
    mock_client = _mock_httpx_get()
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = fresh_client.get("/api/platforms/exchanges")
    assert res.status_code == 200
    body = res.json()
    assert body["exchanges"] == [{"id": "binance", "name": "Binance", "logoUrl": "/api/platforms/logo/binance", "kind": "exchange"}]
    mock_client.get.assert_not_called()


def test_empty_cache_fetches_and_caches(empty_client):
    mock_client = _mock_httpx_get(json_data=_CG_BODY)
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = empty_client.get("/api/platforms/exchanges")
    assert res.status_code == 200
    body = res.json()
    ids = {e["id"] for e in body["exchanges"]}
    assert ids == {"binance", "kraken"}
    for e in body["exchanges"]:
        assert e["logoUrl"] == f"/api/platforms/logo/{e['id']}"
    mock_client.get.assert_called_once()


def test_stale_cache_refreshes_from_upstream(stale_client):
    mock_client = _mock_httpx_get(json_data=_CG_BODY)
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = stale_client.get("/api/platforms/exchanges")
    assert res.status_code == 200
    mock_client.get.assert_called_once()


def test_upstream_failure_falls_back_to_stale(stale_client):
    mock_client = _mock_httpx_get(status_code=502, is_success=False)
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = stale_client.get("/api/platforms/exchanges")
    assert res.status_code == 200
    assert res.json()["exchanges"][0]["id"] == "binance"


def test_upstream_failure_without_cache_errors(empty_client):
    mock_client = _mock_httpx_get(status_code=503, is_success=False)
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = empty_client.get("/api/platforms/exchanges")
    assert res.status_code == 502


def test_rate_limit_without_cache_returns_429(empty_client):
    mock_client = _mock_httpx_get(status_code=429, is_success=False)
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = empty_client.get("/api/platforms/exchanges")
    assert res.status_code == 429


def test_malformed_upstream_response_errors(empty_client):
    mock_client = _mock_httpx_get(json_data={"unexpected": True})
    with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = empty_client.get("/api/platforms/exchanges")
    assert res.status_code == 502


# ─── Logo proxy ─────────────────────────────────────────────────────────────

def test_logo_proxy_requires_no_auth_header():
    pg_conn, _ = make_pg_stub({"logo_url": "https://cg.example/binance.png"})
    mock_client = _mock_httpx_get(content=b"PNGDATA", headers={"content-type": "image/png"})
    with patch("app.routes.platforms.get_conn", return_value=pg_conn), \
         patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = TestClient(app).get("/api/platforms/logo/binance")
    assert res.status_code == 200
    assert res.content == b"PNGDATA"
    assert res.headers["content-type"] == "image/png"
    assert res.headers["cache-control"] == "public, max-age=604800"


def test_logo_proxy_unknown_id_returns_404():
    pg_conn, _ = make_pg_stub(None)
    with patch("app.routes.platforms.get_conn", return_value=pg_conn):
        res = TestClient(app).get("/api/platforms/logo/does-not-exist")
    assert res.status_code == 404


def test_logo_proxy_upstream_failure_returns_502():
    pg_conn, _ = make_pg_stub({"logo_url": "https://cg.example/binance.png"})
    mock_client = _mock_httpx_get(status_code=502, is_success=False)
    with patch("app.routes.platforms.get_conn", return_value=pg_conn), \
         patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = TestClient(app).get("/api/platforms/logo/binance")
    assert res.status_code == 502


# ─── Curated wallet/DeFi logos (kind column, data: URI storage) ────────────

_CURATED_ROW = {"id": "metamask", "name": "MetaMask", "logo_url": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "kind": "wallet"}


def _make_client_with_two_queries(exchange_rows, curated_rows):
    """Custom stub: the route issues two SELECTs in sequence (exchange rows, then
    curated rows) before the freshness branch — make_pg_stub's default only
    supports one meaningful result, so tests that care about both need this."""
    cur = MagicMock()
    cur.__enter__.return_value = cur
    results = [exchange_rows, curated_rows]
    cur.fetchall.side_effect = lambda *a, **k: results.pop(0) if results else []
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _auth():
        return AuthContext(user_id="user-test")

    app.dependency_overrides[require_auth] = _auth
    patches = [patch(t, return_value=conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    return TestClient(app), conn, cur, patches


def test_curated_entries_are_always_included_alongside_fresh_exchanges():
    client, _, _, patches = _make_client_with_two_queries(_FRESH_ROWS, [_CURATED_ROW])
    mock_client = _mock_httpx_get()
    try:
        with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
            res = client.get("/api/platforms/exchanges")
        assert res.status_code == 200
        body = res.json()
        ids = {e["id"] for e in body["exchanges"]}
        assert ids == {"binance", "metamask"}
        metamask_entry = next(e for e in body["exchanges"] if e["id"] == "metamask")
        assert metamask_entry == {"id": "metamask", "name": "MetaMask", "logoUrl": "/api/platforms/logo/metamask", "kind": "wallet"}
        mock_client.get.assert_not_called()
    finally:
        _cleanup(patches)


def test_curated_entries_do_not_affect_exchange_freshness():
    # A stale curated row (impossible in practice — curated rows are never
    # timestamp-checked) must not force a refetch; only exchange-kind rows count.
    stale_curated = {**_CURATED_ROW, "updated_at": "2000-01-01T00:00:00+00:00"}
    client, _, _, patches = _make_client_with_two_queries(_FRESH_ROWS, [stale_curated])
    mock_client = _mock_httpx_get()
    try:
        with patch("app.routes.platforms.httpx.Client", return_value=mock_client):
            res = client.get("/api/platforms/exchanges")
        assert res.status_code == 200
        mock_client.get.assert_not_called()
    finally:
        _cleanup(patches)


def test_logo_proxy_serves_a_stored_data_uri_without_any_upstream_call():
    pg_conn, _ = make_pg_stub({"logo_url": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="})
    mock_client = _mock_httpx_get()
    with patch("app.routes.platforms.get_conn", return_value=pg_conn), \
         patch("app.routes.platforms.httpx.Client", return_value=mock_client):
        res = TestClient(app).get("/api/platforms/logo/metamask")
    assert res.status_code == 200
    assert res.content == b"<svg></svg>"
    assert res.headers["content-type"] == "image/svg+xml"
    assert res.headers["cache-control"] == "public, max-age=604800"
    mock_client.get.assert_not_called()

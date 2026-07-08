import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

_CACHED_ROW = {"coin_id": "bitcoin", "date": "2026-01-01", "price_usd": "40000"}


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
    mock_resp.json.return_value = json_data if json_data is not None else {"prices": []}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return patch("app.providers.coingecko.httpx.Client", return_value=mock_client)


@pytest.fixture
def empty_client():
    client, _, _, patches = _make_auth_client([])
    yield client
    _cleanup(patches)


@pytest.fixture
def cached_client():
    client, _, _, patches = _make_auth_client([_CACHED_ROW])
    yield client
    _cleanup(patches)


# ── Validation ──────────────────────────────────────────────────────────────

def test_path_traversal_coin_id_rejected(empty_client):
    res = empty_client.get("/api/prices/history?ids=../evil&from=2026-01-01&to=2026-01-02")
    assert res.status_code == 400
    assert "Invalid coin_id" in res.json()["detail"]


def test_empty_ids_rejected(empty_client):
    res = empty_client.get("/api/prices/history?ids=,&from=2026-01-01&to=2026-01-02")
    assert res.status_code == 400


def test_malformed_from_date_rejected(empty_client):
    res = empty_client.get("/api/prices/history?ids=bitcoin&from=not-a-date&to=2026-01-02")
    assert res.status_code == 400
    assert "date range" in res.json()["detail"].lower()


def test_to_before_from_rejected(empty_client):
    res = empty_client.get("/api/prices/history?ids=bitcoin&from=2026-02-01&to=2026-01-01")
    assert res.status_code == 400
    assert "date range" in res.json()["detail"].lower()


def test_missing_auth_returns_401():
    client = TestClient(app)
    res = client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-02")
    assert res.status_code == 401


# ── Cache hit — no CoinGecko call ────────────────────────────────────────────

def test_cache_hit_skips_coingecko(cached_client):
    with _mock_httpx() as mocked_class:
        res = cached_client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
        assert not mocked_class.called
    assert res.status_code == 200
    body = res.json()
    assert body["bitcoin"]["2026-01-01"] == 40000.0


# ── Cache miss — CoinGecko fetch + upsert ────────────────────────────────────

def test_cache_miss_fetches_and_upserts(empty_client):
    cg_data = {"prices": [[1767225600000, 41000.5]]}  # 2026-01-01 UTC
    with _mock_httpx(json_data=cg_data):
        res = empty_client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
    assert res.status_code == 200
    body = res.json()
    assert body["bitcoin"]["2026-01-01"] == 41000.5


# ── Partial hit — one coin cached, one missing ───────────────────────────────

def test_partial_hit_only_fetches_missing_coin():
    pg_conn, cur = make_pg_stub([_CACHED_ROW])
    app.dependency_overrides[require_auth] = lambda: AuthContext(user_id="user-test")
    patches = [patch(t, return_value=pg_conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    client = TestClient(app)
    cg_data = {"prices": [[1767225600000, 2200.0]]}
    try:
        with _mock_httpx(json_data=cg_data):
            res = client.get("/api/prices/history?ids=bitcoin,ethereum&from=2026-01-01&to=2026-01-01")
        assert res.status_code == 200
        body = res.json()
        assert body["bitcoin"]["2026-01-01"] == 40000.0
        assert body["ethereum"]["2026-01-01"] == 2200.0
    finally:
        _cleanup(patches)


# ── Upstream failure fallback ────────────────────────────────────────────────

def test_coingecko_failure_falls_back_to_cache_for_other_coins():
    pg_conn, cur = make_pg_stub([_CACHED_ROW])
    app.dependency_overrides[require_auth] = lambda: AuthContext(user_id="user-test")
    patches = [patch(t, return_value=pg_conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    client = TestClient(app)
    try:
        with _mock_httpx(status_code=503, is_success=False):
            res = client.get("/api/prices/history?ids=bitcoin,ethereum&from=2026-01-01&to=2026-01-01")
        assert res.status_code == 200
        body = res.json()
        assert body["bitcoin"]["2026-01-01"] == 40000.0
        assert "ethereum" not in body
    finally:
        _cleanup(patches)


def test_coingecko_failure_with_nothing_cached_returns_502(empty_client):
    with _mock_httpx(status_code=503, is_success=False):
        res = empty_client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
    assert res.status_code == 502


def test_not_implemented_provider_returns_501_not_500(empty_client):
    with patch("app.routes.price_history.get_provider") as mock_provider:
        mock_provider.return_value.get_history.side_effect = NotImplementedError("nope")
        res = empty_client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
    assert res.status_code == 501


# ── Symbol threading (Item 13, User Story 3) ────────────────────────────────
# Custom cursor mock (not conftest.make_pg_stub): the route now issues two
# distinct SELECTs against the same connection (price_history cache, then the
# ops-symbol lookup), and these tests care about the second query's result.

def _symbol_client(cache_rows, ops_rows):
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.fetchall.side_effect = [cache_rows, ops_rows]
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _auth():
        return AuthContext(user_id="user-test")

    app.dependency_overrides[require_auth] = _auth
    patches = [patch(t, return_value=conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()
    return TestClient(app), cur, patches


def test_cache_miss_upserts_symbol_from_matching_op():
    client, cur, patches = _symbol_client([], [{"coin_id": "bitcoin", "symbol": "BTC"}])
    cg_data = {"prices": [[1767225600000, 41000.5]]}
    try:
        with _mock_httpx(json_data=cg_data):
            res = client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
        assert res.status_code == 200
        rows = cur.executemany.call_args.args[1]
        assert rows[0][0] == "bitcoin"
        assert rows[0][3] == "BTC"
    finally:
        _cleanup(patches)


def test_cache_miss_with_no_matching_op_upserts_null_symbol():
    client, cur, patches = _symbol_client([], [])
    cg_data = {"prices": [[1767225600000, 41000.5]]}
    try:
        with _mock_httpx(json_data=cg_data):
            res = client.get("/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-01")
        assert res.status_code == 200
        rows = cur.executemany.call_args.args[1]
        assert rows[0][0] == "bitcoin"
        assert rows[0][3] is None
    finally:
        _cleanup(patches)

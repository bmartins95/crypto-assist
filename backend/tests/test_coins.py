from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

_BITCOIN_RESULT = [{
    "id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1,
    "image": "https://cg.example/bitcoin-large.png",
}]
_FRESH_ROW = {"results": _BITCOIN_RESULT, "updated_at": "2099-01-01T00:00:00+00:00"}
_STALE_ROW = {**_FRESH_ROW, "updated_at": "2000-01-01T00:00:00+00:00"}


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


def _mock_httpx_client(status_code=200, is_success=True, json_data=None):
    """Returns the mock httpx.Client instance — patch app.providers.coingecko.httpx.Client
    with `return_value=` this, then assert on `.get.call_count`/`.get.assert_*` afterward."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = is_success
    mock_resp.json.return_value = json_data if json_data is not None else {"coins": []}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    return mock_client


def test_search_returns_results():
    client, _, _, patches = _make_auth_client(None)
    cg_data = {"coins": [{
        "id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1,
        "large": "https://cg.example/bitcoin-large.png", "thumb": "https://cg.example/bitcoin-thumb.png",
    }]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        assert res.json() == _BITCOIN_RESULT
    finally:
        _cleanup(patches)


def test_search_falls_back_to_thumb_when_large_missing():
    client, _, _, patches = _make_auth_client(None)
    cg_data = {"coins": [{
        "id": "bitcoin", "symbol": "btc", "name": "Bitcoin",
        "thumb": "https://cg.example/bitcoin-thumb.png",
    }]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.json()[0]["image"] == "https://cg.example/bitcoin-thumb.png"
    finally:
        _cleanup(patches)


def test_search_image_is_none_when_absent():
    client, _, _, patches = _make_auth_client(None)
    cg_data = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"}]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.json()[0]["image"] is None
    finally:
        _cleanup(patches)


def test_search_respects_limit():
    client, _, _, patches = _make_auth_client(None)
    cg_data = {"coins": [
        {"id": f"coin{i}", "symbol": f"c{i}", "name": f"Coin {i}", "market_cap_rank": i}
        for i in range(10)
    ]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=coin&limit=3")
        assert res.status_code == 200
        assert len(res.json()) == 3
    finally:
        _cleanup(patches)


def test_empty_query_rejected():
    client, _, _, patches = _make_auth_client(None)
    try:
        res = client.get("/api/coins/search?q=")
        assert res.status_code == 400
        assert "q" in res.json()["detail"]
    finally:
        _cleanup(patches)


def test_missing_query_rejected():
    client, _, _, patches = _make_auth_client(None)
    try:
        res = client.get("/api/coins/search")
        assert res.status_code == 400
    finally:
        _cleanup(patches)


def test_missing_auth_returns_401():
    res = TestClient(app).get("/api/coins/search?q=bitcoin")
    assert res.status_code == 401


def test_coingecko_rate_limit_propagates():
    client, _, _, patches = _make_auth_client(None)
    mock_client = _mock_httpx_client(status_code=429, is_success=False)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 429
    finally:
        _cleanup(patches)


def test_coingecko_upstream_failure_returns_502():
    client, _, _, patches = _make_auth_client(None)
    mock_client = _mock_httpx_client(status_code=503, is_success=False)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 502
    finally:
        _cleanup(patches)


def test_not_implemented_provider_returns_501():
    client, _, _, patches = _make_auth_client(None)
    try:
        with patch("app.routes.coins.get_provider") as mock_provider:
            mock_provider.return_value.search_coins.side_effect = NotImplementedError("nope")
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 501
    finally:
        _cleanup(patches)


# ─── Caching ────────────────────────────────────────────────────────────────

def test_fresh_cache_served_without_upstream_call():
    client, _, _, patches = _make_auth_client(_FRESH_ROW)
    mock_client = _mock_httpx_client()
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        assert res.json() == _BITCOIN_RESULT
        mock_client.get.assert_not_called()
    finally:
        _cleanup(patches)


def test_cache_lookup_is_case_and_whitespace_insensitive():
    client, _, cur, patches = _make_auth_client(_FRESH_ROW)
    mock_client = _mock_httpx_client()
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=%20BitCoin%20")
        assert res.status_code == 200
        assert res.json() == _BITCOIN_RESULT
        cur.execute.assert_any_call(
            "SELECT results, updated_at FROM coin_search_cache WHERE query = %s", ("bitcoin",)
        )
        mock_client.get.assert_not_called()
    finally:
        _cleanup(patches)


def test_empty_cache_fetches_and_caches():
    client, pg_conn, cur, patches = _make_auth_client(None)
    cg_data = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "large": "https://cg.example/bitcoin-large.png"}]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        assert res.json()[0]["id"] == "bitcoin"
        mock_client.get.assert_called_once()
        insert_calls = [c for c in cur.execute.call_args_list if "INSERT INTO coin_search_cache" in c.args[0]]
        assert len(insert_calls) == 1
        assert insert_calls[0].args[1][0] == "bitcoin"
        pg_conn.commit.assert_called_once()
    finally:
        _cleanup(patches)


def test_stale_cache_refetches_from_upstream():
    client, _, _, patches = _make_auth_client(_STALE_ROW)
    cg_data = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "large": "https://cg.example/bitcoin-large.png"}]}
    mock_client = _mock_httpx_client(json_data=cg_data)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        mock_client.get.assert_called_once()
    finally:
        _cleanup(patches)


def test_upstream_failure_falls_back_to_stale_cache():
    client, _, _, patches = _make_auth_client(_STALE_ROW)
    mock_client = _mock_httpx_client(status_code=502, is_success=False)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        assert res.json() == _BITCOIN_RESULT
    finally:
        _cleanup(patches)


def test_upstream_failure_without_cache_still_errors():
    client, _, _, patches = _make_auth_client(None)
    mock_client = _mock_httpx_client(status_code=502, is_success=False)
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 502
    finally:
        _cleanup(patches)


def test_cache_write_failure_does_not_break_a_successful_search():
    client, pg_conn, cur, patches = _make_auth_client(None)
    cg_data = {"coins": [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "large": "https://cg.example/bitcoin-large.png"}]}
    mock_client = _mock_httpx_client(json_data=cg_data)

    def _execute_side_effect(sql, *args, **kwargs):
        if "INSERT INTO coin_search_cache" in sql:
            raise Exception("db write failed")
        return None

    cur.execute.side_effect = _execute_side_effect
    try:
        with patch("app.providers.coingecko.httpx.Client", return_value=mock_client):
            res = client.get("/api/coins/search?q=bitcoin")
        assert res.status_code == 200
        assert res.json()[0]["id"] == "bitcoin"
        pg_conn.rollback.assert_called_once()
    finally:
        _cleanup(patches)

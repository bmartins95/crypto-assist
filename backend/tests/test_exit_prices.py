import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import MOCK_USER_ID, _DB_PATCH_TARGETS

_ROW = {"coin_id": "bitcoin", "exit_price": "500000.0"}


@pytest.fixture
def error_client():
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.execute.side_effect = Exception("db error")
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _mock_auth():
        return AuthContext(user_id=MOCK_USER_ID)

    app.dependency_overrides[require_auth] = _mock_auth
    patches = [patch(t, return_value=conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()

    yield TestClient(app), conn

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


@pytest.mark.pgdata([])
def test_get_exit_prices_empty(client_with_db):
    client, _ = client_with_db
    res = client.get("/api/exit-prices")
    assert res.status_code == 200
    assert res.json() == {}


@pytest.mark.pgdata([_ROW])
def test_get_exit_prices_populated(client_with_db):
    client, _ = client_with_db
    res = client.get("/api/exit-prices")
    assert res.status_code == 200
    assert res.json() == {"bitcoin": 500000.0}


def test_get_exit_prices_requires_auth():
    res = TestClient(app).get("/api/exit-prices")
    assert res.status_code == 401


@pytest.mark.pgdata([])
def test_put_exit_price_creates(client_with_db):
    client, conn = client_with_db
    res = client.put("/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": 500000.0})
    assert res.status_code == 204
    sql, params = conn.cursor.return_value.execute.call_args[0]
    assert "INSERT INTO exit_prices" in sql
    assert "ON CONFLICT" in sql
    assert params[1:] == ("bitcoin", 500000.0)


@pytest.mark.pgdata([])
def test_put_exit_price_updates_existing(client_with_db):
    client, conn = client_with_db
    res = client.put("/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": 600000.0})
    assert res.status_code == 204
    sql, params = conn.cursor.return_value.execute.call_args[0]
    assert "ON CONFLICT (user_id, coin_id) DO UPDATE" in sql
    assert params[1:] == ("bitcoin", 600000.0)


@pytest.mark.pgdata([])
def test_put_exit_price_zero_deletes(client_with_db):
    client, conn = client_with_db
    res = client.put("/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": 0})
    assert res.status_code == 204
    sql, params = conn.cursor.return_value.execute.call_args[0]
    assert sql.startswith("DELETE FROM exit_prices")
    assert params[1] == "bitcoin"


@pytest.mark.pgdata([])
def test_put_exit_price_negative_deletes(client_with_db):
    client, conn = client_with_db
    res = client.put("/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": -1})
    assert res.status_code == 204
    sql, _ = conn.cursor.return_value.execute.call_args[0]
    assert sql.startswith("DELETE FROM exit_prices")


@pytest.mark.pgdata([])
def test_put_exit_price_delete_nonexistent_row_is_idempotent(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.rowcount = 0
    res = client.put("/api/exit-prices", json={"coinId": "unknown-coin", "exitPrice": 0})
    assert res.status_code == 204


def test_put_exit_price_requires_auth():
    res = TestClient(app).put(
        "/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": 500000.0}
    )
    assert res.status_code == 401


def test_get_exit_prices_db_error(error_client):
    client, _ = error_client
    res = client.get("/api/exit-prices")
    assert res.status_code == 500


def test_put_exit_price_db_error_rolls_back(error_client):
    client, conn = error_client
    res = client.put("/api/exit-prices", json={"coinId": "bitcoin", "exitPrice": 500000.0})
    assert res.status_code == 500
    conn.rollback.assert_called_once()

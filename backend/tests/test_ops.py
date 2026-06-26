import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import MOCK_USER_ID, _DB_PATCH_TARGETS


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

_DB_ROW = {
    "id": "op-1",
    "date": "2024-01-15",
    "coin_id": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Compra",
    "qty": "0.01",
    "price": "250000",
    "fee": "5",
    "total": "2505",
    "platform": "Binance",
}

_API_OP = {
    "id": "op-1",
    "date": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Compra",
    "qty": 0.01,
    "price": 250000.0,
    "fee": 5.0,
    "total": 2505.0,
    "platform": "Binance",
}

_NEW_OP_BODY = {
    "date": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Compra",
    "qty": 0.01,
    "price": 250000.0,
    "fee": 5.0,
    "total": 2505.0,
    "platform": "Binance",
}


@pytest.mark.pgdata([_DB_ROW])
def test_list_ops(client_with_db):
    client, _ = client_with_db
    res = client.get("/api/ops")
    assert res.status_code == 200
    assert res.json() == [_API_OP]


@pytest.mark.pgdata(_DB_ROW)
def test_create_op(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json=_NEW_OP_BODY)
    assert res.status_code == 201
    assert res.json() == _API_OP


@pytest.mark.pgdata({})
def test_create_op_missing_fields(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={"symbol": "BTC"})
    assert res.status_code == 422  # FastAPI validation error


@pytest.mark.pgdata(_DB_ROW)
def test_update_op(client_with_db):
    client, _ = client_with_db
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 200
    assert res.json() == _API_OP


@pytest.mark.pgdata({})
def test_delete_op(client_with_db):
    client, _ = client_with_db
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 204


def test_list_ops_db_error(error_client):
    client, _ = error_client
    res = client.get("/api/ops")
    assert res.status_code == 500


def test_create_op_db_error(error_client):
    client, conn = error_client
    res = client.post("/api/ops", json=_NEW_OP_BODY)
    assert res.status_code == 500
    conn.rollback.assert_called_once()


@pytest.mark.pgdata(None)
def test_update_op_not_found(client_with_db):
    client, _ = client_with_db
    res = client.put("/api/ops/nonexistent", json=_NEW_OP_BODY)
    assert res.status_code == 404


def test_update_op_db_error(error_client):
    client, conn = error_client
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 500
    conn.rollback.assert_called_once()


def test_delete_op_db_error(error_client):
    client, conn = error_client
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 500
    conn.rollback.assert_called_once()

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
    "type": "Buy",
    "qty": "0.01",
    "price": "250000",
    "fee": "5",
    "total": "2505",
    "platform_id": "binance",
    "platform_name": "Binance",
    "currency": "BRL",
    "leverage": None,
}

_API_OP = {
    "id": "op-1",
    "date": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Buy",
    "qty": 0.01,
    "price": 250000.0,
    "fee": 5.0,
    "total": 2505.0,
    "platformId": "binance",
    "platformName": "Binance",
    "currency": "BRL",
    "leverage": None,
}

_NEW_OP_BODY = {
    "date": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Buy",
    "qty": 0.01,
    "price": 250000.0,
    "fee": 5.0,
    "total": 2505.0,
    "platformId": "binance",
    "platformName": "Binance",
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
    assert res.status_code == 422


@pytest.mark.pgdata({})
def test_create_op_portuguese_type_rejected(client_with_db):
    client, _ = client_with_db
    body = {**_NEW_OP_BODY, "type": "Compra"}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 422


@pytest.mark.pgdata({})
def test_create_op_portuguese_sell_rejected(client_with_db):
    client, _ = client_with_db
    body = {**_NEW_OP_BODY, "type": "Venda"}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 422


@pytest.mark.pgdata({**_DB_ROW, "currency": "USD"})
def test_create_op_records_entry_currency(client_with_db):
    client, conn = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "currency": "USD"})
    assert res.status_code == 201
    assert res.json()["currency"] == "USD"
    insert_params = conn.cursor.return_value.execute.call_args[0][1]
    assert insert_params[-2] == "USD"


@pytest.mark.pgdata({})
def test_create_op_invalid_currency_rejected(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "currency": "XYZ"})
    assert res.status_code == 422


@pytest.mark.pgdata(_DB_ROW)
def test_create_op_defaults_to_brl_when_currency_omitted(client_with_db):
    client, _ = client_with_db
    body = {k: v for k, v in _NEW_OP_BODY.items() if k != "currency"}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 201
    assert res.json()["currency"] == "BRL"


@pytest.mark.pgdata(_DB_ROW)
def test_update_op(client_with_db):
    client, _ = client_with_db
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 200
    assert res.json() == _API_OP


_DB_ROW_NO_PLATFORM = {**_DB_ROW, "platform_id": None, "platform_name": None}
_NEW_OP_BODY_NO_PLATFORM = {k: v for k, v in _NEW_OP_BODY.items() if k not in ("platformId", "platformName")}


@pytest.mark.pgdata(_DB_ROW_NO_PLATFORM)
def test_create_op_without_platform_leaves_it_null(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json=_NEW_OP_BODY_NO_PLATFORM)
    assert res.status_code == 201
    assert res.json()["platformId"] is None
    assert res.json()["platformName"] is None


@pytest.mark.pgdata({})
def test_create_op_platform_id_without_name_rejected(client_with_db):
    client, _ = client_with_db
    body = {**_NEW_OP_BODY_NO_PLATFORM, "platformId": "binance"}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 422


@pytest.mark.pgdata({})
def test_create_op_platform_name_without_id_rejected(client_with_db):
    client, _ = client_with_db
    body = {**_NEW_OP_BODY_NO_PLATFORM, "platformName": "Binance"}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 422


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


def test_delete_all_ops_no_auth():
    res = TestClient(app).delete("/api/ops")
    assert res.status_code == 401


@pytest.mark.pgdata([])
def test_delete_all_ops_success(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.rowcount = 5
    res = client.delete("/api/ops")
    assert res.status_code == 200
    assert res.json() == {"deleted": 5}


@pytest.mark.pgdata([])
def test_delete_all_ops_empty(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.rowcount = 0
    res = client.delete("/api/ops")
    assert res.status_code == 200
    assert res.json() == {"deleted": 0}


def test_delete_all_ops_db_error(error_client):
    client, conn = error_client
    res = client.delete("/api/ops")
    assert res.status_code == 500
    conn.rollback.assert_called_once()


@pytest.mark.pgdata(None)
def test_update_op_blocked_when_closure_exists(client_with_db):
    # First fetchone (UPDATE ... WHERE NOT EXISTS (...) RETURNING ...) finds no row
    # because the closure-guard subquery excluded it; second fetchone (the plain
    # existence check) finds a closure row, so the op is reported as blocked, not
    # missing.
    client, conn = client_with_db
    conn.cursor.return_value.fetchone.side_effect = [None, {"exists": 1}]
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 409
    assert "closure" in res.json()["detail"].lower()


@pytest.mark.pgdata(_DB_ROW)
def test_create_op_with_leverage(client_with_db):
    client, conn = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "leverage": 3})
    assert res.status_code == 201
    insert_params = conn.cursor.return_value.execute.call_args[0][1]
    assert insert_params[-1] == 3


@pytest.mark.pgdata({})
def test_create_op_invalid_leverage_rejected(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "leverage": 4})
    assert res.status_code == 422

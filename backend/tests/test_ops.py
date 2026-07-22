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
    "trade_group_id": None,
    "op_kind": "wallet",
    "side": None,
    "created_at": "2024-01-15T00:00:00+00:00",
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
    "tradeGroupId": None,
    "kind": "wallet",
    "side": None,
    "createdAt": "2024-01-15T00:00:00+00:00",
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


@pytest.mark.pgdata([_DB_ROW])
def test_list_ops_orders_by_date_then_created_at(client_with_db):
    # `date` alone doesn't disambiguate same-day ops — without this tie-break, ops
    # returned in an unspecified order can make the frontend's FIFO walk (which relies
    # on this same ordering) misplace a same-day Buy after a same-day Sell.
    client, conn = client_with_db
    client.get("/api/ops")
    cur = conn.cursor.return_value
    executed = [c.args[0] for c in cur.execute.call_args_list]
    assert any("ORDER BY date, created_at" in q for q in executed)


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
    assert insert_params[-5] == "USD"


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


@pytest.mark.pgdata(_DB_ROW)
def test_delete_op(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.fetchall.side_effect = [[], [{"id": "op-1"}]]
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 200
    assert res.json() == {"deletedIds": ["op-1"]}


@pytest.mark.pgdata({})
def test_delete_op_not_found(client_with_db):
    client, _ = client_with_db
    res = client.delete("/api/ops/missing")
    assert res.status_code == 404


def test_delete_op_deletes_the_whole_trade_group(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {
        "trade_group_id": "grp-1", "op_kind": "wallet",
        "coin_id": "bitcoin", "platform_id": "binance", "currency": "BRL",
    }
    cur.fetchall.side_effect = [[], [{"id": "op-1"}, {"id": "op-2"}]]
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 200
    assert set(res.json()["deletedIds"]) == {"op-1", "op-2"}


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


def test_update_op_blocked_when_closure_exists(client_with_db):
    # fetchone #1: current-row lookup (kind/side/group unchanged from the PUT body,
    # so both the immutability and balance checks pass); fetchone #2: the
    # UPDATE...WHERE NOT EXISTS(...) RETURNING finds no row because the closure-guard
    # subquery excluded it; fetchone #3: the plain existence check finds a closure row.
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.side_effect = [_DB_ROW, None, {"exists": 1}]
    cur.fetchall.side_effect = [[]]
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 409
    assert "closure" in res.json()["detail"].lower()


def test_update_op_classification_change_rejected(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.fetchone.return_value = _DB_ROW
    res = client.put("/api/ops/op-1", json={**_NEW_OP_BODY, "kind": "trade", "side": "long"})
    assert res.status_code == 400
    assert "classification" in res.json()["detail"].lower()


@pytest.mark.pgdata(_DB_ROW)
def test_create_op_with_leverage(client_with_db):
    client, conn = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "leverage": 3, "kind": "trade"})
    assert res.status_code == 201
    insert_params = conn.cursor.return_value.execute.call_args[0][1]
    assert insert_params[-4] == 3


@pytest.mark.pgdata({})
def test_create_op_invalid_leverage_rejected(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "leverage": 4, "kind": "trade"})
    assert res.status_code == 422


@pytest.mark.pgdata({})
def test_create_op_leverage_on_wallet_rejected(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "leverage": 3})
    assert res.status_code == 400
    assert "leverage" in res.json()["detail"].lower()


@pytest.mark.pgdata({})
def test_create_op_side_on_wallet_rejected(client_with_db):
    client, _ = client_with_db
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "side": "long"})
    assert res.status_code == 400


def test_create_op_trade_derives_side_from_type(client_with_db):
    client, conn = client_with_db
    conn.cursor.return_value.fetchone.return_value = {**_DB_ROW, "op_kind": "trade", "side": "long", "leverage": 3}
    res = client.post("/api/ops", json={**_NEW_OP_BODY, "kind": "trade", "leverage": 3, "side": "short"})
    assert res.status_code == 201
    insert_params = conn.cursor.return_value.execute.call_args[0][1]
    # side is derived from type ('Buy' -> 'long'), never trusting the client's 'short'.
    assert insert_params[-1] == "long"


def test_create_op_trade_sell_no_balance_check(client_with_db):
    # A trade Sell (short) never checks wallet balance, unlike a wallet Sell.
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {**_DB_ROW, "op_kind": "trade", "side": "short", "type": "Sell"}
    body = {**_NEW_OP_BODY, "type": "Sell", "kind": "trade", "leverage": 5}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 201
    cur.fetchall.assert_not_called()


def test_create_op_wallet_sell_exceeds_balance_rejected(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchall.side_effect = [[]]  # no prior wallet buys for this coin/platform/currency
    body = {**_NEW_OP_BODY, "type": "Sell", "qty": 5}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 400
    assert "negative balance" in res.json()["detail"].lower()
    cur.execute.assert_called_once()  # the SELECT for the balance check, no INSERT reached


def test_create_op_wallet_sell_within_balance_succeeds(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    prior_buy = {"id": "buy-1", "date": "2024-01-01", "created_at": "2024-01-01T00:00:00+00:00", "type": "Buy", "qty": "1"}
    cur.fetchall.side_effect = [[prior_buy]]
    cur.fetchone.return_value = {**_DB_ROW, "type": "Sell", "qty": "0.5"}
    body = {**_NEW_OP_BODY, "type": "Sell", "qty": 0.5}
    res = client.post("/api/ops", json=body)
    assert res.status_code == 201


def test_update_op_wallet_negative_balance_rejected(client_with_db):
    # Editing the buy's quantity down below what a later sell already consumed.
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = _DB_ROW
    later_sell = {"id": "sell-1", "date": "2024-01-20", "created_at": "2024-01-20T00:00:00+00:00", "type": "Sell", "qty": "0.01"}
    cur.fetchall.side_effect = [[later_sell]]
    body = {**_NEW_OP_BODY, "qty": 0.005}
    res = client.put("/api/ops/op-1", json=body)
    assert res.status_code == 400
    assert "negative balance" in res.json()["detail"].lower()


def test_delete_op_wallet_negative_balance_rejected(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = {
        "trade_group_id": None, "op_kind": "wallet",
        "coin_id": "bitcoin", "platform_id": "binance", "currency": "BRL",
    }
    later_sell = {"id": "sell-1", "date": "2024-01-20", "created_at": "2024-01-20T00:00:00+00:00", "type": "Sell", "qty": "0.01"}
    cur.fetchall.side_effect = [[later_sell]]
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 400
    assert "negative balance" in res.json()["detail"].lower()


def test_update_op_moved_to_different_platform_checks_both_groups(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = _DB_ROW
    # Old group (binance): no other ops, so removing this op from it is fine.
    # New group (kraken): no prior ops either, so adding it there is fine too.
    cur.fetchall.side_effect = [[], []]
    body = {**_NEW_OP_BODY, "platformId": "kraken", "platformName": "Kraken"}
    res = client.put("/api/ops/op-1", json=body)
    assert res.status_code == 200
    assert cur.fetchall.call_count == 2


def test_update_op_moved_to_different_platform_rejects_negative_balance_in_old_group(client_with_db):
    client, conn = client_with_db
    cur = conn.cursor.return_value
    cur.fetchone.return_value = _DB_ROW
    # A later sell still on the old platform (binance) would be left with nothing once
    # this buy moves away to kraken.
    later_sell = {"id": "sell-1", "date": "2024-01-20", "created_at": "2024-01-20T00:00:00+00:00", "type": "Sell", "qty": "0.01"}
    cur.fetchall.side_effect = [[later_sell]]
    body = {**_NEW_OP_BODY, "platformId": "kraken", "platformName": "Kraken"}
    res = client.put("/api/ops/op-1", json=body)
    assert res.status_code == 400
    assert "negative balance" in res.json()["detail"].lower()

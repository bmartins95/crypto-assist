import pytest
from tests.conftest import MOCK_USER_ID

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


@pytest.mark.supabase([_DB_ROW])
def test_list_ops(client_with_sb):
    client, _ = client_with_sb
    res = client.get("/api/ops/")
    assert res.status_code == 200
    assert res.json() == [_API_OP]


@pytest.mark.supabase(_DB_ROW)
def test_create_op(client_with_sb):
    client, _ = client_with_sb
    res = client.post("/api/ops/", json=_NEW_OP_BODY)
    assert res.status_code == 201
    assert res.json() == _API_OP


@pytest.mark.supabase({})
def test_create_op_missing_fields(client_with_sb):
    client, _ = client_with_sb
    res = client.post("/api/ops/", json={"symbol": "BTC"})
    assert res.status_code == 422  # FastAPI validation error


@pytest.mark.supabase(_DB_ROW)
def test_update_op(client_with_sb):
    client, _ = client_with_sb
    res = client.put("/api/ops/op-1", json=_NEW_OP_BODY)
    assert res.status_code == 200
    assert res.json() == _API_OP


@pytest.mark.supabase({})
def test_delete_op(client_with_sb):
    client, _ = client_with_sb
    res = client.delete("/api/ops/op-1")
    assert res.status_code == 204

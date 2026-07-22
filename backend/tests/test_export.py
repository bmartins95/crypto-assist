import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import MOCK_USER_ID, _DB_PATCH_TARGETS

_OP_ROW = {
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
}

_EXIT_PRICE_ROW = {"coin_id": "bitcoin", "exit_price": "500000.0"}


@pytest.fixture
def export_client():
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.fetchall.side_effect = [[_OP_ROW], [_EXIT_PRICE_ROW]]
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _mock_auth():
        return AuthContext(user_id=MOCK_USER_ID)

    app.dependency_overrides[require_auth] = _mock_auth
    patches = [patch(t, return_value=conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()

    yield TestClient(app)

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


def test_export_populated_account_matches_backup_payload_shape(export_client):
    res = export_client.get("/api/export")
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == 1
    assert "exportedAt" in body
    assert body["ops"] == [
        {
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
            "createdAt": None,
        }
    ]
    assert body["exitPrices"] == {"bitcoin": 500000.0}


@pytest.mark.pgdata([])
def test_export_empty_account_returns_valid_payload(client_with_db):
    client, _ = client_with_db
    res = client.get("/api/export")
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == 1
    assert body["ops"] == []
    assert body["exitPrices"] == {}


def test_export_requires_auth():
    res = TestClient(app).get("/api/export")
    assert res.status_code == 401


@pytest.fixture
def export_error_client():
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

    yield TestClient(app)

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


def test_export_db_error(export_error_client):
    res = export_error_client.get("/api/export")
    assert res.status_code == 500

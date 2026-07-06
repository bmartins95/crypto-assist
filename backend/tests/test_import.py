import logging

from fastapi.testclient import TestClient

from app.main import app

_PAYLOAD_BASE = {"version": 1, "exportedAt": "2026-07-05T00:00:00Z"}


def _op(**overrides):
    op = {
        "date": "2026-06-15",
        "coinId": "bitcoin",
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "Buy",
        "qty": 0.5,
        "price": 100000.0,
        "fee": 0,
        "total": 50000.0,
        "platform": "Binance",
    }
    op.update(overrides)
    return op


def test_import_accepts_ops_without_id(client_with_db):
    client, pg_conn = client_with_db
    res = client.post("/api/import", json={**_PAYLOAD_BASE, "ops": [_op()]})
    assert res.status_code == 204
    cur = pg_conn.cursor.return_value
    assert cur.executemany.called


def test_import_accepts_ops_with_legacy_id_and_extra_fields(client_with_db):
    client, _ = client_with_db
    res = client.post(
        "/api/import",
        json={**_PAYLOAD_BASE, "ops": [_op(id="abc-123")], "prices": {}, "pricesTime": None},
    )
    assert res.status_code == 204


def test_import_coerces_portuguese_type_values(client_with_db):
    client, pg_conn = client_with_db
    res = client.post(
        "/api/import",
        json={**_PAYLOAD_BASE, "ops": [_op(type="Compra"), _op(type="Venda")]},
    )
    assert res.status_code == 204
    cur = pg_conn.cursor.return_value
    rows = cur.executemany.call_args_list[0].args[1]
    assert [r[5] for r in rows] == ["Buy", "Sell"]


def test_import_rejects_malformed_op_and_logs_failing_fields(client_with_db, caplog):
    client, _ = client_with_db
    bad_op = _op()
    del bad_op["qty"]
    with caplog.at_level(logging.WARNING):
        res = client.post("/api/import", json={**_PAYLOAD_BASE, "ops": [bad_op]})
    assert res.status_code == 422
    assert any("validation_failure" in r.message and "qty" in r.message for r in caplog.records)
    assert "50000" not in caplog.text


def test_import_writes_positive_exit_prices_only(client_with_db):
    client, pg_conn = client_with_db
    res = client.post(
        "/api/import",
        json={**_PAYLOAD_BASE, "ops": [], "exitPrices": {"bitcoin": 500000.0, "ethereum": 0}},
    )
    assert res.status_code == 204
    cur = pg_conn.cursor.return_value
    rows = cur.executemany.call_args_list[-1].args[1]
    assert rows == [("user-abc-123", "bitcoin", 500000.0)]


def test_import_db_failure_returns_500_and_rolls_back(client_with_db):
    client, pg_conn = client_with_db
    cur = pg_conn.cursor.return_value
    cur.execute.side_effect = Exception("db exploded")
    res = client.post("/api/import", json={**_PAYLOAD_BASE, "ops": [_op()]})
    assert res.status_code == 500
    assert "db exploded" in res.json()["detail"]
    assert pg_conn.rollback.called


def test_import_requires_auth():
    res = TestClient(app).post("/api/import", json={**_PAYLOAD_BASE, "ops": []})
    assert res.status_code == 401

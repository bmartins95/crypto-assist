import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import MOCK_USER_ID

_SOURCE_ROW = {
    "id": "buy-1",
    "date": "2024-01-01",
    "coin_id": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Buy",
    "qty": "1",
    "price": "100",
    "fee": "0",
    "total": "100",
    "platform_id": "binance",
    "platform_name": "Binance",
    "currency": "BRL",
    "leverage": 3,
    "trade_group_id": None,
    "op_kind": "trade",
    "side": "long",
    "created_at": "2024-01-01T00:00:00+00:00",
}

_CLOSING_OP_BODY = {
    "date": "2024-02-01",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Sell",
    "qty": 1,
    "price": 150,
    "fee": 0,
    "total": 150,
    "platformId": "binance",
    "platformName": "Binance",
    "currency": "BRL",
}

_CLOSING_ROW = {
    "id": "sell-1",
    "date": "2024-02-01",
    "coin_id": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Sell",
    "qty": "1",
    "price": "150",
    "fee": "0",
    "total": "150",
    "platform_id": "binance",
    "platform_name": "Binance",
    "currency": "BRL",
    "leverage": None,
    "trade_group_id": None,
    "op_kind": "trade",
    "side": "short",
    "created_at": "2024-02-01T00:00:00+00:00",
}


def _closure_row(id_, source_id, qty, pnl):
    return {"id": id_, "source_op_id": source_id, "closing_op_id": "sell-1", "qty_closed": qty, "realized_pnl": pnl}


@pytest.fixture
def close_client():
    """
    Custom mock for POST /{id}/close's multi-query flow: fetchone is called once for
    the source lookup, once per INSERT ... RETURNING (closing op, then each closure
    row); fetchall is called once for the candidate lots, once for their closed sums.
    Each test sets `cur.fetchone.side_effect` / `cur.fetchall.side_effect` itself.
    """
    cur = MagicMock()
    cur.__enter__.return_value = cur
    conn = MagicMock()
    conn.cursor.return_value = cur

    def _mock_auth():
        return AuthContext(user_id=MOCK_USER_ID)

    app.dependency_overrides[require_auth] = _mock_auth
    patches = [patch("app.routes.op_closures.get_conn", return_value=conn), patch("app.routes.ops.get_conn", return_value=conn)]
    for p in patches:
        p.start()

    yield TestClient(app), conn, cur

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


_CROSS_ASSET_SOL_BODY = {
    "date": "2024-02-01",
    "coinId": "solana", "symbol": "SOL", "name": "Solana",
    "type": "Sell", "qty": 5, "price": 12, "fee": 0, "total": 60,
    "platformId": "phantom", "platformName": "Phantom", "currency": "BRL",
}


def test_close_op_full_close(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW, _CLOSING_ROW, _closure_row("c1", "buy-1", 1, 50)]
    cur.fetchall.side_effect = [[_SOURCE_ROW], []]  # candidates: just the source itself; no prior closures

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 201
    body = res.json()
    assert body["closingOp"]["id"] == "sell-1"
    assert len(body["closures"]) == 1
    assert body["closures"][0]["qtyClosed"] == 1
    assert body["closures"][0]["realizedPnl"] == 50
    conn.commit.assert_called_once()
    # The closing leg is stored as a trade op with a server-derived side, never trusting
    # whatever the client sent on closingOp (spec FR-015).
    insert_params = next(c for c in cur.execute.call_args_list if "INSERT INTO ops" in c.args[0]).args[1]
    assert insert_params[-2:] == ("trade", "short")


def test_close_op_realized_pnl_scaled_by_source_leverage(close_client):
    # _SOURCE_ROW carries leverage=3; the persisted realized_pnl must scale by it just
    # like the drawer's own live preview (estimateClosePnl) already does — a mismatch
    # here means the leveraged preview shown before submit doesn't match what actually
    # gets stored and read back everywhere else (History P/L column, cycle summaries).
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW, _CLOSING_ROW, _closure_row("c1", "buy-1", 1, 150)]
    cur.fetchall.side_effect = [[_SOURCE_ROW], []]

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 201
    insert_params = next(c for c in cur.execute.call_args_list if "INSERT INTO op_closures" in c.args[0]).args[1]
    # (150 sell - 100 buy) * 1 qty * 3x leverage = 150, not the unleveraged 50.
    assert insert_params[3] == 150


def test_close_op_spans_multiple_source_ops_each_uses_its_own_leverage(close_client):
    # Two source lots opened at different leverage multiples, closed together in one
    # request — each lot's own leverage must scale its own share of the P/L, not the
    # leverage of whichever op the close was addressed to.
    client, conn, cur = close_client
    lot_2x = {**_SOURCE_ROW, "id": "buy-1", "qty": "0.5", "leverage": 2}
    lot_5x = {**_SOURCE_ROW, "id": "buy-2", "qty": "0.5", "leverage": 5}
    cur.fetchone.side_effect = [
        lot_2x,
        _CLOSING_ROW,
        _closure_row("c1", "buy-1", 0.5, 25),
        _closure_row("c2", "buy-2", 0.5, 62.5),
    ]
    cur.fetchall.side_effect = [[lot_2x, lot_5x], []]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "qty": 1, "total": 150}, "qtyToClose": 1},
    )

    assert res.status_code == 201
    insert_calls = [c for c in cur.execute.call_args_list if "INSERT INTO op_closures" in c.args[0]]
    # (150 - 100) * 0.5 * 2x = 50; (150 - 100) * 0.5 * 5x = 125.
    assert insert_calls[0].args[1][3] == 50
    assert insert_calls[1].args[1][3] == 125


def test_close_op_partial_close(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW, _CLOSING_ROW, _closure_row("c1", "buy-1", 0.4, 20)]
    cur.fetchall.side_effect = [[_SOURCE_ROW], []]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "qty": 0.4, "total": 60}, "qtyToClose": 0.4},
    )

    assert res.status_code == 201
    closures = res.json()["closures"]
    assert closures[0]["qtyClosed"] == 0.4
    assert closures[0]["realizedPnl"] == 20


def test_close_op_spans_multiple_source_ops_oldest_first(close_client):
    client, conn, cur = close_client
    older = {**_SOURCE_ROW, "id": "buy-1", "qty": "0.5"}
    newer = {**_SOURCE_ROW, "id": "buy-2", "qty": "0.5"}
    cur.fetchone.side_effect = [
        older,  # source lookup for {id}=buy-1
        _CLOSING_ROW,
        _closure_row("c1", "buy-1", 0.5, 25),
        _closure_row("c2", "buy-2", 0.5, 25),
    ]
    # candidates ordered oldest-first by the query itself; no prior closures on either
    cur.fetchall.side_effect = [[older, newer], []]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "qty": 1, "total": 150}, "qtyToClose": 1},
    )

    assert res.status_code == 201
    closures = res.json()["closures"]
    assert [c["sourceOpId"] for c in closures] == ["buy-1", "buy-2"]
    assert sum(c["qtyClosed"] for c in closures) == 1


def test_close_op_over_close_rejected(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]
    cur.fetchall.side_effect = [[_SOURCE_ROW], []]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "qty": 5, "total": 750}, "qtyToClose": 5},
    )

    assert res.status_code == 400
    assert "outstanding" in res.json()["detail"].lower()
    conn.rollback.assert_called_once()


def test_close_op_sell_closed_by_buy(close_client):
    client, conn, cur = close_client
    sell_source = {**_SOURCE_ROW, "type": "Sell", "price": "150", "side": "short"}
    buy_closing = {**_CLOSING_ROW, "type": "Buy", "price": "100", "side": "long"}
    cur.fetchone.side_effect = [sell_source, buy_closing, _closure_row("c1", "buy-1", 1, 50)]
    cur.fetchall.side_effect = [[sell_source], []]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "type": "Buy", "price": 100}, "qtyToClose": 1},
    )

    assert res.status_code == 201
    assert res.json()["closures"][0]["realizedPnl"] == 50  # 1 * (150 sell - 100 buy)


def test_close_op_skips_fully_closed_candidate_and_stops_once_satisfied(close_client):
    client, conn, cur = close_client
    fully_closed = {**_SOURCE_ROW, "id": "buy-0", "qty": "1"}
    target = {**_SOURCE_ROW, "id": "buy-1", "qty": "1"}
    extra = {**_SOURCE_ROW, "id": "buy-2", "qty": "1"}
    cur.fetchone.side_effect = [target, _CLOSING_ROW, _closure_row("c1", "buy-1", 1, 50)]
    # buy-0 is already fully closed (closed_qty == qty) and must be skipped without
    # being allocated against; buy-2 must never be reached once buy-1 satisfies the request.
    cur.fetchall.side_effect = [
        [fully_closed, target, extra],
        [{"source_op_id": "buy-0", "closed_qty": "1"}],
    ]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1},
    )

    assert res.status_code == 201
    closures = res.json()["closures"]
    assert [c["sourceOpId"] for c in closures] == ["buy-1"]


def test_close_op_mismatched_platform_rejected(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "platformId": "metamask", "platformName": "MetaMask"}, "qtyToClose": 1},
    )

    assert res.status_code == 400
    assert "platform" in res.json()["detail"].lower()


def test_close_op_mismatched_currency_rejected(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "currency": "USD"}, "qtyToClose": 1},
    )

    assert res.status_code == 400
    assert "currency" in res.json()["detail"].lower()


def test_close_op_same_type_rejected(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "type": "Buy"}, "qtyToClose": 1},
    )

    assert res.status_code == 400
    assert "long position can only be closed with a sell" in res.json()["detail"].lower()


def test_close_op_short_closed_with_sell_rejected(close_client):
    # side='short' can only be closed with a Buy — a Sell (the source's own type) is
    # rejected for the same locked-side reason, not treated as "same type" generically.
    client, conn, cur = close_client
    short_source = {**_SOURCE_ROW, "type": "Sell", "side": "short"}
    cur.fetchone.side_effect = [short_source]

    res = client.post(
        "/api/ops/buy-1/close",
        json={"closingOp": {**_CLOSING_OP_BODY, "type": "Sell"}, "qtyToClose": 1},
    )

    assert res.status_code == 400
    assert "short position can only be closed with a buy" in res.json()["detail"].lower()


def test_close_op_wallet_kind_rejected(close_client):
    client, conn, cur = close_client
    wallet_source = {**_SOURCE_ROW, "op_kind": "wallet", "side": None, "leverage": None}
    cur.fetchone.side_effect = [wallet_source]

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 400
    assert "wallet operation cannot be closed" in res.json()["detail"].lower()


def test_close_op_cross_asset_swap_rejected(close_client):
    # Trade positions can only be closed with a plain same-asset Buy/Sell — the
    # swap-based close path item 26 built no longer applies to trades (spec: contracts
    # delta "Removed capability").
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CROSS_ASSET_SOL_BODY, "qtyToClose": 1})

    assert res.status_code == 400
    assert "swap" in res.json()["detail"].lower()


def test_close_op_not_found(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [None]

    res = client.post("/api/ops/nonexistent/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 404


def test_close_op_already_fully_closed(close_client):
    client, conn, cur = close_client
    cur.fetchone.side_effect = [_SOURCE_ROW]
    cur.fetchall.side_effect = [[_SOURCE_ROW], [{"source_op_id": "buy-1", "closed_qty": "1"}]]

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 404


def test_close_op_no_auth():
    res = TestClient(app).post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})
    assert res.status_code == 401


def test_close_op_db_error(close_client):
    client, conn, cur = close_client
    cur.execute.side_effect = Exception("db error")

    res = client.post("/api/ops/buy-1/close", json={"closingOp": _CLOSING_OP_BODY, "qtyToClose": 1})

    assert res.status_code == 500
    conn.rollback.assert_called_once()


def test_get_op_closures(close_client):
    client, conn, cur = close_client
    cur.fetchall.return_value = [_closure_row("c1", "buy-1", 1, 50)]

    res = client.get("/api/op-closures")

    assert res.status_code == 200
    assert res.json() == [{"id": "c1", "sourceOpId": "buy-1", "closingOpId": "sell-1", "qtyClosed": 1, "realizedPnl": 50}]


def test_get_op_closures_no_auth():
    res = TestClient(app).get("/api/op-closures")
    assert res.status_code == 401


def test_get_op_closures_db_error(close_client):
    client, conn, cur = close_client
    cur.execute.side_effect = Exception("db error")

    res = client.get("/api/op-closures")

    assert res.status_code == 500

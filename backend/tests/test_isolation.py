import logging
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import require_auth, AuthContext
from tests.conftest import make_pg_stub, _DB_PATCH_TARGETS

USER_A = "user-aaa-000"
USER_B = "user-bbb-111"


@pytest.fixture
def no_auth_client():
    yield TestClient(app)


@pytest.fixture
def user_b_client():
    pg_conn, cur = make_pg_stub([])

    def _auth():
        return AuthContext(user_id=USER_B)

    app.dependency_overrides[require_auth] = _auth
    patches = [patch(t, return_value=pg_conn) for t in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()

    yield TestClient(app), cur

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


def test_ops_requires_auth(no_auth_client):
    res = no_auth_client.get("/api/ops")
    assert res.status_code == 401


def test_exit_prices_requires_auth(no_auth_client):
    res = no_auth_client.get("/api/exit-prices")
    assert res.status_code == 401


def test_export_requires_auth(no_auth_client):
    res = no_auth_client.get("/api/export")
    assert res.status_code == 401


def test_ops_scoped_to_user_b(user_b_client):
    client, cur = user_b_client
    res = client.get("/api/ops")
    assert res.status_code == 200
    assert res.json() == []
    assert USER_B in str(cur.execute.call_args)


def test_exit_prices_scoped_to_user_b(user_b_client):
    client, cur = user_b_client
    res = client.get("/api/exit-prices")
    assert res.status_code == 200
    assert res.json() == {}
    assert USER_B in str(cur.execute.call_args)


def test_export_scoped_to_user_b(user_b_client):
    client, cur = user_b_client
    res = client.get("/api/export")
    assert res.status_code == 200
    body = res.json()
    assert body["ops"] == []
    assert body["exitPrices"] == {}
    assert USER_B in str(cur.execute.call_args)


def test_token_value_not_in_auth_failure_log(caplog):
    fake_token = "secret.header.payload"
    app.dependency_overrides.clear()
    with patch("app.dependencies.decode_token", side_effect=Exception("bad token")):
        with caplog.at_level(logging.WARNING, logger="app.dependencies"):
            res = TestClient(app).get(
                "/api/ops", headers={"Authorization": f"Bearer {fake_token}"}
            )
    assert res.status_code == 401
    for record in caplog.records:
        assert fake_token not in record.message

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_pg_stub

_client = TestClient(app)


def test_health():
    res = _client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_health_db_touches_database_without_auth():
    pg_conn, cur = make_pg_stub([])
    with patch("app.main.get_conn", return_value=pg_conn):
        res = _client.get("/health/db")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    cur.execute.assert_called_once_with("SELECT 1")


def test_health_db_surfaces_connection_failure():
    crashing_client = TestClient(app, raise_server_exceptions=False)
    with patch("app.main.get_conn", side_effect=Exception("connection timeout expired")):
        res = crashing_client.get("/health/db")
    assert res.status_code == 500

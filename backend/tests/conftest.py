"""
Set fake env vars BEFORE any app module is imported so pydantic-settings loads
without a real .env file in CI. This file is auto-loaded by pytest first.
"""
import os

os.environ.setdefault("DB_DSN", "host=test port=5432 dbname=test user=test password=test")
os.environ.setdefault("COGNITO_USER_POOL_ID", "us-east-1_testpool")
os.environ.setdefault("COGNITO_REGION", "us-east-1")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5173")

import pytest  # noqa: E402
from unittest.mock import MagicMock, patch  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.dependencies import require_auth, AuthContext  # noqa: E402

MOCK_USER_ID = "user-abc-123"

_DB_PATCH_TARGETS = [
    "app.routes.ops.get_conn",
    "app.routes.exit_prices.get_conn",
    "app.routes.export_data.get_conn",
    "app.routes.import_data.get_conn",
    "app.routes.prices.get_conn",
    "app.routes.exchange_rates.get_conn",
    "app.routes.price_history.get_conn",
    "app.routes.platforms.get_conn",
    "app.routes.coins.get_conn",
]


def make_pg_stub(data):
    """
    Returns a mock psycopg connection whose cursor supports fetchall/fetchone.
    data: list  → fetchall returns it, fetchone returns first item
    data: dict  → fetchone returns it, fetchall returns [it]

    Only the first fetchall() call returns `data`; every subsequent call on the
    same cursor returns []. Routes that issue a second SELECT against the same
    connection (e.g. prices.py/price_history.py's ops-symbol lookup, Item 13)
    get an empty result for it by default rather than colliding with the first
    query's rows — tests that care about that second query's shape should build
    their own stub with `cur.fetchall.side_effect` instead.
    """
    cur = MagicMock()
    # `with conn.cursor() as c:` must yield `cur` itself, not a sub-mock
    cur.__enter__.return_value = cur

    if isinstance(data, list):
        first_result = data
        cur.fetchone.return_value = data[0] if data else None
    else:
        first_result = [data] if data else []
        cur.fetchone.return_value = data or None

    cur.fetchall.side_effect = lambda *a, **k: first_result if cur.fetchall.call_count == 1 else []

    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


@pytest.fixture
def client_with_db(request):
    """
    TestClient with auth bypassed and DB mocked.
    Tag the test with @pytest.mark.pgdata(data) to control what the stub returns.
    """
    marker = request.node.get_closest_marker("pgdata")
    data = marker.args[0] if marker else []
    pg_conn, _ = make_pg_stub(data)

    def _mock_auth():
        return AuthContext(user_id=MOCK_USER_ID)

    app.dependency_overrides[require_auth] = _mock_auth

    patches = [patch(target, return_value=pg_conn) for target in _DB_PATCH_TARGETS]
    for p in patches:
        p.start()

    yield TestClient(app), pg_conn

    for p in patches:
        p.stop()
    app.dependency_overrides.clear()


@pytest.fixture
def client(client_with_db):
    return client_with_db[0]

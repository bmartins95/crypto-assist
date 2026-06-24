"""
Set fake env vars BEFORE any app module is imported so pydantic-settings loads
without a real .env file in CI. This file is auto-loaded by pytest first.
"""
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-service-key")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:3000")

import pytest  # noqa: E402
from unittest.mock import MagicMock  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.dependencies import require_auth, AuthContext  # noqa: E402

MOCK_USER_ID = "user-abc-123"
MOCK_TOKEN = "test-bearer-token"


def make_supabase_stub(data):
    """Chainable Supabase postgrest stub that always resolves to `data`."""
    result = MagicMock()
    result.data = data

    chain = MagicMock()
    for method in ("select", "insert", "update", "delete", "upsert",
                   "order", "eq", "in_", "single"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value = result

    stub = MagicMock()
    stub.from_.return_value = chain
    return stub


@pytest.fixture
def client_with_sb(request):
    """
    TestClient with auth and Supabase mocked.
    Tag the test with @pytest.mark.supabase(data) to control what the stub returns.
    """
    marker = request.node.get_closest_marker("supabase")
    data = marker.args[0] if marker else []
    sb_stub = make_supabase_stub(data)

    def _mock_auth():
        return AuthContext(user_id=MOCK_USER_ID, access_token=MOCK_TOKEN, supabase=sb_stub)

    app.dependency_overrides[require_auth] = _mock_auth
    yield TestClient(app), sb_stub
    app.dependency_overrides.clear()


@pytest.fixture
def client(client_with_sb):
    return client_with_sb[0]

from fastapi.testclient import TestClient
from app.main import app

_client = TestClient(app)


def test_health():
    res = _client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}

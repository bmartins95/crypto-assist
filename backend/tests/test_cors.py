import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def plain_client():
    return TestClient(app, raise_server_exceptions=True)


def test_cors_unknown_origin_no_acao_header(plain_client):
    resp = plain_client.options(
        "/health",
        headers={
            "Origin": "http://evil.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in resp.headers


def test_cors_configured_origin_acao_header(plain_client):
    resp = plain_client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"

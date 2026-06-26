import pytest
from pydantic import ValidationError

from app.config import Settings


def test_valid_http_origin():
    s = Settings(frontend_origin="http://localhost:5173")
    assert s.frontend_origin == "http://localhost:5173"


def test_valid_https_origin():
    s = Settings(frontend_origin="https://d1abc.cloudfront.net")
    assert s.frontend_origin == "https://d1abc.cloudfront.net"


def test_whitespace_stripped():
    s = Settings(frontend_origin="  https://example.com  ")
    assert s.frontend_origin == "https://example.com"


def test_empty_string_raises():
    with pytest.raises(ValidationError, match="must not be empty"):
        Settings(frontend_origin="")


def test_missing_scheme_raises():
    with pytest.raises(ValidationError, match="must include a scheme"):
        Settings(frontend_origin="example.com")


def test_trailing_slash_raises():
    with pytest.raises(ValidationError, match="must not have a trailing slash"):
        Settings(frontend_origin="https://example.com/")

import logging
from dataclasses import dataclass
from fastapi import Header, HTTPException, Request, status
from app.cognito import decode_token

logger = logging.getLogger(__name__)


@dataclass
class AuthContext:
    user_id: str


def require_auth(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning(
            "auth_failure path=%s ua=%s reason=missing",
            request.url.path,
            request.headers.get("user-agent", "-"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )
    token = authorization.removeprefix("Bearer ")

    try:
        claims = decode_token(token)
    except Exception:
        logger.warning(
            "auth_failure path=%s ua=%s reason=invalid",
            request.url.path,
            request.headers.get("user-agent", "-"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    return AuthContext(user_id=claims["sub"])

from dataclasses import dataclass
from fastapi import Header, HTTPException, status
from app.cognito import decode_token


@dataclass
class AuthContext:
    user_id: str


def require_auth(authorization: str | None = Header(default=None)) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )
    token = authorization.removeprefix("Bearer ")

    try:
        claims = decode_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    return AuthContext(user_id=claims["sub"])

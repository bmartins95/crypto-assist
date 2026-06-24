from dataclasses import dataclass
from fastapi import Header, HTTPException, status
from supabase import Client
from app.db.supabase_client import get_admin_client, get_user_client


@dataclass
class AuthContext:
    user_id: str
    access_token: str
    supabase: Client


def require_auth(authorization: str | None = Header(default=None)) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )
    token = authorization.removeprefix("Bearer ")

    try:
        response = get_admin_client().auth.get_user(jwt=token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    if response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    return AuthContext(
        user_id=response.user.id,
        access_token=token,
        supabase=get_user_client(token),
    )

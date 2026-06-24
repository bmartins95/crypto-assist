from functools import lru_cache
import jwt
from jwt import PyJWKClient
from app.config import get_settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    s = get_settings()
    url = f"https://cognito-idp.{s.cognito_region}.amazonaws.com/{s.cognito_user_pool_id}/.well-known/jwks.json"
    return PyJWKClient(url, cache_jwk_set=True, lifespan=3600)


def decode_token(token: str) -> dict:
    s = get_settings()
    client = _jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        options={"verify_aud": False},
        issuer=f"https://cognito-idp.{s.cognito_region}.amazonaws.com/{s.cognito_user_pool_id}",
    )
    if claims.get("token_use") != "access":
        raise ValueError("Not an access token")
    return claims

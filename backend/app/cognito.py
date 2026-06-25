import logging
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    s = get_settings()
    url = (
        f"https://cognito-idp.{s.cognito_region}.amazonaws.com"
        f"/{s.cognito_user_pool_id}/.well-known/jwks.json"
    )
    logger.info("JWKS: initialising client (url=%s)", url)
    return PyJWKClient(url, cache_jwk_set=True, lifespan=3600)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        client = _jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            issuer=(
                f"https://cognito-idp.{s.cognito_region}.amazonaws.com"
                f"/{s.cognito_user_pool_id}"
            ),
        )
        if claims.get("token_use") != "access":
            raise ValueError("Not an access token (token_use=%s)" % claims.get("token_use"))
        logger.debug("Token validated for sub=%s", claims.get("sub"))
        return claims
    except Exception as exc:
        logger.error("Token validation failed: %s", exc)
        raise

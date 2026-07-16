from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    stage: str = "dev"
    db_secret_arn: str = ""   # set in Lambda via SST (reads from Secrets Manager)
    db_dsn: str = ""           # set directly in local dev / tests (bypasses Secrets Manager)
    cognito_user_pool_id: str
    cognito_region: str = "us-east-1"
    coingecko_api_key: str = ""
    price_provider: str = "coingecko"
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("frontend_origin", mode="before")
    @classmethod
    def validate_frontend_origin(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("FRONTEND_ORIGIN must not be empty")
        # Comma-separated to allow multiple regional domains in prod (e.g. the
        # .net and .com.br domains) — a single origin is just a one-entry list.
        origins = [o.strip() for o in v.split(",")]
        for o in origins:
            if not o:
                raise ValueError("FRONTEND_ORIGIN must not contain an empty entry")
            if not (o.startswith("http://") or o.startswith("https://")):
                raise ValueError("FRONTEND_ORIGIN must include a scheme (http:// or https://)")
            if o.endswith("/"):
                raise ValueError("FRONTEND_ORIGIN must not have a trailing slash")
        return ",".join(origins)

    @property
    def frontend_origins(self) -> list[str]:
        return self.frontend_origin.split(",")


@lru_cache
def get_settings() -> Settings:
    return Settings()

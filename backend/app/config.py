from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    stage: str = "dev"
    db_secret_arn: str = ""   # set in Lambda via SST (reads from Secrets Manager)
    db_dsn: str = ""           # set directly in local dev / tests (bypasses Secrets Manager)
    cognito_user_pool_id: str
    cognito_region: str = "us-east-1"
    coingecko_api_key: str = ""
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

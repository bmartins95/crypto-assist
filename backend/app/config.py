from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    stage: str = "dev"
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    coingecko_api_key: str = ""
    frontend_origin: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

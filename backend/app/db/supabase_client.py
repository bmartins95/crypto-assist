from functools import lru_cache
from supabase import create_client, Client
from app.config import get_settings


@lru_cache
def get_admin_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_secret_key)


def get_user_client(access_token: str) -> Client:
    s = get_settings()
    client = create_client(s.supabase_url, s.supabase_publishable_key)
    client.postgrest.auth(access_token)
    return client

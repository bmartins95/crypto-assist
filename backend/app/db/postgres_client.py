from functools import lru_cache
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from app.config import get_settings

_conn: psycopg.Connection | None = None


@lru_cache(maxsize=1)
def _resolve_dsn() -> str:
    s = get_settings()
    if s.db_dsn:
        return s.db_dsn
    # In Lambda: read credentials from Secrets Manager
    import boto3
    import json
    sm = boto3.client("secretsmanager", region_name=s.cognito_region)
    raw = sm.get_secret_value(SecretId=s.db_secret_arn)["SecretString"]
    secret = json.loads(raw)
    dbname = secret.get("dbname") or "postgres"
    return (
        f"host={secret['host']} port={secret['port']} "
        f"dbname={dbname} user={secret['username']} password={secret['password']}"
    )


def get_conn() -> psycopg.Connection:
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg.connect(_resolve_dsn(), row_factory=dict_row)
    return _conn


def ensure_schema() -> None:
    """Run schema.sql on first Lambda cold start per container (idempotent)."""
    schema_sql = (Path(__file__).parent.parent.parent / "db" / "schema.sql").read_text()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()

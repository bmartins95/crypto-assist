import logging
import time
from functools import lru_cache
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings

logger = logging.getLogger(__name__)

_conn: psycopg.Connection | None = None

# Aurora Serverless v2 at min=0 ACU can take 15-30s to wake from pause.
# connect_timeout=15 fails fast per attempt; retry loop absorbs the wake-up delay.
_MAX_ATTEMPTS = 4
_RETRY_DELAY_S = 8.0


@lru_cache(maxsize=1)
def _resolve_dsn() -> str:
    s = get_settings()
    if s.db_dsn:
        return s.db_dsn + " connect_timeout=15"
    # Fallback: read from Secrets Manager (only reachable with NAT gateway or SM endpoint)
    import boto3, json
    logger.info("DB_DSN not set — reading from Secrets Manager (SecretId=%s)", s.db_secret_arn)
    sm = boto3.client("secretsmanager", region_name=s.cognito_region)
    raw = sm.get_secret_value(SecretId=s.db_secret_arn)["SecretString"]
    secret = json.loads(raw)
    dbname = secret.get("dbname") or "postgres"
    return (
        f"host={secret['host']} port={secret['port']} "
        f"dbname={dbname} user={secret['username']} password={secret['password']} "
        f"connect_timeout=15"
    )


def get_conn() -> psycopg.Connection:
    global _conn
    if _conn is not None and not _conn.closed:
        return _conn

    dsn = _resolve_dsn()
    host_hint = dsn.split("host=")[1].split()[0] if "host=" in dsn else "?"
    last_err: Exception | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            logger.info("Aurora connect attempt %d/%d (host=%s)...", attempt, _MAX_ATTEMPTS, host_hint)
            _conn = psycopg.connect(dsn, row_factory=dict_row)
            logger.info("Aurora: connected on attempt %d.", attempt)
            return _conn
        except Exception as exc:
            last_err = exc
            logger.warning("Aurora: attempt %d failed: %s", attempt, exc)
            if attempt < _MAX_ATTEMPTS:
                logger.info("Aurora: waiting %.0fs before retry (may be waking from 0 ACU pause)...", _RETRY_DELAY_S)
                time.sleep(_RETRY_DELAY_S)

    logger.error("Aurora: all %d attempts failed. Last error: %s", _MAX_ATTEMPTS, last_err)
    raise last_err  # type: ignore[misc]


def ensure_schema() -> None:
    schema_path = Path(__file__).parent.parent.parent / "db" / "schema.sql"
    logger.info("Schema: reading from %s", schema_path)
    schema_sql = schema_path.read_text()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()
    logger.info("Schema: ensured successfully.")

import logging
import time
from functools import lru_cache
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings

logger = logging.getLogger(__name__)

_conn: psycopg.Connection | None = None
_schema_ready = False

# Aurora Serverless v2 at min=0 ACU pauses when idle and refuses connections
# until it wakes (~15-20s). connect_timeout caps each attempt; the retry loop
# absorbs the wake-up delay. Tuned to fit inside the 30s Lambda timeout.
_CONNECT_TIMEOUT_S = 5
_MAX_ATTEMPTS = 10
_RETRY_DELAY_S = 2.0


@lru_cache(maxsize=1)
def _resolve_dsn() -> str:
    s = get_settings()
    if s.db_dsn:
        return f"{s.db_dsn} connect_timeout={_CONNECT_TIMEOUT_S}"
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
        f"connect_timeout={_CONNECT_TIMEOUT_S}"
    )


def _connect() -> psycopg.Connection:
    dsn = _resolve_dsn()
    host_hint = dsn.split("host=")[1].split()[0] if "host=" in dsn else "?"
    last_err: Exception | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            logger.info("Aurora connect attempt %d/%d (host=%s)...", attempt, _MAX_ATTEMPTS, host_hint)
            conn = psycopg.connect(dsn, row_factory=dict_row)
            logger.info("Aurora: connected on attempt %d.", attempt)
            return conn
        except Exception as exc:
            last_err = exc
            logger.warning("Aurora: attempt %d failed: %s", attempt, exc)
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_DELAY_S)

    logger.error("Aurora: all %d attempts failed. Last error: %s", _MAX_ATTEMPTS, last_err)
    raise last_err  # type: ignore[misc]


def get_conn() -> psycopg.Connection:
    """Return a live connection, ensuring the schema once per container.

    Connection + schema work happens lazily on the first request, NOT at module
    import. Doing it at import would block Lambda's 10s cold-start init phase while
    Aurora wakes from its 0 ACU pause, causing an init timeout.
    """
    global _conn, _schema_ready
    if _conn is None or _conn.closed:
        _conn = _connect()
    if not _schema_ready:
        _ensure_schema(_conn)
        _schema_ready = True
    return _conn


def _ensure_schema(conn: psycopg.Connection) -> None:
    schema_path = Path(__file__).parent.parent.parent / "db" / "schema.sql"
    logger.info("Schema: applying %s", schema_path)
    schema_sql = schema_path.read_text()
    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()
    logger.info("Schema: ensured successfully.")

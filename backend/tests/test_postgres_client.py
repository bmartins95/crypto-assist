import threading
import time
from unittest.mock import MagicMock

import pytest

from app.db import postgres_client


def _make_conn() -> tuple[MagicMock, MagicMock]:
    cur = MagicMock()
    cur.__enter__ = MagicMock(return_value=cur)
    cur.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.closed = False
    conn.cursor.return_value = cur
    return conn, cur


@pytest.fixture(autouse=True)
def reset_module_state(monkeypatch):
    monkeypatch.setattr(postgres_client, "_conn", None)
    monkeypatch.setattr(postgres_client, "_schema_ready", False)
    monkeypatch.setattr(postgres_client, "_migrations_ready", False)


def test_get_conn_wraps_init_in_advisory_lock(monkeypatch):
    conn, cur = _make_conn()
    monkeypatch.setattr(postgres_client, "_connect", lambda: conn)
    ensure_schema = MagicMock()
    run_migrations = MagicMock()
    monkeypatch.setattr(postgres_client, "_ensure_schema", ensure_schema)
    monkeypatch.setattr(postgres_client, "_run_migrations", run_migrations)

    result = postgres_client.get_conn()

    assert result is conn
    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert any("pg_advisory_lock" in s for s in executed)
    assert any("pg_advisory_unlock" in s for s in executed)
    lock_idx = next(i for i, s in enumerate(executed) if "pg_advisory_lock" in s and "unlock" not in s)
    unlock_idx = next(i for i, s in enumerate(executed) if "pg_advisory_unlock" in s)
    assert lock_idx < unlock_idx
    ensure_schema.assert_called_once_with(conn)
    run_migrations.assert_called_once_with(conn)


def test_get_conn_only_initializes_once_per_connection(monkeypatch):
    conn, _ = _make_conn()
    monkeypatch.setattr(postgres_client, "_connect", lambda: conn)
    ensure_schema = MagicMock()
    run_migrations = MagicMock()
    monkeypatch.setattr(postgres_client, "_ensure_schema", ensure_schema)
    monkeypatch.setattr(postgres_client, "_run_migrations", run_migrations)

    postgres_client.get_conn()
    postgres_client.get_conn()

    ensure_schema.assert_called_once()
    run_migrations.assert_called_once()


def test_ensure_schema_executes_schema_sql_and_commits():
    conn, cur = _make_conn()

    postgres_client._ensure_schema(conn)

    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    schema_sql = (
        postgres_client.Path(__file__).parent.parent / "db" / "schema.sql"
    ).read_text()
    assert executed == [schema_sql]
    conn.commit.assert_called_once()


def test_get_conn_serializes_concurrent_callers_on_a_fresh_process(monkeypatch):
    # Reproduces the bug directly: FastAPI runs sync routes in a threadpool, so
    # concurrent requests against a fresh process (e.g. the frontend's own
    # concurrent getOps()/getExitPrices() calls on boot) used to race into
    # get_conn() at the same time and interleave cursor calls on the shared
    # connection. With the lock in place, exactly one thread does the real
    # connect/init work and every other thread just waits for it and reuses it.
    conn, _ = _make_conn()
    connect_calls = []

    def slow_connect():
        connect_calls.append(1)
        time.sleep(0.05)  # widens the race window a naive implementation would fall into
        return conn

    monkeypatch.setattr(postgres_client, "_connect", slow_connect)
    ensure_schema = MagicMock()
    run_migrations = MagicMock()
    monkeypatch.setattr(postgres_client, "_ensure_schema", ensure_schema)
    monkeypatch.setattr(postgres_client, "_run_migrations", run_migrations)

    results: list[object] = []
    errors: list[BaseException] = []

    def call():
        try:
            results.append(postgres_client.get_conn())
        except BaseException as exc:  # noqa: BLE001 — surface any thread failure to the test
            errors.append(exc)

    threads = [threading.Thread(target=call) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=5)

    assert not errors
    assert len(results) == 8
    assert all(r is conn for r in results)
    assert len(connect_calls) == 1
    ensure_schema.assert_called_once_with(conn)
    run_migrations.assert_called_once_with(conn)


def test_run_migrations_applies_python_migrations_alongside_sql_in_order(tmp_path):
    # .py migrations (e.g. the platform-fields backfill) need real Python logic a
    # plain .sql file can't express, but must apply/track in the same numbered
    # order as .sql ones.
    conn, cur = _make_conn()
    cur.fetchall.return_value = []  # nothing applied yet

    (tmp_path / "001_create_thing.sql").write_text("CREATE TABLE thing (id int);")
    (tmp_path / "002_python_migration.py").write_text(
        "def migrate(conn):\n"
        "    conn.migration_marker()\n"
    )

    postgres_client._run_migrations(conn, migrations_dir=tmp_path)

    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert "CREATE TABLE thing (id int);" in executed
    conn.migration_marker.assert_called_once_with()
    inserted = [
        c.args[1][0] for c in cur.execute.call_args_list
        if c.args and "INSERT INTO schema_migrations" in c.args[0]
    ]
    assert inserted == ["001_create_thing.sql", "002_python_migration.py"]


def test_run_migrations_skips_a_python_migration_already_applied(tmp_path):
    conn, cur = _make_conn()
    cur.fetchall.return_value = [{"filename": "001_python_migration.py"}]

    (tmp_path / "001_python_migration.py").write_text(
        "def migrate(conn):\n"
        "    conn.migration_marker()\n"
    )

    postgres_client._run_migrations(conn, migrations_dir=tmp_path)

    conn.migration_marker.assert_not_called()


def test_schema_sql_never_unconditionally_indexes_a_migration_owned_column():
    # Reproduces the 2026-07-23 dev incident: schema.sql's CREATE TABLE IF NOT
    # EXISTS is a no-op on a pre-existing ops table, so an unconditional
    # CREATE INDEX on trade_group_id (a column only added by
    # migrations/013_trade_group_id.sql) raised UndefinedColumn on any
    # environment where the table predates that migration — and since
    # _ensure_schema always runs before _run_migrations in get_conn(), the
    # migration that would add the column never got a chance to run either,
    # permanently 500ing every DB-touching endpoint. Migration 013 already
    # creates this same index itself.
    schema_sql = (
        postgres_client.Path(__file__).parent.parent / "db" / "schema.sql"
    ).read_text()
    assert "ops_trade_group_id_idx" not in schema_sql


def test_get_conn_releases_lock_and_reraises_on_schema_failure(monkeypatch):
    conn, cur = _make_conn()
    monkeypatch.setattr(postgres_client, "_connect", lambda: conn)
    monkeypatch.setattr(postgres_client, "_ensure_schema", MagicMock(side_effect=Exception("boom")))
    monkeypatch.setattr(postgres_client, "_run_migrations", MagicMock())

    with pytest.raises(Exception, match="boom"):
        postgres_client.get_conn()

    conn.rollback.assert_called_once()
    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert any("pg_advisory_unlock" in s for s in executed)
    assert postgres_client._schema_ready is False

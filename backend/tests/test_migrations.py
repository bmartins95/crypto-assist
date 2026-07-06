import pytest
from pathlib import Path
from unittest.mock import MagicMock

from app.db.postgres_client import _run_migrations


def _make_conn(applied: list[str]) -> tuple[MagicMock, MagicMock]:
    cur = MagicMock()
    cur.__enter__ = MagicMock(return_value=cur)
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchall.return_value = [{"filename": f} for f in applied]
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def test_noop_when_migrations_dir_missing_logs_warning(tmp_path, caplog):
    import logging

    conn, _ = _make_conn([])
    with caplog.at_level(logging.WARNING):
        _run_migrations(conn, tmp_path / "nonexistent")
    conn.cursor.assert_not_called()
    assert any("skipping all migrations" in r.message for r in caplog.records)


def test_applies_pending_migration(tmp_path):
    (tmp_path / "001_init.sql").write_text("SELECT 1;")
    conn, cur = _make_conn([])

    _run_migrations(conn, tmp_path)

    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert any("SELECT 1;" in s for s in executed)
    assert any("INSERT INTO schema_migrations" in s for s in executed)


def test_skips_already_applied_migration(tmp_path):
    (tmp_path / "001_init.sql").write_text("SELECT 1;")
    conn, cur = _make_conn(["001_init.sql"])

    _run_migrations(conn, tmp_path)

    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert not any("SELECT 1;" in s for s in executed)
    assert not any("INSERT INTO schema_migrations" in s for s in executed)


def test_applies_migrations_in_sorted_order(tmp_path):
    (tmp_path / "002_second.sql").write_text("SELECT 2;")
    (tmp_path / "001_first.sql").write_text("SELECT 1;")
    order: list[str] = []

    conn = MagicMock()
    cur = MagicMock()
    cur.__enter__ = MagicMock(return_value=cur)
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchall.return_value = []

    def capture(sql, *args):
        if isinstance(sql, str) and sql.strip() in ("SELECT 1;", "SELECT 2;"):
            order.append(sql.strip())

    cur.execute.side_effect = capture
    conn.cursor.return_value = cur

    _run_migrations(conn, tmp_path)

    assert order == ["SELECT 1;", "SELECT 2;"]


def test_rollback_and_reraise_on_failure(tmp_path):
    (tmp_path / "001_bad.sql").write_text("INVALID SQL;")
    conn = MagicMock()
    cur = MagicMock()
    cur.__enter__ = MagicMock(return_value=cur)
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchall.return_value = []

    def fail(sql, *args):
        if isinstance(sql, str) and "INVALID" in sql:
            raise Exception("syntax error")

    cur.execute.side_effect = fail
    conn.cursor.return_value = cur

    with pytest.raises(Exception, match="syntax error"):
        _run_migrations(conn, tmp_path)

    conn.rollback.assert_called_once()


def test_partial_apply_skips_done_runs_pending(tmp_path):
    (tmp_path / "001_done.sql").write_text("SELECT 1;")
    (tmp_path / "002_pending.sql").write_text("SELECT 2;")
    conn, cur = _make_conn(["001_done.sql"])

    _run_migrations(conn, tmp_path)

    executed = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert not any("SELECT 1;" in s for s in executed)
    assert any("SELECT 2;" in s for s in executed)

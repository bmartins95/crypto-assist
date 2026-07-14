from unittest.mock import MagicMock, patch

import scripts.backfill_platform_fields as backfill


def _make_conn(ops_rows, fetchone_answers):
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.fetchall.return_value = ops_rows
    cur.fetchone.side_effect = fetchone_answers
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


_OPS_ROWS = [
    {"id": "op-1", "user_id": "u1", "platform": "Binance"},
    {"id": "op-2", "user_id": "u1", "platform": "Sodex"},
    {"id": "op-3", "user_id": "u1", "platform": ""},
]
_FETCHONE_ANSWERS = [{"id": "binance", "name": "Binance"}, None]  # op-1, op-2 (op-3 is blank, no query)


def test_dry_run_reports_counts_without_writing(capsys):
    conn, cur = _make_conn(_OPS_ROWS, list(_FETCHONE_ANSWERS))
    with patch("scripts.backfill_platform_fields.get_conn", return_value=conn):
        backfill.run(dry_run=True)
    out = capsys.readouterr().out
    assert "Rows to backfill: 3" in out
    assert "Catalog matches: 1" in out
    assert "Custom platforms: 1" in out
    assert "Blank (no platform): 1" in out
    assert "Dry run" in out
    cur.executemany.assert_not_called()
    conn.commit.assert_not_called()


def test_real_run_backfills_every_row():
    conn, cur = _make_conn(_OPS_ROWS, list(_FETCHONE_ANSWERS))
    with patch("scripts.backfill_platform_fields.get_conn", return_value=conn):
        backfill.run(dry_run=False)
    cur.executemany.assert_called_once()
    query, params = cur.executemany.call_args[0]
    assert "UPDATE ops SET platform_id" in query
    assert params == [
        ("binance", "Binance", "op-1"),
        ("custom:sodex", "Sodex", "op-2"),
        (None, None, "op-3"),
    ]
    conn.commit.assert_called_once()


def test_rerun_after_backfill_is_a_noop(capsys):
    # Second run's SELECT (WHERE platform_id IS NULL) would find nothing once
    # every row has been backfilled — simulated here by an empty result set.
    conn, cur = _make_conn([], [])
    with patch("scripts.backfill_platform_fields.get_conn", return_value=conn):
        backfill.run(dry_run=False)
    out = capsys.readouterr().out
    assert "Rows to backfill: 0" in out
    cur.executemany.assert_not_called()
    conn.commit.assert_not_called()


def test_blank_platform_value_stays_null():
    conn, cur = _make_conn([_OPS_ROWS[2]], [])
    with patch("scripts.backfill_platform_fields.get_conn", return_value=conn):
        backfill.run(dry_run=False)
    _, params = cur.executemany.call_args[0]
    assert params == [(None, None, "op-3")]

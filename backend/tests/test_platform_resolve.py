from unittest.mock import MagicMock

from tests.conftest import make_pg_stub
from app.platform_resolve import backfill_ops_platforms, resolve_platform


def _make_backfill_conn(ops_rows, fetchone_answers):
    # backfill_ops_platforms issues one fetchall() (the pending-ops SELECT) and
    # then, per row, resolve_platform's own fetchone() (a platform_cache lookup)
    # — two different query shapes sharing one cursor, which make_pg_stub (built
    # for a single uniform query) can't represent.
    cur = MagicMock()
    cur.__enter__.return_value = cur
    cur.fetchall.return_value = ops_rows
    cur.fetchone.side_effect = fetchone_answers
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def test_blank_input_resolves_to_none():
    conn, _ = make_pg_stub(None)
    assert resolve_platform("", "user-1", conn) == (None, None)
    assert resolve_platform("   ", "user-1", conn) == (None, None)
    assert resolve_platform(None, "user-1", conn) == (None, None)


def test_exact_case_insensitive_trimmed_match_resolves_to_cached_exchange():
    conn, _ = make_pg_stub({"id": "binance", "name": "Binance"})
    assert resolve_platform("  binance  ", "user-1", conn) == ("binance", "Binance")
    assert resolve_platform("BINANCE", "user-1", conn) == ("binance", "Binance")


def test_no_exchange_match_falls_back_to_wallet_defi_seed():
    conn, _ = make_pg_stub(None)
    assert resolve_platform("MetaMask", "user-1", conn) == ("metamask", "MetaMask")
    assert resolve_platform("  metamask  ", "user-1", conn) == ("metamask", "MetaMask")


def test_no_catalog_match_resolves_to_custom():
    conn, _ = make_pg_stub(None)
    assert resolve_platform("Sodex", "user-1", conn) == ("custom:sodex", "Sodex")


def test_custom_slug_is_url_safe():
    conn, _ = make_pg_stub(None)
    platform_id, name = resolve_platform("My Cool Exchange!!", "user-1", conn)
    assert platform_id == "custom:my-cool-exchange"
    assert name == "My Cool Exchange!!"


def test_two_different_users_typing_the_same_custom_name_each_get_an_isolated_result():
    # resolve_platform itself doesn't scope by user_id (research.md §4) — isolation
    # comes from ops's existing per-user WHERE clause elsewhere. Both users get the
    # same computed id/name pair here; what matters is neither ever sees the other's
    # actual op rows, which is exercised by test_isolation.py, not this function.
    conn, _ = make_pg_stub(None)
    result_a = resolve_platform("Sodex", "user-a", conn)
    result_b = resolve_platform("Sodex", "user-b", conn)
    assert result_a == result_b == ("custom:sodex", "Sodex")


def test_backfill_dry_run_reports_counts_without_writing():
    conn, cur = _make_backfill_conn(
        [{"id": "op-1", "user_id": "u1", "platform": "Binance"}],
        [{"id": "binance", "name": "Binance"}],
    )
    counts = backfill_ops_platforms(conn, dry_run=True)
    assert counts == {"total": 1, "catalog": 1, "custom": 0, "blank": 0}
    cur.executemany.assert_not_called()
    conn.commit.assert_not_called()


def test_backfill_writes_resolved_platform_fields_for_every_pending_row():
    conn, cur = _make_backfill_conn(
        [
            {"id": "op-1", "user_id": "u1", "platform": "Binance"},
            {"id": "op-2", "user_id": "u1", "platform": "Sodex"},
        ],
        [{"id": "binance", "name": "Binance"}, None],
    )
    counts = backfill_ops_platforms(conn)
    assert counts == {"total": 2, "catalog": 1, "custom": 1, "blank": 0}
    cur.executemany.assert_called_once()
    query, params = cur.executemany.call_args[0]
    assert "UPDATE ops SET platform_id" in query
    assert params == [("binance", "Binance", "op-1"), ("custom:sodex", "Sodex", "op-2")]
    conn.commit.assert_called_once()


def test_backfill_with_no_pending_rows_is_a_noop():
    conn, cur = _make_backfill_conn([], [])
    counts = backfill_ops_platforms(conn)
    assert counts == {"total": 0, "catalog": 0, "custom": 0, "blank": 0}
    cur.executemany.assert_not_called()
    conn.commit.assert_not_called()

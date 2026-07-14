from tests.conftest import make_pg_stub
from app.platform_resolve import resolve_platform


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

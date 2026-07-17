"""Backfills platform_id/platform_name for every op recorded before the
platform catalog existed (Item 22 / docs/PLAN.md).

Runs automatically, once, as part of the normal migration flow — a manual
approval step here would mean every pre-catalog op silently loses its platform
in the UI on deploy (the new UI reads only platform_id/platform_name, not the
legacy platform column), which is worse than the already-accepted approximation
of resolving an unrecognized name to a private custom platform instead of a
live-catalog match. Idempotent: only touches rows with platform_id IS NULL.
"""
import psycopg

from app.platform_resolve import backfill_ops_platforms


def migrate(conn: psycopg.Connection) -> None:
    backfill_ops_platforms(conn)

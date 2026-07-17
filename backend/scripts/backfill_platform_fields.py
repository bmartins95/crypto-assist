"""Manual diagnostic for the historical-ops platform backfill (Item 22 / docs/PLAN.md).

The backfill itself now runs automatically, once, as part of the normal
migration flow (db/migrations/011_backfill_platform_fields.py) — this script
is only useful for inspecting counts against a specific environment's DB_DSN
before or after that migration has run; it is not required to make the
backfill happen.

Usage:
    cd backend && python scripts/backfill_platform_fields.py --dry-run
    cd backend && python scripts/backfill_platform_fields.py
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.postgres_client import get_conn  # noqa: E402
from app.platform_resolve import backfill_ops_platforms  # noqa: E402


def run(dry_run: bool) -> None:
    conn = get_conn()
    counts = backfill_ops_platforms(conn, dry_run=dry_run)

    print(f"Rows to backfill: {counts['total']}")
    print(f"  Catalog matches: {counts['catalog']}")
    print(f"  Custom platforms: {counts['custom']}")
    print(f"  Blank (no platform): {counts['blank']}")

    if dry_run:
        print("Dry run — no rows written.")
    elif counts["total"] == 0:
        print("Nothing to backfill.")
    else:
        print(f"Backfilled {counts['total']} row(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts without writing")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

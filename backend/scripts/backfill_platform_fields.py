"""One-time historical-ops platform backfill (Item 22 / PLAN.md).

Resolves every existing ops.platform free-text value into platform_id/
platform_name via the same resolve_platform() rule used by JSON import
(FR-010/FR-014). Run locally by a developer with DB_DSN pointed at the
target environment — never deployed as part of the Lambda bundle.

Requires explicit user approval before running for real against dev/prod
(CLAUDE.md database rules) — always dry-run first.

Usage:
    cd backend && python scripts/backfill_platform_fields.py --dry-run
    cd backend && python scripts/backfill_platform_fields.py
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.postgres_client import get_conn  # noqa: E402
from app.platform_resolve import resolve_platform  # noqa: E402


def run(dry_run: bool) -> None:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id, user_id, platform FROM ops WHERE platform_id IS NULL")
        rows = cur.fetchall()

    counts = {"catalog": 0, "custom": 0, "blank": 0}
    updates: list[tuple[str | None, str | None, str]] = []
    for row in rows:
        platform_id, platform_name = resolve_platform(row["platform"], row["user_id"], conn)
        if platform_id is None:
            counts["blank"] += 1
        elif platform_id.startswith("custom:"):
            counts["custom"] += 1
        else:
            counts["catalog"] += 1
        updates.append((platform_id, platform_name, row["id"]))

    print(f"Rows to backfill: {len(updates)}")
    print(f"  Catalog matches: {counts['catalog']}")
    print(f"  Custom platforms: {counts['custom']}")
    print(f"  Blank (no platform): {counts['blank']}")

    if dry_run:
        print("Dry run — no rows written.")
        return

    if not updates:
        print("Nothing to backfill.")
        return

    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE ops SET platform_id = %s, platform_name = %s WHERE id = %s",
            updates,
        )
    conn.commit()
    print(f"Backfilled {len(updates)} row(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts without writing")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

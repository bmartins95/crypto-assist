import json
import re
from pathlib import Path

import psycopg

# Two candidate locations for the curated wallet/DeFi seed (single source of
# truth shared with the frontend, shared/src/platforms/seed.json):
# - bundled: sst.config.ts's copyFiles puts it at the Lambda bundle root as
#   platforms/seed.json (shared/ itself is not otherwise bundled).
# - repo-relative: a local dev checkout has the full monorepo on disk.
_BUNDLED_SEED = Path(__file__).parent.parent / "platforms" / "seed.json"
_REPO_SEED = Path(__file__).parent.parent.parent / "shared" / "src" / "platforms" / "seed.json"
_SEED_PATH = _BUNDLED_SEED if _BUNDLED_SEED.exists() else _REPO_SEED

with open(_SEED_PATH, encoding="utf-8") as f:
    _WALLET_DEFI_SEED: list[dict] = json.load(f)

_WALLET_DEFI_BY_NAME = {entry["name"].strip().lower(): entry["id"] for entry in _WALLET_DEFI_SEED}


def _normalize(raw: str) -> str:
    return raw.strip().lower()


def _slugify(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    return slug or "platform"


def resolve_platform(raw: str | None, user_id: str, conn: psycopg.Connection) -> tuple[str | None, str | None]:
    """Resolve a legacy free-text platform value into (platform_id, platform_name).

    Matches (exact, trimmed, case-insensitive) against known exchanges in
    platform_cache, then the curated wallet/DeFi seed; falls back to a private
    custom platform. user_id is accepted for signature clarity (per research.md
    §4, privacy comes from ops's existing per-user query scoping, not from a
    per-user namespace in the id itself — the parameter is unused here on purpose).
    """
    del user_id
    if raw is None or not raw.strip():
        return None, None

    trimmed = raw.strip()
    normalized = _normalize(trimmed)

    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM platform_cache WHERE lower(name) = %s", (normalized,))
        row = cur.fetchone()
    if row:
        return row["id"], row["name"]

    wallet_defi_id = _WALLET_DEFI_BY_NAME.get(normalized)
    if wallet_defi_id:
        seed_entry = next(e for e in _WALLET_DEFI_SEED if e["id"] == wallet_defi_id)
        return seed_entry["id"], seed_entry["name"]

    return f"custom:{_slugify(trimmed)}", trimmed


def backfill_ops_platforms(conn: psycopg.Connection, dry_run: bool = False) -> dict[str, int]:
    """Resolves every op's legacy platform text into platform_id/platform_name.

    Idempotent — only selects rows where platform_id IS NULL, so it's safe to run
    on every deploy (db/migrations/011_backfill_platform_fields.py does exactly
    that) without re-touching rows already resolved or created post-catalog.
    """
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

    if not dry_run and updates:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE ops SET platform_id = %s, platform_name = %s WHERE id = %s",
                updates,
            )
        conn.commit()

    return {"total": len(updates), **counts}

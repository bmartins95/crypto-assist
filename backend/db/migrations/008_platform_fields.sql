-- Add platform_id/platform_name to ops for Item 22 (platform field catalog).
-- Additive only: new nullable columns, old `platform` column stays untouched.
-- Historical-row backfill is a separate, manually-run, approval-gated script
-- (backend/scripts/backfill_platform_fields.py) — not part of this migration.
BEGIN;

ALTER TABLE ops ADD COLUMN IF NOT EXISTS platform_id text;
ALTER TABLE ops ADD COLUMN IF NOT EXISTS platform_name text;

CREATE TABLE IF NOT EXISTS platform_cache (
    id          text        PRIMARY KEY,
    name        text        NOT NULL,
    logo_url    text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;

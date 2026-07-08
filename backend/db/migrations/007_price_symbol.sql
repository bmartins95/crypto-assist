-- Add ticker symbol alongside coin_id for Item 13 (price provider abstraction).
-- Additive only: new nullable column + one-time backfill from ops.
BEGIN;

ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS symbol text;
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS symbol text;

UPDATE price_cache pc SET symbol = o.symbol
FROM (SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops ORDER BY coin_id, created_at) o
WHERE pc.coin_id = o.coin_id AND pc.symbol IS NULL;

UPDATE price_history ph SET symbol = o.symbol
FROM (SELECT DISTINCT ON (coin_id) coin_id, symbol FROM ops ORDER BY coin_id, created_at) o
WHERE ph.coin_id = o.coin_id AND ph.symbol IS NULL;

COMMIT;

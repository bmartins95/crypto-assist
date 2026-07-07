-- Move the crypto price reference from BRL to USD and add multi-currency support.
-- Safe to re-run: rename is guarded, table/column creation is IF NOT EXISTS.
BEGIN;

-- price_cache is disposable (5-min TTL): rename is safe; force-expire so no
-- BRL-era value is ever read as USD.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'price_cache' AND column_name = 'price_brl') THEN
        ALTER TABLE price_cache RENAME COLUMN price_brl TO price_usd;
    END IF;
END $$;

UPDATE price_cache SET updated_at = to_timestamp(0);

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_code varchar(8)     PRIMARY KEY,
    rate_vs_usd   numeric(18,8)  NOT NULL,
    updated_at    timestamptz    NOT NULL
);

ALTER TABLE ops ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'BRL';
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_currency_check;
ALTER TABLE ops ADD CONSTRAINT ops_currency_check
    CHECK (currency IN ('BRL', 'USD', 'EUR', 'GBP', 'JPY'));

COMMIT;

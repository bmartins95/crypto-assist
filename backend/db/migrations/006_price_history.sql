-- Add price_history for Item 12 (historical chart pricing).
-- Safe to re-run: table creation is IF NOT EXISTS.
BEGIN;

CREATE TABLE IF NOT EXISTS price_history (
    coin_id     text           NOT NULL,
    date        date           NOT NULL,
    price_usd   numeric(30,10) NOT NULL,
    PRIMARY KEY (coin_id, date)
);

COMMIT;

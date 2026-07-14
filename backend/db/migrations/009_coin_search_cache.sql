-- Cache coin-search results (Item: coin search caching + frontend debounce).
-- Query volume rose sharply once the frontend started searching on every
-- keystroke instead of after 2+ chars; this avoids hitting CoinGecko fresh
-- for every request, mirroring platform_cache's shape/behavior.
BEGIN;

CREATE TABLE IF NOT EXISTS coin_search_cache (
    query       text        PRIMARY KEY,
    results     jsonb       NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;

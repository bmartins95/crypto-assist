-- Item 29: leverage custom input. Widens the leverage CHECK constraint from a
-- fixed set (2,3,5,10) to any integer in [2,125], matching common exchange
-- futures leverage caps (e.g. Binance's 125x), so users can type a custom value.
BEGIN;

ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_leverage_check;
ALTER TABLE ops ADD CONSTRAINT ops_leverage_check CHECK (leverage IS NULL OR leverage BETWEEN 2 AND 125);

COMMIT;

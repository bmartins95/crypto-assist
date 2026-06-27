-- Migrate ops.type values from Portuguese to English.
-- Safe to re-run: UPDATE on already-English values is a no-op.
BEGIN;

UPDATE ops SET type = 'Buy'  WHERE type = 'Compra';
UPDATE ops SET type = 'Sell' WHERE type = 'Venda';

ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_type_check;
ALTER TABLE ops ADD CONSTRAINT ops_type_check CHECK (type IN ('Buy', 'Sell'));

COMMIT;

-- Item 26: position closing + leverage. Additive only.
-- ops.leverage is nullable (absent = 1x/unleveraged); op_closures is a new
-- many-to-many link table, since a close can span multiple source ops and a
-- source op can be closed piecemeal by multiple later ops.
BEGIN;

ALTER TABLE ops ADD COLUMN IF NOT EXISTS leverage smallint CHECK (leverage IN (2, 3, 5, 10));

CREATE TABLE IF NOT EXISTS op_closures (
    id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    source_op_id   uuid           NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
    closing_op_id  uuid           NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
    qty_closed     numeric(30,10) NOT NULL,
    realized_pnl   numeric(30,10) NOT NULL,
    created_at     timestamptz    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS op_closures_source_op_id_idx  ON op_closures(source_op_id);
CREATE INDEX IF NOT EXISTS op_closures_closing_op_id_idx ON op_closures(closing_op_id);

COMMIT;

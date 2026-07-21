-- Links the two legs of a trade (a normal swap, or a trade-close's closing + received
-- legs) so deleting either leg deletes the whole trade. Nullable: existing ops and all
-- single Buy/Sell ops carry no group.
ALTER TABLE ops ADD COLUMN IF NOT EXISTS trade_group_id uuid;
CREATE INDEX IF NOT EXISTS ops_trade_group_id_idx ON ops(trade_group_id);

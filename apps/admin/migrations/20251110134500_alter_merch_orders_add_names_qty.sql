-- Add first_name, last_name, qty to merch_orders
ALTER TABLE merch_orders
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS qty integer DEFAULT 1;

-- Ensure qty is at least 1 by default
UPDATE merch_orders SET qty = 1 WHERE qty IS NULL;

-- Optional index for filtering by qty (not strictly needed)
-- CREATE INDEX IF NOT EXISTS idx_merch_orders_qty ON merch_orders (qty);

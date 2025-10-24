-- Ensure we don't keep estimated_prices jsonb; use estimated_cost text only
ALTER TABLE images
  DROP COLUMN IF EXISTS estimated_prices;

-- orders: track selected configuration and price
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS selected_option text,
  ADD COLUMN IF NOT EXISTS selected_price_cents integer;

-- Helpful partial index for filtering by option
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_orders_selected_option' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_orders_selected_option ON orders (selected_option);
  END IF;
END $$;

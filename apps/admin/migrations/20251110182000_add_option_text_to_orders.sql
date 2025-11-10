-- Add a human-readable option text to orders (e.g., "18K Gold + Lab Diamonds - $2499 USD")
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS option_text TEXT;

-- Optional index for filtering by option text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'idx_orders_option_text' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_orders_option_text ON orders (option_text);
  END IF;
END$$;

-- Add order status to orders table with ENUM type and default

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'New',
      'Processing',
      'Design',
      'Production',
      'Canceled',
      'Completed',
      'Paused',
      'Invoice',
      'Negotiation'
    );
  END IF;
END$$;

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS status order_status NOT NULL DEFAULT 'New';

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

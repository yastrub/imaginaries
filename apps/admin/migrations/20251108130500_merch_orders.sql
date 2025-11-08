-- Merch orders table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS merch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  merch_type TEXT NOT NULL,
  color TEXT,
  size TEXT,
  price_amount NUMERIC(12,2),
  price_currency TEXT NOT NULL DEFAULT 'AED',
  source_image_url TEXT NOT NULL,
  order_image_url TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_created_at ON merch_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON merch_orders (status);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  max_generations_per_day INTEGER NOT NULL DEFAULT 0,
  show_watermark BOOLEAN NOT NULL DEFAULT true,
  allow_private_images BOOLEAN NOT NULL DEFAULT false,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_is_public ON plans(is_public);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON plans(sort_order);

-- Seed default plans matching apps/client/backend/config/plans.js
INSERT INTO plans (key, name, max_generations_per_day, show_watermark, allow_private_images, price_cents, currency, is_active, is_public, sort_order)
VALUES
  ('free', 'Free', 5, true, false, 0, 'USD', true, true, 0),
  ('pro', 'Pro', 100, true, true, 999, 'USD', true, true, 10),
  ('business', 'Business', 200, false, true, 2999, 'USD', true, true, 20)
ON CONFLICT (key) DO NOTHING;

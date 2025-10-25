-- Add Stripe product ID to plans for currency-agnostic plan mapping
ALTER TABLE IF EXISTS plans
  ADD COLUMN IF NOT EXISTS stripe_product_id text;

CREATE INDEX IF NOT EXISTS idx_plans_stripe_product_id ON plans(stripe_product_id);

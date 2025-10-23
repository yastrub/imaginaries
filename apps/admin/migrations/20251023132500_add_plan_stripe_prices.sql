-- Add Stripe price ID columns to plans
ALTER TABLE IF EXISTS plans
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual_id text;

-- Optional: seed from existing envs is not done at DB level; configure via Admin UI

-- Add monthly generation limit to plans and default Free to 3
ALTER TABLE IF EXISTS plans
  ADD COLUMN IF NOT EXISTS max_generations_per_month integer NOT NULL DEFAULT 0;

-- Set default for Free plan if not set
UPDATE plans
SET max_generations_per_month = 3
WHERE key = 'free' AND (max_generations_per_month IS NULL OR max_generations_per_month = 0);

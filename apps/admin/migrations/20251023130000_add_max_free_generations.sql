-- Add free monthly generation limit to plans
ALTER TABLE IF EXISTS plans
  ADD COLUMN IF NOT EXISTS max_free_generations integer NOT NULL DEFAULT 0;

-- Seed Free plan with 3 if not set
UPDATE plans
SET max_free_generations = 3
WHERE key = 'free' AND (max_free_generations IS NULL OR max_free_generations = 0);

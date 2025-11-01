-- Add allow_reimagine flag to plans table
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS allow_reimagine boolean NOT NULL DEFAULT false;

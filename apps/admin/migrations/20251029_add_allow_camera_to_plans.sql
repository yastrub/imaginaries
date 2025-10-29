BEGIN;

-- Add allow_camera column to plans if it doesn't exist
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS allow_camera boolean NOT NULL DEFAULT false;

-- Optional: backfill for common paid plans
UPDATE plans SET allow_camera = true WHERE key IN ('pro', 'business');

COMMIT;

-- Add allow_upload flag to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_upload BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows to explicit false (default already covers, but for clarity)
UPDATE plans SET allow_upload = COALESCE(allow_upload, false);

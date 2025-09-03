/*
  # Add Authentication Fields

  1. Changes
    - Add confirmation fields to users table:
      - confirmation_token (text)
      - confirmation_expires (timestamp)
      - reset_token (text)
      - reset_expires (timestamp)

  2. Updates
    - Set email_confirmed to false by default
    - Add indexes for token fields
*/

-- Add confirmation and reset fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_expires timestamptz,
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_expires timestamptz;

-- Set email_confirmed to false by default for new users
ALTER TABLE users ALTER COLUMN email_confirmed SET DEFAULT false;

-- Add indexes for token fields
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON users(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
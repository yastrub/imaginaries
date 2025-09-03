/*
  # Add pending_email column for email change flow

  This migration adds a `pending_email` column to the users table to support
  email change confirmation flows. The new email is stored in this column
  until the user confirms via a token, at which point it is promoted to `email`.
*/

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pending_email text;

-- Optional: ensure confirmation token columns exist (safety)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS confirmation_token text,
ADD COLUMN IF NOT EXISTS confirmation_expires timestamptz;

-- Index commonly queried token
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON users(confirmation_token);

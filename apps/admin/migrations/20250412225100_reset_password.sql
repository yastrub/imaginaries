/*
  # Password Reset Migration

  This migration adds password reset functionality to the users table.
  
  1. New Columns in users table:
    - `reset_token` (text, nullable): Token for password reset
    - `reset_expires` (timestamptz, nullable): Expiration time for reset token

  2. New Columns in users table for email confirmation:
    - `confirmation_token` (text, nullable): Token for email confirmation
    - `confirmation_expires` (timestamptz, nullable): Expiration time for confirmation token
*/

-- Add reset token fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token text,
ADD COLUMN IF NOT EXISTS reset_expires timestamptz;

-- Add confirmation token fields to users table if they don't exist
-- These might already exist in some environments but we include them for completeness
ALTER TABLE users
ADD COLUMN IF NOT EXISTS confirmation_token text,
ADD COLUMN IF NOT EXISTS confirmation_expires timestamptz;

-- Create indexes for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON users(confirmation_token);

/*
  # User Tracking Fields Migration

  This migration adds tracking fields to the users table to store information
  about user access patterns and IP addresses.
  
  1. New Columns in users table:
    - `initial_ip` (text, nullable): IP address at registration time
    - `last_ip` (text, nullable): Most recent IP address used
    - `last_user_agent` (text, nullable): Most recent browser/device information
    - `last_login_at` (timestamptz, nullable): Timestamp of last login
*/

-- Add tracking fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS initial_ip text,
ADD COLUMN IF NOT EXISTS last_ip text,
ADD COLUMN IF NOT EXISTS last_user_agent text,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_initial_ip ON users(initial_ip);
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);

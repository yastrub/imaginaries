/*
  # Promo Codes Migration

  This migration adds support for promo codes:
  1. Creates a new `promo_codes` table to store valid promo codes
  2. Adds a `promo_code` field to the `users` table to track which promo code a user used during signup
  
  1. New Table: promo_codes
    - `id` (text, primary key): The actual promo code string (stored lowercase)
    - `created_at` (timestamptz): When the code was created
    - `is_valid` (boolean): Whether the code is currently valid
    - `description` (text): Optional description of the promo code
    
  2. New Column in users table:
    - `promo_code` (text, nullable): The promo code used during signup
*/

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id text PRIMARY KEY,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  is_valid boolean DEFAULT true,
  description text,
  plan text DEFAULT 'free'
);

-- Add promo_code field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS promo_code text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_promo_code ON users(promo_code);

-- Insert some initial promo codes for testing
INSERT INTO promo_codes (id, is_valid, description, plan)
VALUES 
  ('welcome2025', true, 'Welcome promo code for 2025', 'free'),
  ('earlybird', true, 'Early adopter promo code', 'pro'),
  ('betauser', true, 'Beta testing promo code', 'business')
ON CONFLICT (id) DO NOTHING;

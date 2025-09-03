/*
  # Initial Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `password` (text)
      - `email_confirmed` (boolean)
      - `subscription_plan` (text)
      - `subscription_updated_at` (timestamp)
      - `created_at` (timestamp)

    - `images`
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `prompt` (text)
      - `image_url` (text)
      - `watermarked_url` (text)
      - `metadata` (jsonb)
      - `is_private` (boolean)
      - `created_at` (timestamp)

    - `likes`
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `image_id` (uuid)
      - `created_at` (timestamp)

  2. Indexes
    - Users: email, subscription_plan
    - Images: user_id, created_at, is_private
    - Likes: user_id, image_id, created_at

  3. Foreign Keys
    - images.user_id references users(id)
    - likes.user_id references users(id)
    - likes.image_id references images(id)

  4. Helper Functions
    - get_image_like_counts: Returns like counts for given image IDs
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  email_confirmed boolean DEFAULT true,
  subscription_plan text DEFAULT 'free',
  subscription_updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  image_url text NOT NULL,
  watermarked_url text,
  metadata jsonb DEFAULT '{}',
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, image_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan);

CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_images_is_private ON images(is_private);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_image_id ON likes(image_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);

-- Helper function for like counts
CREATE OR REPLACE FUNCTION get_image_like_counts(image_ids uuid[])
RETURNS TABLE (image_id uuid, like_count bigint) AS $$
BEGIN
  RETURN QUERY
    SELECT l.image_id, COUNT(*)::bigint as like_count
    FROM likes l
    WHERE l.image_id = ANY(image_ids)
    GROUP BY l.image_id;
END;
$$ LANGUAGE plpgsql;
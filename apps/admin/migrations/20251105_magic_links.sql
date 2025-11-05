-- Magic links table for passwordless authentication
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  ip TEXT NULL,
  user_agent TEXT NULL
);

CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links (email);
CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON magic_links (expires_at);
CREATE INDEX IF NOT EXISTS magic_links_used_idx ON magic_links (used_at);

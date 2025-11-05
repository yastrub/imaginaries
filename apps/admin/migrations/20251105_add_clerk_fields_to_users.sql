ALTER TABLE users
  ADD COLUMN IF NOT EXISTS clerk_user_id UUID,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT;

-- Unique index on clerk_user_id when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'users_clerk_user_id_unique'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX users_clerk_user_id_unique ON users (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
  END IF;
END$$;

-- Backfill auth_provider based on existing data
UPDATE users SET auth_provider = 'clerk' WHERE clerk_user_id IS NOT NULL AND (auth_provider IS NULL OR auth_provider = '');
UPDATE users SET auth_provider = 'password' WHERE clerk_user_id IS NULL AND (auth_provider IS NULL OR auth_provider = '') AND password IS NOT NULL;

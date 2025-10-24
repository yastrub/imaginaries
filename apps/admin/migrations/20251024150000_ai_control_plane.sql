-- AI Control Plane and Presets schema
-- Run against the same Postgres used by ADMIN_DATABASE_URL/DATABASE_URL

-- Ensure UUID generation available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reusable updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION trigger_set_timestamp() RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- =====================
-- Preset sets and presets
-- =====================
CREATE TABLE IF NOT EXISTS preset_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_timestamp_preset_sets
BEFORE UPDATE ON preset_sets
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Only one default set at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_preset_set ON preset_sets ((TRUE)) WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_set_id UUID NOT NULL REFERENCES preset_sets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(preset_set_id, key)
);

CREATE INDEX IF NOT EXISTS idx_presets_set_order ON presets(preset_set_id, sort_order);
CREATE TRIGGER set_timestamp_presets
BEFORE UPDATE ON presets
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Only one default per set
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_preset_per_set ON presets(preset_set_id) WHERE is_default = TRUE;

-- =====================
-- Prompts
-- =====================
CREATE TABLE IF NOT EXISTS ai_prompts (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('enhance','sketch','estimate','system','other')),
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, key, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(scope, key) WHERE is_active = TRUE;
CREATE TRIGGER set_timestamp_ai_prompts
BEFORE UPDATE ON ai_prompts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- =====================
-- Invocation logs
-- =====================
CREATE TABLE IF NOT EXISTS ai_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  provider_key TEXT,
  model_key TEXT,
  purpose TEXT,
  params JSONB,
  latency_ms INT,
  cost_cents INT,
  success BOOLEAN,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_created ON ai_invocations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_user ON ai_invocations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_purpose ON ai_invocations(purpose);

-- =====================
-- Terminals: bind preset set
-- =====================
ALTER TABLE terminals
  ADD COLUMN IF NOT EXISTS preset_set_id UUID NULL REFERENCES preset_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_terminals_preset_set ON terminals(preset_set_id);

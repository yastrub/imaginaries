-- Lean defaults for AI routing (DB primary, code/env fallback)
CREATE TABLE IF NOT EXISTS ai_defaults (
  purpose TEXT PRIMARY KEY CHECK (purpose IN ('image','sketch','estimate')),
  provider_key TEXT NOT NULL,
  model_key TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional seed (commented out): mirror current code defaults if desired
-- INSERT INTO ai_defaults(purpose, provider_key, model_key)
-- VALUES ('image','openai',NULL), ('sketch','openai',NULL), ('estimate','openai',NULL)
-- ON CONFLICT (purpose) DO NOTHING;

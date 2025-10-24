-- AI providers and services seeded from existing client config (apiSettings.js)
-- This migration introduces DB-managed providers/services to keep Admin in sync

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Providers master
CREATE TABLE IF NOT EXISTS ai_providers (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_timestamp_ai_providers
BEFORE UPDATE ON ai_providers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Services: concrete API surface per provider/use with api_url, model and params
CREATE TABLE IF NOT EXISTS ai_services (
  id SERIAL PRIMARY KEY,
  provider_id INT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  api_url TEXT NOT NULL,
  model_key TEXT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_services_provider ON ai_services(provider_id);
CREATE TRIGGER set_timestamp_ai_services
BEFORE UPDATE ON ai_services
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Seed providers
INSERT INTO ai_providers (key, name, enabled)
VALUES
  ('openai', 'OpenAI', TRUE),
  ('replicate', 'Replicate', TRUE),
  ('fal', 'Fal.ai', TRUE)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled, updated_at = NOW();

-- Helper CTE to get provider IDs
WITH p AS (
  SELECT id, key FROM ai_providers WHERE key IN ('openai','replicate','fal')
)
-- Seed services based on apps/client/backend/config/apiSettings.js
INSERT INTO ai_services (provider_id, key, api_url, model_key, params, enabled)
VALUES
  -- OpenAI Image Generation (dall-e-3)
  ((SELECT id FROM p WHERE key='openai'), 'openai', 'https://api.openai.com/v1/images/generations', 'dall-e-3', '{"size":"1024x1024","quality":"hd","style":"natural"}'::jsonb, TRUE),
  -- OpenAI Image Generation (gpt-image-1)
  ((SELECT id FROM p WHERE key='openai'), 'openai_image', 'https://api.openai.com/v1/images/generations', 'gpt-image-1', '{"size":"1024x1024","quality":"high"}'::jsonb, TRUE),
  -- OpenAI Image Edit (gpt-image-1)
  ((SELECT id FROM p WHERE key='openai'), 'openai_image_edit', 'https://api.openai.com/v1/images/edits', 'gpt-image-1', '{"size":"1024x1024","quality":"high"}'::jsonb, TRUE),
  -- OpenAI Sketch (gpt-4o-mini)
  ((SELECT id FROM p WHERE key='openai'), 'openai_sketch', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', '{"messages":[{"role":"developer","content":"You are the professional jewelry sketch reader. Your mission is to view uploaded sketch file, interpret it and create a detailed description of the jewelry in the sketch. This description will be later used for AI jewelry generation. You must try to identify jewelry type, materials, stones from the sketch if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural stones (Diamonds, Rubies, Blue Sapphires, Emeralds) stones in sketch can marked with corresponding colors. Jewelry types: Ring, Bracelet, Necklace, Pendant, Earrings, Watch. You must provide response anyway, you must identify the jewelry (use the most likely type of jewelry, materials, stones). Only give exact pure description of jewelry, nothing else, do not mention sketch."},{"role":"user","content":[{"type":"text","text":"REPLACE_WITH_USER_PROMPT"},{"type":"image_url","image_url":{"url":"REPLACE_WITH_IMAGE_DATA"}}]}],"max_tokens":300}'::jsonb, TRUE),
  -- OpenAI Estimate (gpt-4o-mini)
  ((SELECT id FROM p WHERE key='openai'), 'openai_estimate', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', '{"messages":[{"role":"developer","content":"You are the professional jewelry appraiser. Your mission is to estimate uploaded jewerly design in terms of production cost. You must try to estimate jewelry based on approximate gold weight and stones quantity and total Carat from the image if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural or lab grown stones (Diamonds, Rubies, Blue Sapphires, Emeralds). Consider if a jewelry has most likely spherical / 3D type of form (not flat), then it most likely has same stones quantity on the other (not visible) side, then simply double the visible quantity of stones. OUR COSTING SYSTEM: 1 gram of 18k gold - $140, 1 Carat of natural stones - $1,400, 1 Carat of lab grown stones - $320. Try to be as close to the price range as possible. Only give exact pure price range, nothing else, do not mention image. You MUST provide response anyway, you must provide a RESPONSE in a format (NO OTHER WORDS): $1,000 - $2,000"},{"role":"user","content":[{"type":"text","text":"REPLACE_WITH_USER_PROMPT"},{"type":"image_url","image_url":{"url":"REPLACE_WITH_IMAGE_URL"}}]}],"max_tokens":300}'::jsonb, TRUE),
  -- Replicate (flux-1.1-pro-ultra)
  ((SELECT id FROM p WHERE key='replicate'), 'replicate', 'https://api.replicate.com/v1/models', 'black-forest-labs/flux-1.1-pro-ultra', '{"raw":true,"num_images":1,"enable_safety_checker":true,"safety_tolerance":2,"output_format":"png","aspect_ratio":"1:1"}'::jsonb, TRUE),
  -- Fal.ai (flux-pro; version v1.1-ultra kept in params)
  ((SELECT id FROM p WHERE key='fal'), 'fal', 'https://queue.fal.run', 'fal-ai/flux-pro', '{"version":"v1.1-ultra","sync_mode":false,"num_images":1,"enable_safety_checker":true,"raw":true,"safety_tolerance":2,"output_format":"png","aspect_ratio":"1:1"}'::jsonb, TRUE)
ON CONFLICT (key)
DO UPDATE SET api_url = EXCLUDED.api_url,
              model_key = EXCLUDED.model_key,
              params = EXCLUDED.params,
              enabled = EXCLUDED.enabled,
              updated_at = NOW();

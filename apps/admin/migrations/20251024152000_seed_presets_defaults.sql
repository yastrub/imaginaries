-- Seed default preset set and presets; seed ai_defaults
-- Safe to run multiple times (ON CONFLICT guards)

-- Default preset set
INSERT INTO preset_sets (name, slug, is_default)
VALUES ('Default', 'default', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Presets for Styles
WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'layered', 'Layered', '{"section":"Styles","group":"Style","value":"layered"}'::jsonb, FALSE, 10 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'minimalist', 'Minimalist', '{"section":"Styles","group":"Style","value":"minimalist"}'::jsonb, FALSE, 20 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'bold', 'Bold', '{"section":"Styles","group":"Style","value":"bold"}'::jsonb, FALSE, 30 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'organic-shapes', 'Organic Shapes', '{"section":"Styles","group":"Shape","value":"organic shapes, inspired by nature"}'::jsonb, FALSE, 40 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'geometric', 'Geometric', '{"section":"Styles","group":"Shape","value":"geometric patterns or shapes"}'::jsonb, FALSE, 50 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'honeycombs', 'Honeycombs', '{"section":"Styles","group":"Shape","value":"honeycomb inspired patterns"}'::jsonb, FALSE, 60 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'contemporary', 'Contemporary', '{"section":"Styles","group":"Generation","value":"contemporary"}'::jsonb, FALSE, 70 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'innovative', 'Innovative', '{"section":"Styles","group":"Generation","value":"innovative"}'::jsonb, FALSE, 80 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'sci-fi', 'Sci-Fi', '{"section":"Styles","group":"Generation","value":"Sci-Fi"}'::jsonb, FALSE, 90 FROM s
ON CONFLICT DO NOTHING;

-- Presets for Material
WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'white-gold', 'White Gold', '{"section":"Material","value":"18k white gold"}'::jsonb, FALSE, 100 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'yellow-gold', 'Yellow Gold', '{"section":"Material","value":"18k yellow gold"}'::jsonb, FALSE, 110 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'rose-gold', 'Rose Gold', '{"section":"Material","value":"18k rose gold"}'::jsonb, FALSE, 120 FROM s
ON CONFLICT DO NOTHING;

-- Presets for Stones
WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'diamond', 'Diamond', '{"section":"Stones","group":"Stone","value":"diamond"}'::jsonb, FALSE, 130 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'ruby', 'Ruby', '{"section":"Stones","group":"Stone","value":"ruby"}'::jsonb, FALSE, 140 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'blue-sapphire', 'Blue Sapphire', '{"section":"Stones","group":"Stone","value":"blue sapphire"}'::jsonb, FALSE, 150 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'emerald', 'Emerald', '{"section":"Stones","group":"Stone","value":"emerald"}'::jsonb, FALSE, 160 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'single-stone', 'Single Stone', '{"section":"Stones","group":"Stone Count","value":"single stone"}'::jsonb, FALSE, 170 FROM s
ON CONFLICT DO NOTHING;

WITH s AS (SELECT id FROM preset_sets WHERE slug = 'default')
INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
SELECT s.id, 'many-stones', 'Many Stones', '{"section":"Stones","group":"Stone Count","value":"many stones"}'::jsonb, FALSE, 180 FROM s
ON CONFLICT DO NOTHING;

-- ai_defaults (provider/model per purpose)
INSERT INTO ai_defaults (purpose, provider_key, model_key)
VALUES
  ('image', 'openai', NULL),
  ('sketch', 'openai', NULL),
  ('estimate', 'openai', NULL)
ON CONFLICT (purpose)
DO UPDATE SET provider_key = EXCLUDED.provider_key,
              model_key = EXCLUDED.model_key,
              updated_at = NOW();

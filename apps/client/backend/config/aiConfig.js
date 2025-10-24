import { query } from './db.js';
import { settings } from './apiSettings.js';

// Simple in-memory cache with TTL
const cache = new Map();
const TTL_MS = 30 * 1000; // 30s

function setCache(key, value) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.value;
}

export async function getPrompt(scope, key) {
  const ck = `prompt:${scope}:${key}`;
  const hit = getCache(ck);
  if (hit !== null) return hit;
  try {
    const res = await query(
      `SELECT content
       FROM ai_prompts
       WHERE scope = $1 AND key = $2 AND is_active = TRUE
       ORDER BY version DESC
       LIMIT 1`,
      [scope, key]
    );
    const content = res.rows?.[0]?.content || null;
    setCache(ck, content);
    return content;
  } catch {
    // Table might not exist yet; fallback
    setCache(ck, null);
    return null;
  }
}

export async function getRoute(purpose) {
  const ck = `route:${purpose}`;
  const hit = getCache(ck);
  if (hit !== null) return hit;
  try {
    // Lean approach: use ai_defaults for provider/model selection
    const res = await query(
      `SELECT purpose, provider_key, model_key FROM ai_defaults WHERE purpose = $1 LIMIT 1`,
      [purpose]
    );
    const row = res.rows?.[0] || null;
    setCache(ck, row);
    return row;
  } catch {
    setCache(ck, null);
    return null;
  }
}

export function getFallbackDefault(purpose) {
  // Fallback to apiSettings.js
  const provider = settings?.imageGeneration?.defaultProvider || 'openai';
  return { purpose, provider_key: provider, model_key: null };
}

import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

// GET /api/presets -> return default set with presets
router.get('/', async (req, res) => {
  try {
    // Try default set
    let setRes = await query(`SELECT id, name, slug, is_default FROM preset_sets WHERE is_default = TRUE LIMIT 1`);
    if (!setRes.rows.length) {
      // Fallback: first available set
      setRes = await query(`SELECT id, name, slug, is_default FROM preset_sets ORDER BY created_at ASC LIMIT 1`);
    }
    if (!setRes.rows.length) return res.json({ set: null, presets: [] });
    const set = setRes.rows[0];
    const presetsRes = await query(
      `SELECT id, key, label, payload, is_default, sort_order
       FROM presets
       WHERE preset_set_id = $1
       ORDER BY sort_order ASC, label ASC`,
      [set.id]
    );
    return res.json({ set, presets: presetsRes.rows });
  } catch (e) {
    console.error('[presets] list default error', e);
    return res.status(500).json({ error: 'Failed to load presets' });
  }
});

// GET /api/presets/sets -> list all sets (id, name, slug, is_default)
router.get('/sets', async (_req, res) => {
  try {
    const sets = await query(`SELECT id, name, slug, is_default FROM preset_sets ORDER BY name ASC`);
    return res.json({ sets: sets.rows });
  } catch (e) {
    console.error('[presets] list sets error', e);
    return res.status(500).json({ error: 'Failed to list preset sets' });
  }
});

// GET /api/presets/:slug -> return set by slug with presets
router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const setRes = await query(`SELECT id, name, slug, is_default FROM preset_sets WHERE slug = $1 LIMIT 1`, [slug]);
    if (!setRes.rows.length) return res.status(404).json({ error: 'Preset set not found' });
    const set = setRes.rows[0];
    const presetsRes = await query(
      `SELECT id, key, label, payload, is_default, sort_order
       FROM presets
       WHERE preset_set_id = $1
       ORDER BY sort_order ASC, label ASC`,
      [set.id]
    );
    return res.json({ set, presets: presetsRes.rows });
  } catch (e) {
    console.error('[presets] get by slug error', e);
    return res.status(500).json({ error: 'Failed to load preset set' });
  }
});

export { router as presetsRouter };

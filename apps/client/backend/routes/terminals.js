import express from 'express';
import { query } from '../config/db.js';

export const terminalsRouter = express.Router();

function isUUID(v = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v));
}

// POST /api/terminals/heartbeat
// Body: { terminal_id, app_version?, os_version?, battery?, network? }
terminalsRouter.post('/heartbeat', async (req, res) => {
  try {
    const { terminal_id, app_version = null, os_version = null } = req.body || {};
    if (!isUUID(terminal_id)) {
      return res.status(400).json({ error: 'terminal_id (UUID) is required' });
    }

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;

    const sql = `
      UPDATE terminals
      SET last_seen_at = now(), last_seen_ip = $2, app_version = COALESCE($3, app_version), os_version = COALESCE($4, os_version), updated_at = now()
      WHERE id = $1
      RETURNING id
    `;

    const result = await query(sql, [terminal_id, ip, app_version, os_version]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'terminal not found' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('Heartbeat error', e);
    return res.status(500).json({ error: 'heartbeat_failed' });
  }
});

// GET /api/terminals/config?tid=...
// Returns remote-config to control terminal behavior
terminalsRouter.get('/config', async (req, res) => {
  try {
    const tid = req.query.tid?.toString();
    if (!isUUID(tid)) {
      return res.status(400).json({ error: 'invalid_terminal_id' });
    }

    // TODO: Optionally fetch per-terminal config from DB later
    const cfg = {
      fullscreen: true,
      keepAwake: true,
      disablePinchZoom: true,
      overscrollBehavior: 'none',
      commands: [],
    };

    res.setHeader('Cache-Control', 'no-store');
    return res.json(cfg);
  } catch (e) {
    console.error('Config error', e);
    return res.status(500).json({ error: 'config_failed' });
  }
});

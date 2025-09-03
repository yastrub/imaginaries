import express from 'express';
import { query } from '../../config/db.js';
import { auth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const router = express.Router();

// List users with pagination and simple search
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').toString().trim();

    let where = '';
    let params = [];
    if (q) {
      where = 'WHERE email ILIKE $1';
      params.push(`%${q}%`);
    }

    const usersSql = `
      SELECT 
        u.id,
        u.email,
        u.email_confirmed,
        u.subscription_plan,
        u.role_id,
        r.name AS role_name,
        u.created_at,
        u.last_login_at
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM users ${where}`;

    const [usersResult, countResult] = await Promise.all([
      query(usersSql, [...params, limit, offset]),
      query(countSql, params)
    ]);

    res.json({
      data: usersResult.rows,
      total: countResult.rows[0].total,
      page,
      pageSize: limit
    });
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Get user by id
router.get('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
         u.id,
         u.email,
         u.email_confirmed,
         u.subscription_plan,
         u.role_id,
         r.name AS role_name,
         u.created_at,
         u.last_login_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update email_confirmed
router.patch('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, email_confirmed } = req.body || {};

    const fields = [];
    const values = [];
    let idx = 1;

    // Prefer numeric role_id;
    let targetRoleId = null;
    if (typeof role_id === 'number') {
      targetRoleId = role_id;
    }
    if (targetRoleId !== null) {
      fields.push(`role_id = $${idx++}`);
      values.push(targetRoleId);
    }
    if (typeof email_confirmed === 'boolean') {
      fields.push(`email_confirmed = $${idx++}`);
      values.push(email_confirmed);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, email_confirmed, subscription_plan, role_id, created_at, last_login_at`;
    const result = await query(sql, values);
    const updated = result.rows[0];
    // Load role_name for response
    const roleRes = await query('SELECT name AS role_name FROM roles WHERE id = $1', [updated.role_id]);
    res.json({ ...updated, role_name: roleRes.rows[0]?.role_name || null });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export { router as adminUsersRouter };


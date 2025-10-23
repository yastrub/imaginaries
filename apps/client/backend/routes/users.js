import express from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { getPlanConfig } from '../config/plans.js';

const router = express.Router();

// Get user subscription info
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is requesting their own data
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      'SELECT subscription_plan, subscription_updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const planConfig = getPlanConfig(user.subscription_plan);

    let max_generations_per_month = 0;
    let max_free_generations = 0;
    try {
      const limitRes = await query(
        'SELECT max_generations_per_month, max_free_generations FROM plans WHERE key = $1',
        [user.subscription_plan]
      );
      max_generations_per_month = parseInt(limitRes.rows?.[0]?.max_generations_per_month ?? 0, 10) || 0;
      max_free_generations = parseInt(limitRes.rows?.[0]?.max_free_generations ?? 0, 10) || 0;
    } catch {}

    const isFree = (user.subscription_plan || 'free') === 'free';
    if (isFree && (max_free_generations || 0) <= 0) {
      max_free_generations = 3;
    }
    const effective_limit = isFree ? Math.max(0, max_free_generations) : Math.max(0, max_generations_per_month + max_free_generations);

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const next_reset_at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();

    const countResult = await query(
      'SELECT COUNT(*)::int AS c FROM images WHERE user_id = $1 AND created_at >= $2',
      [userId, startOfMonth.toISOString()]
    );
    const month_count = parseInt(countResult.rows?.[0]?.c ?? 0, 10) || 0;

    res.json({
      subscription_plan: user.subscription_plan,
      subscription_updated_at: user.subscription_updated_at,
      plan_details: planConfig,
      max_generations_per_month,
      max_free_generations,
      effective_limit,
      monthly_generation_count: month_count,
      next_reset_at
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription info' });
  }
});

export { router as usersRouter };
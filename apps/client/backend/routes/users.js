import express from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { getPlanConfig } from '../config/plans.js';

const router = express.Router();

// Internal handler using JWT user ID only
async function getSubscriptionForCurrentUser(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT subscription_plan, subscription_updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Pull plan flags and limits from DB
    let planRow = null;
    try {
      const planRes = await query(
        `SELECT key, name, show_watermark, allow_private_images, allow_camera, max_generations_per_month, max_free_generations
         FROM plans WHERE key = $1`,
        [user.subscription_plan]
      );
      planRow = planRes.rows?.[0] || null;
    } catch {}

    const max_generations_per_month = parseInt(planRow?.max_generations_per_month ?? 0, 10) || 0;
    const max_free_generations = parseInt(planRow?.max_free_generations ?? 0, 10) || 0;

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
      // Prefer DB-backed plan details. Fallback to static if missing.
      plan_details: {
        key: user.subscription_plan,
        name: planRow?.name || getPlanConfig(user.subscription_plan)?.name || user.subscription_plan,
        requiresWatermark: !!(planRow?.show_watermark ?? getPlanConfig(user.subscription_plan)?.requiresWatermark),
        allowPrivateImages: !!(planRow?.allow_private_images ?? getPlanConfig(user.subscription_plan)?.allowPrivateImages),
        allowCamera: !!(planRow?.allow_camera ?? false),
      },
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
}

// SECURE: always use JWT, ignore URL param
router.get('/:userId', auth, async (req, res) => {
  return getSubscriptionForCurrentUser(req, res);
});

// Preferred explicit route
router.get('/me', auth, async (req, res) => {
  return getSubscriptionForCurrentUser(req, res);
});

export { router as usersRouter };
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

    res.json({
      subscription_plan: user.subscription_plan,
      subscription_updated_at: user.subscription_updated_at,
      plan_details: planConfig
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription info' });
  }
});

export { router as usersRouter };
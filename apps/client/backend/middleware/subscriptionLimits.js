import { query } from '../config/db.js';
import { planConfigs, PLANS } from '../config/plans.js';

// Cache for generation counts to reduce database load
const generationCountCache = new Map();

// Clear cache every hour
setInterval(() => {
  generationCountCache.clear();
}, 60 * 60 * 1000);

export async function checkGenerationLimits(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's subscription plan
    const planResult = await query(
      'SELECT subscription_plan, subscription_updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    const userPlan = planResult.rows[0]?.subscription_plan || PLANS.FREE;
    const planConfig = planConfigs[userPlan];

    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    // Get today's date in YYYY-MM-DD format for the cache key
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${req.user.id}-${today}`;

    // Check cache first
    let dailyCount = generationCountCache.get(cacheKey);

    if (dailyCount === undefined) {
      // If not in cache, query the database
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const countResult = await query(
        'SELECT COUNT(*) FROM images WHERE user_id = $1 AND created_at >= $2',
        [req.user.id, startOfDay.toISOString()]
      );

      dailyCount = parseInt(countResult.rows[0].count);
      generationCountCache.set(cacheKey, dailyCount);
    }

    if (dailyCount >= planConfig.maxGenerationsPerDay) {
      return res.status(429).json({
        error: 'Daily generation limit reached',
        limit: planConfig.maxGenerationsPerDay,
        plan: userPlan,
        count: dailyCount
      });
    }

    // Increment the count in cache
    generationCountCache.set(cacheKey, dailyCount + 1);
    next();
  } catch (error) {
    console.error('Error checking generation limits:', error);
    next(error);
  }
}
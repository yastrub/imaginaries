import { query } from '../config/db.js';
import { PLANS } from '../config/plans.js';

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

    // Resolve monthly paid and free limits from plans table
    let paidLimit = 0;
    let freeLimit = 0;
    try {
      const limitRes = await query(
        'SELECT max_generations_per_month, max_free_generations FROM plans WHERE key = $1',
        [userPlan]
      );
      paidLimit = parseInt(limitRes.rows?.[0]?.max_generations_per_month ?? 0, 10) || 0;
      freeLimit = parseInt(limitRes.rows?.[0]?.max_free_generations ?? 0, 10) || 0;
    } catch {}
    // Free plan: only freeLimit applies; fallback to 3 if zero
    if (userPlan === PLANS.FREE) {
      if ((freeLimit || 0) <= 0) freeLimit = 3;
    }
    const effectiveLimit = userPlan === PLANS.FREE
      ? Math.max(0, freeLimit)
      : Math.max(0, paidLimit + freeLimit);
    // If effective limit is 0, block all generations
    if (effectiveLimit <= 0) {
      return res.status(429).json({
        error: 'Generation limit reached',
        limit: 0,
        plan: userPlan,
        count: 0
      });
    }

    // Get current month key for cache (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const cacheKey = `${req.user.id}-${monthKey}`;

    // Check cache first
    let monthCount = generationCountCache.get(cacheKey);

    if (monthCount === undefined) {
      // If not in cache, query the database
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      const countResult = await query(
        'SELECT COUNT(*) FROM images WHERE user_id = $1 AND created_at >= $2',
        [req.user.id, startOfMonth.toISOString()]
      );

      monthCount = parseInt(countResult.rows[0].count);
      generationCountCache.set(cacheKey, monthCount);
    }

    if (monthCount >= effectiveLimit) {
      return res.status(429).json({
        error: 'Monthly generation limit reached',
        limit: effectiveLimit,
        plan: userPlan,
        count: monthCount
      });
    }

    // Increment the count in cache
    generationCountCache.set(cacheKey, monthCount + 1);
    next();
  } catch (error) {
    console.error('Error checking generation limits:', error);
    next(error);
  }
}
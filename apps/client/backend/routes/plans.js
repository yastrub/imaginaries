import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

// Public: list active, public plans in display order
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        key,
        name,
        description,
        max_generations_per_day,
        show_watermark,
        allow_private_images,
        price_cents,
        annual_price_cents,
        currency,
        sort_order
      FROM plans
      WHERE is_active = TRUE AND is_public = TRUE
      ORDER BY sort_order ASC, id ASC
    `);

    const data = result.rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      maxGenerationsPerDay: r.max_generations_per_day,
      requiresWatermark: r.show_watermark,
      allowPrivateImages: r.allow_private_images,
      priceCents: r.price_cents ?? 0,
      annualPriceCents: r.annual_price_cents ?? null,
      currency: r.currency || 'USD',
      sortOrder: r.sort_order ?? 0,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error listing plans:', error);
    res.status(500).json({ error: 'Failed to list plans' });
  }
});

export { router as plansRouter };

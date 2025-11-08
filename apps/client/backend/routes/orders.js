import express from 'express';
import { auth } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { sendEmail } from '../config/email.js';

const router = express.Router();

// Create a new order (auth required)
router.post('/', auth, async (req, res) => {
  try {
    const user = req.user; // from auth middleware
    const {
      imageId,
      notes = '',
      estimatedPriceText = null,
      selectedOption = null,
      selectedPriceCents: selectedPriceCentsRaw = null,
      selectedPriceDollars = null,
      firstName = null,
      lastName = null,
      phone = null,
    } = req.body || {};

    if (!imageId) {
      return res.status(400).json({ error: 'imageId is required' });
    }

    // Optionally update user's profile details (first/last/phone)
    try {
      const fn = typeof firstName === 'string' ? firstName.trim() : null;
      const ln = typeof lastName === 'string' ? lastName.trim() : null;
      const ph = typeof phone === 'string' ? phone.trim() : null;
      if (fn || ln || ph) {
        await query(
          `UPDATE users
             SET first_name = COALESCE($1, first_name),
                 last_name = COALESCE($2, last_name),
                 phone = COALESCE($3, phone)
           WHERE id = $4`,
          [fn || null, ln || null, ph || null, user.id]
        );
      }
    } catch (e) {
      // Don't fail the order on profile update issues
      console.warn('[orders] profile update skipped:', e?.message);
    }

    // Try to fetch user profile name if available
    let fullName = null;
    try {
      const u = await query(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [user.id]
      );
      if (u.rows.length) {
        const { first_name, last_name } = u.rows[0];
        const parts = [first_name, last_name].filter(Boolean);
        if (parts.length) fullName = parts.join(' ');
      }
    } catch {}

    // Try to extract estimated price from image metadata if not provided
    let estimatedText = estimatedPriceText;
    if (!estimatedText) {
      try {
        const img = await query(
          `SELECT metadata FROM images WHERE id = $1`,
          [imageId]
        );
        if (img.rows.length) {
          const md = img.rows[0].metadata || {};
          estimatedText = md.estimated_cost || md.estimatedCost || null;
        }
      } catch {}
    }

    // Normalize selected price to cents if provided
    let selectedPriceCents = null;
    if (typeof selectedPriceCentsRaw === 'number' && Number.isFinite(selectedPriceCentsRaw)) {
      selectedPriceCents = Math.round(selectedPriceCentsRaw);
    } else if (selectedPriceDollars != null) {
      const dollarsNum = Number(selectedPriceDollars);
      if (Number.isFinite(dollarsNum)) selectedPriceCents = Math.round(dollarsNum * 100);
    }

    // Persist the order
    const hasSelected = typeof selectedOption === 'string' && selectedOption.length > 0 && Number.isFinite(selectedPriceCents);
    const sql = hasSelected
      ? `INSERT INTO orders (user_id, image_id, notes, estimated_price_text, selected_option, selected_price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at, selected_option, selected_price_cents`
      : `INSERT INTO orders (user_id, image_id, notes, estimated_price_text)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`;

    const values = hasSelected
      ? [user.id, String(imageId), notes || null, estimatedText || null, selectedOption, selectedPriceCents]
      : [user.id, String(imageId), notes || null, estimatedText || null];

    const ins = await query(sql, values);

    const order = ins.rows[0];

    // Fetch image info for email (best-effort)
    let imageUrl = null;
    let prompt = null;
    try {
      const img2 = await query(
        `SELECT image_url, watermarked_url, prompt, created_at FROM images WHERE id = $1`,
        [imageId]
      );
      if (img2.rows.length) {
        const row = img2.rows[0];
        imageUrl = row.image_url || row.watermarked_url;
        prompt = row.prompt || null;
      }
    } catch {}

    // Send an admin-facing email about the order
    try {
      await sendEmail('orderCreated', {
        // Email will go to QUOTE_REQUEST_EMAIL inbox
        email: user.email, // reply-to will be set accordingly
        name: fullName || undefined, // allow undefined
        imageUrl,
        imageId: imageId,
        prompt,
        createdAt: new Date().toISOString(),
        estimatedCost: estimatedText || 'Not available',
        selectedOption: selectedOption || undefined,
        selectedPrice: Number.isFinite(selectedPriceCents) ? `$${(selectedPriceCents/100).toFixed(2)} USD` : undefined,
        notes: notes || undefined,
        phone: (typeof phone === 'string' && phone.trim()) ? phone.trim() : undefined,
      });
    } catch (e) {
      // Do not fail the request if email sending fails
      console.error('[orders] email send failed:', e.message);
    }

    return res.json({
      id: order.id,
      created_at: order.created_at,
      estimated_price_text: estimatedText || null,
      status: 'ok'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

export { router as ordersRouter };

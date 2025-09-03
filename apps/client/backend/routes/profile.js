import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { auth } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { sendEmail } from '../config/email.js';

const router = express.Router();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173';
}

// Update profile names
router.patch('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    let { first_name, last_name } = req.body || {};

    if (typeof first_name === 'string') first_name = first_name.trim();
    if (typeof last_name === 'string') last_name = last_name.trim();

    if (first_name === undefined && last_name === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (first_name && first_name.length > 100) {
      return res.status(400).json({ error: 'First name is too long' });
    }
    if (last_name && last_name.length > 100) {
      return res.status(400).json({ error: 'Last name is too long' });
    }

    const result = await query(
      `UPDATE users
       SET 
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name)
       WHERE id = $3
       RETURNING id, email, first_name, last_name` ,
      [first_name ?? null, last_name ?? null, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Initiate change email (send confirmation to new email)
router.post('/change-email', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { new_email } = req.body || {};

    if (!new_email) {
      return res.status(400).json({ error: 'New email is required' });
    }

    const email = String(new_email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (email === String(req.user.email).toLowerCase()) {
      return res.status(400).json({ error: 'New email must be different from current email' });
    }

    // Ensure email not used by someone else currently
    const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const confirmationToken = generateToken();
    const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await query(
      `UPDATE users 
       SET pending_email = $1, confirmation_token = $2, confirmation_expires = $3 
       WHERE id = $4`,
      [email, confirmationToken, confirmationExpires, userId]
    );

    try {
      await sendEmail('confirmEmail', {
        email,
        confirmationToken,
        confirmationUrl: `${getAppUrl()}/confirm-email?token=${confirmationToken}`
      });
    } catch (emailError) {
      console.error('Failed to send email change confirmation:', emailError);
      return res.status(500).json({ error: 'Failed to send confirmation email' });
    }

    res.json({ success: true, message: 'Confirmation email sent to new address' });
  } catch (error) {
    console.error('Change email initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate email change' });
  }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const userRes = await query('SELECT id, password FROM users WHERE id = $1', [userId]);
    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(String(current_password), user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(String(new_password), 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export { router as profileRouter };

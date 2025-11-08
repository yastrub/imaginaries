import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { sendEmail } from '../config/email.js';
import crypto from 'crypto';
import { auth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import os from 'os';

const router = express.Router();

// Helper function to generate confirmation token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: generate a strong random password and hash it (for passwordless creates)
function generateRandomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}
async function hashRandomPassword() {
  const pw = generateRandomPassword();
  return bcrypt.hash(pw, 10);
}

// Helper function to generate app URL
function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173';
}

// Helper function to generate JWT token (now includes roles and single-role fields)
function generateJWT(userId, email, roles = [], role_id = null, role_name = null) {
  return jwt.sign(
    { userId, email, roles, role_id, role_name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Helper function to set auth cookie
function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

// Verify 6-digit code
router.post('/magic/verify-code', authLimiter, async (req, res) => {
  try {
    if ((process.env.AUTH_PROVIDER || 'local').toLowerCase() !== 'local') {
      return res.status(404).json({ error: 'Code login only available in local auth mode' });
    }
    const { email, code, promoCode } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const emailNorm = String(email).toLowerCase().trim();
    const codeStr = String(code).replace(/\D/g, '');
    if (!/^\d{6}$/.test(codeStr)) return res.status(400).json({ error: 'Invalid code format' });
    const codeHash = crypto.createHash('sha256').update(codeStr).digest('hex');

    // Find latest valid, unused code
    const ml = await query(
      `SELECT * FROM magic_links
       WHERE email = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [emailNorm, codeHash]
    );
    const row = ml.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid or expired code' });

    // Resolve or create user
    let userId = row.user_id;
    if (!userId) {
      const u = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [emailNorm]);
      let user = u.rows[0];
      const ip = req.headers['cf-connecting-ip'] || req.headers['x-client-ip'] || req.headers['x-real-ip'] || (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'Unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      if (!user) {
        const hashed = await hashRandomPassword();
        // Validate promo (optional)
        let promoNorm = (promoCode || '').toString().toLowerCase().trim();
        let subscriptionPlan = 'free';
        let promoToStore = null;
        if (promoNorm) {
          try {
            const promoRes = await query('SELECT id, plan FROM promo_codes WHERE id = $1 AND is_valid = true', [promoNorm]);
            if (promoRes.rows.length) {
              promoToStore = promoRes.rows[0].id;
              const plan = promoRes.rows[0].plan;
              if (plan && plan !== 'free') subscriptionPlan = plan;
            }
          } catch {}
        }
        const ins = await query(
          `INSERT INTO users (email, password, email_confirmed, initial_ip, last_ip, last_user_agent, subscription_plan, promo_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [emailNorm, hashed, true, ip, ip, userAgent, subscriptionPlan, promoToStore]
        );
        user = ins.rows[0];
      } else {
        await query('UPDATE users SET last_ip = $1, last_user_agent = $2, last_login_at = CURRENT_TIMESTAMP WHERE id = $3', [ip, userAgent, user.id]);
      }
      userId = user.id;
    }

    // Mark used
    await query('UPDATE magic_links SET used_at = NOW() WHERE id = $1', [row.id]);

    // Fetch role and mint cookie
    const roleRes = await query(
      `SELECT u.email, u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];
    const appToken = generateJWT(userId, roleRow.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, appToken);

    // Return user payload
    const userRes = await query(
      `SELECT u.id, u.email, u.email_confirmed, u.subscription_plan, u.created_at,
              u.first_name, u.last_name, u.role_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );
    const user = userRes.rows[0] || { id: userId, email: roleRow.email, role_id: roleRow.role_id, role_name: roleRow.role_name };
    return res.json({ user: { ...user, roles }, isAuthenticated: true });
  } catch (error) {
    console.error('Verify code error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// Add auth middleware to protected routes
router.use('/resend-confirmation', auth);

// Magic Link: request and verify (only when local auth)
router.post('/magic/request', authLimiter, async (req, res) => {
  try {
    if ((process.env.AUTH_PROVIDER || 'local').toLowerCase() !== 'local') {
      return res.status(404).json({ error: 'Magic links only available in local auth mode' });
    }
    const { email, redirect, promoCode } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const emailNorm = String(email).toLowerCase().trim();

    // Generate single-use token and code
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Try find user (optional)
    const u = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [emailNorm]);
    const userId = u.rows[0]?.id || null;

    // Persist magic link (single-use)
    await query(
      `INSERT INTO magic_links (user_id, email, token_hash, code_hash, expires_at, created_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [userId, emailNorm, tokenHash, codeHash, expiresAt, req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'Unknown', req.headers['user-agent'] || 'Unknown']
    );

    // Build verify URL on backend to set cookie then redirect
    const appUrl = getAppUrl();
    const redirectPath = (typeof redirect === 'string' && redirect.startsWith('/')) ? redirect : '/imagine';
    const promoNorm = (promoCode || '').toString().toLowerCase().trim();
    let verifyUrl = `${process.env.APP_API_URL || ''}/api/auth/magic/verify?token=${rawToken}&r=${encodeURIComponent(redirectPath)}`;
    if (promoNorm) verifyUrl += `&code=${encodeURIComponent(promoNorm)}`;
    // Fallback: if APP_API_URL not set, try relative path on same origin
    let finalVerifyUrl = verifyUrl;
    if (!finalVerifyUrl.startsWith('http')) {
      finalVerifyUrl = `${appUrl.replace(/\/$/, '')}/api/auth/magic/verify?token=${rawToken}&r=${encodeURIComponent(redirectPath)}`;
      if (promoNorm) finalVerifyUrl += `&code=${encodeURIComponent(promoNorm)}`;
    }

    try {
      const mode = (process.env.AUTH_MODE || 'magic').toLowerCase();
      if (mode === 'code') {
        await sendEmail('codeLogin', { email: emailNorm, code, expiresMinutes: 15 });
      } else {
        await sendEmail('magicLink', { email: emailNorm, magicUrl: finalVerifyUrl });
      }
    } catch (e) {
      console.error('Failed to send magic link:', e);
      return res.status(500).json({ error: 'Failed to send magic link' });
    }

    return res.json({ success: true, message: 'Magic link sent if the email is registered' });
  } catch (error) {
    console.error('Magic link request error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

router.get('/magic/verify', async (req, res) => {
  try {
    if ((process.env.AUTH_PROVIDER || 'local').toLowerCase() !== 'local') {
      return res.status(404).json({ error: 'Magic links only available in local auth mode' });
    }
    const rawToken = String(req.query.token || '').trim();
    if (!rawToken) return res.status(400).send('Missing token');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Lookup token
    const ml = await query('SELECT * FROM magic_links WHERE token_hash = $1 LIMIT 1', [tokenHash]);
    const row = ml.rows[0];
    if (!row) return res.status(400).send('Invalid or used token');
    if (row.used_at) return res.status(400).send('This link has already been used');
    if (new Date() > new Date(row.expires_at)) return res.status(400).send('This link has expired');

    // Resolve or create user
    let userId = row.user_id;
    let email = row.email;
    if (!userId) {
      const u = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
      let user = u.rows[0];
      if (!user) {
        // Create user with confirmed email
        const initialIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const hashed = await hashRandomPassword();
        // Extract promo code from query (?code=) or from redirect path r
        let promoNorm = (req.query.code || '').toString().toLowerCase().trim();
        try {
          if (!promoNorm) {
            const r = String(req.query.r || '');
            if (r) {
              const qs = r.includes('?') ? r.split('?')[1] : '';
              if (qs) {
                const params = new URLSearchParams(qs);
                const c = params.get('code');
                if (c) promoNorm = c.toLowerCase().trim();
              }
            }
          }
        } catch {}
        let subscriptionPlan = 'free';
        let promoToStore = null;
        if (promoNorm) {
          try {
            const promoRes = await query('SELECT id, plan FROM promo_codes WHERE id = $1 AND is_valid = true', [promoNorm]);
            if (promoRes.rows.length) {
              promoToStore = promoRes.rows[0].id;
              const plan = promoRes.rows[0].plan;
              if (plan && plan !== 'free') subscriptionPlan = plan;
            }
          } catch {}
        }
        const ins = await query(
          `INSERT INTO users (email, password, email_confirmed, initial_ip, last_ip, last_user_agent, subscription_plan, promo_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [email, hashed, true, initialIp, initialIp, userAgent, subscriptionPlan, promoToStore]
        );
        user = ins.rows[0];
      }
      userId = user.id;
    } else {
      // Touch last login
      await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    }

    // Mark token used
    await query('UPDATE magic_links SET used_at = NOW() WHERE token_hash = $1', [tokenHash]);

    // Fetch role for JWT
    const roleRes = await query(
      `SELECT u.email, u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];

    const appToken = generateJWT(userId, roleRow.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, appToken);

    // Redirect back to app
    const appUrl = getAppUrl();
    const r = String(req.query.r || '/imagine');
    const path = r.startsWith('/') ? r : '/imagine';
    const dest = `${appUrl.replace(/\/$/, '')}${path}`;
    return res.redirect(dest);
  } catch (error) {
    console.error('Magic link verify error:', error);
    return res.status(500).send('Authentication failed');
  }
});

// Clerk token exchange: verify Clerk token, upsert/link user, mint our JWT cookie
router.post('/clerk/exchange', authLimiter, async (req, res) => {
  try {
    if ((process.env.AUTH_PROVIDER || '').toLowerCase() !== 'clerk') {
      return res.status(404).json({ error: 'Clerk auth is disabled' });
    }

    const { token, email: emailFromClient, firstName, lastName } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing Clerk token' });

    // Lazy import jose to avoid hard dependency when not using Clerk
    let jose;
    try {
      jose = await import('jose');
    } catch (e) {
      console.error('Missing dependency: jose. Please install with `npm i jose` in backend.');
      return res.status(500).json({ error: 'Server missing dependency for Clerk verification (jose)' });
    }

    const issuer = (process.env.CLERK_ISSUER || '').trim();
    if (!issuer) return res.status(500).json({ error: 'CLERK_ISSUER is not configured on server' });
    const audience = (process.env.CLERK_AUDIENCE || '').trim() || undefined;
    const jwksUrl = new URL('.well-known/jwks.json', issuer.endsWith('/') ? issuer : issuer + '/');

    const JWKS = jose.createRemoteJWKSet(jwksUrl);
    let payload;
    try {
      const verified = await jose.jwtVerify(token, JWKS, { issuer, audience });
      payload = verified.payload || {};
    } catch (e) {
      console.error('Clerk token verification failed:', e?.message || e);
      return res.status(401).json({ error: 'Invalid Clerk token' });
    }

    const clerkUserId = String(payload.sub || '').trim();
    const emailJwt = (payload.email || payload.email_address || '').toLowerCase();
    const emailVerified = Boolean(payload.email_verified || payload.email_verified_at || payload['https://schemas.clerk.dev/email_verified']);
    const email = (emailJwt || emailFromClient || '').toLowerCase();
    if (!clerkUserId) return res.status(400).json({ error: 'Missing clerk user id in token' });
    if (!email) return res.status(400).json({ error: 'Missing email in token' });

    // Link or create local user
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-client-ip'] || req.headers['x-real-ip'] || (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 1) Try by clerk_user_id
    let dbUserRes = await query('SELECT * FROM users WHERE clerk_user_id = $1', [clerkUserId]);
    let userRow = dbUserRes.rows[0];
    if (!userRow) {
      // 2) Try by email
      dbUserRes = await query('SELECT * FROM users WHERE email = $1', [email]);
      userRow = dbUserRes.rows[0];
      if (userRow) {
        // Attach Clerk id to existing user
        await query('UPDATE users SET clerk_user_id = $1, auth_provider = $2, email_confirmed = $3, first_name = COALESCE(first_name, $4), last_name = COALESCE(last_name, $5), last_ip = $6, last_user_agent = $7, last_login_at = CURRENT_TIMESTAMP WHERE id = $8', [clerkUserId, 'clerk', emailVerified || true, firstName || null, lastName || null, ip, userAgent, userRow.id]);
      } else {
        // Create new user confirmed by Clerk (store random hashed password for NOT NULL constraint)
        const hashed = await hashRandomPassword();
        const ins = await query(
          `INSERT INTO users (email, password, email_confirmed, clerk_user_id, auth_provider, initial_ip, last_ip, last_user_agent, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [email, hashed, true, clerkUserId, 'clerk', ip, ip, userAgent, firstName || null, lastName || null]
        );
        userRow = ins.rows[0];
      }
    } else {
      // Update last seen
      await query('UPDATE users SET last_ip = $1, last_user_agent = $2, last_login_at = CURRENT_TIMESTAMP WHERE id = $3', [ip, userAgent, userRow.id]);
    }

    // Fetch role details for JWT
    const roleRes = await query(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userRow.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];

    const appToken = generateJWT(userRow.id, userRow.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, appToken);

    // Return unified user payload
    const { password: _pw, reset_token: _rt, confirmation_token: _ct, ...safeUser } = userRow;
    return res.json({ user: { ...safeUser, role_id: roleRow.role_id, role_name: roleRow.role_name, roles }, isAuthenticated: true });
  } catch (error) {
    console.error('Clerk exchange error:', error);
    return res.status(500).json({ error: 'Failed to exchange Clerk token' });
  }
});

// Sign up
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, promoCode } = req.body;
    
    // Debug logging for promo code
    console.log('[Server] Signup with promo code:', { email, promoCode });
    
    // Get real IP address (checking multiple headers in order of precedence)
    const initialIp = req.headers['cf-connecting-ip'] || // Cloudflare
                     req.headers['x-client-ip'] || // Some CDNs/proxies
                     req.headers['x-real-ip'] || // Nginx
                     req.headers['x-forwarded-for']?.split(',')[0].trim() || // Standard proxy header (first IP if comma-separated)
                     req.socket.remoteAddress || // Direct connection
                     'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    console.log('[Server] New signup attempt:', { email, initialIp, userAgent });

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate confirmation token
    const confirmationToken = generateToken();
    const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Check if promo code is valid (if provided)
    let validPromoCode = null;
    let subscriptionPlan = 'free'; // Default plan
    
    if (promoCode) {
      // Always store and compare lowercase promo codes
      const normalizedPromoCode = promoCode.toLowerCase().trim();
      
      if (normalizedPromoCode) {
        const promoResult = await query(
          'SELECT id, plan FROM promo_codes WHERE id = $1 AND is_valid = true',
          [normalizedPromoCode]
        );
        
        if (promoResult.rows.length > 0) {
          const { id, plan } = promoResult.rows[0];
          validPromoCode = id;
          
          // Set subscription plan based on promo code's plan (if not null or 'free')
          if (plan && plan !== 'free') {
            subscriptionPlan = plan;
          }
          
          console.log(`Valid promo code used: ${validPromoCode} with plan: ${subscriptionPlan}`);
        } else {
          console.log(`Invalid promo code attempted: ${normalizedPromoCode}`);
        }
      }
    }

    // Create new user
    const result = await query(
      `INSERT INTO users (
        email, 
        password, 
        email_confirmed,
        confirmation_token,
        confirmation_expires,
        initial_ip,
        last_ip,
        last_user_agent,
        promo_code,
        subscription_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id, email, email_confirmed`,
      [
        email.toLowerCase(), 
        hashedPassword, 
        false, 
        confirmationToken, 
        confirmationExpires,
        initialIp,
        initialIp, // Last IP is same as initial IP at signup
        userAgent,
        validPromoCode, // Will be null if code is invalid or not provided
        subscriptionPlan // Set from promo code or default to 'free'
      ]
    );

    const user = result.rows[0];

    // Single-role model: rely on DB default role_id (public) and fetch role
    const roleRes = await query(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];

    // Send confirmation email to user
    try {
      await sendEmail('confirmEmail', {
        email,
        confirmationToken,
        confirmationUrl: `${getAppUrl()}/confirm-email?token=${confirmationToken}`
      });
      console.log('Confirmation email sent for signup');
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the signup if email fails
    }
    
    // Send notification to admin
    try {
      if (process.env.ADMIN_EMAIL) {
        await sendEmail('newUserNotification', {
          email: process.env.ADMIN_EMAIL, // Send to admin email
          userEmail: email, // The new user's email
          initialIp,
          userAgent
        });
        console.log('Admin notification sent for new user signup');
      }
    } catch (adminEmailError) {
      console.error('Failed to send admin notification:', adminEmailError);
      // Don't fail the signup if admin notification fails
    }

    // Generate JWT and set cookie (include roles and role_id/role_name)
    const token = generateJWT(user.id, user.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, token);

    res.json({ 
      user: { ...user, role_id: roleRow.role_id, role_name: roleRow.role_name, roles },
      requiresConfirmation: true
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Sign in
router.post('/signin', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get real IP address (checking multiple headers in order of precedence)
    const clientIp = req.headers['cf-connecting-ip'] || // Cloudflare
                    req.headers['x-client-ip'] || // Some CDNs/proxies
                    req.headers['x-real-ip'] || // Nginx
                    req.headers['x-forwarded-for']?.split(',')[0].trim() || // Standard proxy header (first IP if comma-separated)
                    req.socket.remoteAddress || // Direct connection
                    'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    console.log('[Server] Sign in attempt:', { email, clientIp });

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password (handle passwordless accounts gracefully)
    if (!user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update user's last IP, user agent, and login time
    await query(
      `UPDATE users SET 
        last_ip = $1, 
        last_user_agent = $2, 
        last_login_at = CURRENT_TIMESTAMP 
      WHERE id = $3`,
      [clientIp, userAgent, user.id]
    );
    
    // Single-role model: fetch role_id and name
    const roleRes = await query(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];

    // Generate JWT and set cookie (include roles and role_id/role_name)
    const token = generateJWT(user.id, user.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, token);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    // Return user data with role fields
    res.json({ 
      user: { ...userWithoutPassword, role_id: roleRow.role_id, role_name: roleRow.role_name, roles },
      requiresConfirmation: !user.email_confirmed
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Sign out
router.post('/signout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.json({ message: 'Signed out successfully' });
});

// Resend confirmation email
router.post('/resend-confirmation', async (req, res) => {
  try {
    // User should be available from the auth middleware
    const { id, email, email_confirmed } = req.user;
    
    // Check if email is already confirmed
    if (email_confirmed) {
      return res.status(400).json({ error: 'Email is already confirmed' });
    }
    
    // Generate a new confirmation token
    const confirmationToken = generateToken();
    const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Update user with new confirmation token
    await query(
      'UPDATE users SET confirmation_token = $1, confirmation_expires = $2 WHERE id = $3',
      [confirmationToken, confirmationExpires, id]
    );
    
    // Send confirmation email
    try {
      await sendEmail('confirmEmail', {
        email,
        confirmationToken,
        confirmationUrl: `${getAppUrl()}/confirm-email?token=${confirmationToken}`
      });
      console.log(`Confirmation email resent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      return res.status(500).json({ error: 'Failed to send confirmation email' });
    }
    
    res.json({ success: true, message: 'Confirmation email sent' });
  } catch (error) {
    console.error('Resend confirmation error:', error);
    res.status(500).json({ error: 'Failed to resend confirmation email' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user with single role from database
    const result = await query(
      `SELECT 
         u.id, u.email, u.email_confirmed, u.subscription_plan, u.created_at,
         u.first_name, u.last_name,
         u.role_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    // Derive legacy roles array for compatibility
    const roles = user.role_name ? [user.role_name] : ['public'];
    // Return user data with role fields
    res.json({ 
      user: { ...user, roles },
      requiresConfirmation: !user.email_confirmed
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      console.error('Auth check error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
});

// Confirm email or finalize email change
router.get('/confirm-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required' });
    }
    
    // Find user with this token
    const result = await query(
      'SELECT id, email, email_confirmed, confirmation_expires, pending_email FROM users WHERE confirmation_token = $1',
      [token]
    );
    
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid confirmation token' });
    }
    
    const user = result.rows[0];
    // If pending_email exists, this is an email change confirmation
    const isEmailChange = !!user.pending_email;
    // Check if token is expired
    if (new Date() > new Date(user.confirmation_expires)) {
      return res.status(400).json({ error: 'Confirmation token has expired' });
    }
    let newEmail = user.email;
    if (isEmailChange) {
      // Promote pending_email to primary email
      newEmail = user.pending_email;
      await query(
        'UPDATE users SET email = $1, pending_email = NULL, email_confirmed = true, confirmation_token = NULL, confirmation_expires = NULL WHERE id = $2',
        [newEmail, user.id]
      );
    } else {
      // Initial email confirmation
      await query(
        'UPDATE users SET email_confirmed = true, confirmation_token = NULL, confirmation_expires = NULL WHERE id = $1',
        [user.id]
      );
    }
    
    // Single-role model: fetch role_id and name for JWT
    const roleRes = await query(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];
    // Generate JWT and set cookie (include roles and role_id/role_name)
    const authToken = generateJWT(user.id, newEmail, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, authToken);
    
    // Return success
    res.json({ success: true, message: 'Email confirmed successfully' });
  } catch (error) {
    console.error('Email confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm email' });
  }
});

// Forgot password request
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user
    const result = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    // Check if user exists
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }
    
    const user = result.rows[0];
    
    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    
    // Update user with reset token
    await query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );
    
    // Send reset email
    try {
      await sendEmail('resetPassword', {
        email: user.email,
        resetToken,
        resetUrl: `${getAppUrl()}/reset-password?token=${resetToken}`
      });
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }
    
    res.json({ success: true, message: 'If your email is registered, you will receive a password reset link' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    
    // Find user with this token
    const result = await query(
      'SELECT id, reset_expires FROM users WHERE reset_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    const user = result.rows[0];
    
    // Check if token is expired
    if (new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    
    res.json({ success: true, message: 'Valid reset token' });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify reset token' });
  }
});

// Reset password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Find user with this token
    const result = await query(
      'SELECT id, email, reset_expires FROM users WHERE reset_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    const user = result.rows[0];
    
    // Check if token is expired
    if (new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user with new password and clear reset token
    await query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    // Single-role model: fetch role_id and name for JWT
    const roleRes = await query(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const roles = roleRow.role_name ? [roleRow.role_name] : ['public'];
    // Generate JWT and set cookie (include roles and role_id/role_name)
    const authToken = generateJWT(user.id, user.email, roles, roleRow.role_id, roleRow.role_name);
    setAuthCookie(res, authToken);
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export { router as authRouter };

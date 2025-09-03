import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

// List of endpoints that don't require email confirmation
const ALLOW_UNCONFIRMED = [
  '/api/auth/resend-confirmation',
  '/api/auth/confirm-email',
  '/api/auth/signout',
  '/api/auth/me',
  '/api/profile',
  '/api/profile/change-email',
  '/api/profile/change-password'
];

export const auth = async (req, res, next) => {
  try {
    // Skip auth for public routes
    if (req.path.startsWith('/public') || req.path.startsWith('/shared')) {
      return next();
    }

    const token = req.cookies.token;

    if (!token) {
      console.log('[Auth Middleware] No token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Single-role model: fetch role_id and role_name
      const result = await query(
        `SELECT 
           u.id,
           u.email,
           u.email_confirmed,
           u.subscription_plan,
           u.role_id,
           r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [decoded.userId]
      );

      if (!result.rows.length) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      const roleName = user.role_name;
      const roles = roleName ? [roleName] : ['public'];
      req.user = { ...user, roles };

      // Use originalUrl which includes the full path
      const fullPath = req.originalUrl;

      // Allow unconfirmed users to access specific endpoints
      const allowed = ALLOW_UNCONFIRMED.some((p) => fullPath.startsWith(p));
      if (!user.email_confirmed && !allowed) {
        return res.status(403).json({
          error: 'Email confirmation required',
          requiresConfirmation: true,
          user: {
            id: user.id,
            email: user.email,
            email_confirmed: user.email_confirmed,
            subscription_plan: user.subscription_plan,
            role: roleName,
            roles
          }
        });
      }

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

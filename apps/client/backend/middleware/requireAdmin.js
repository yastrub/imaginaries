export function requireAdmin(req, res, next) {
  try {
    // In development, allow access to speed up integration
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Single-role model: role_id === 1 is superuser
    if (req.user.role_id !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

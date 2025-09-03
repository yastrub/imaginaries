import { rateLimit } from 'express-rate-limit';
// SECURITY OPTIMIZATION:
// RATE LIMITING CONFIGURATION
//
// 1. STRICT LIMITS FOR AUTH ROUTES - Prevent brute force attacks
// 2. HIGHER LIMITS FOR GENERAL ROUTES - Allow normal user interactions
// 3. SEPARATE LIMITERS FOR DIFFERENT CONTEXTS - Balance security and usability
//
// This ensures security while providing a good user experience

// Separate limiter for auth endpoints - stricter to prevent brute force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes - slightly increased but still secure
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests. Please try again later.' },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for /api/auth/me endpoint
    return req.path === '/api/auth/me';
  }
});

// General API limiter - much more permissive for regular application usage
export const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 200, // 200 requests per 5 minutes (significantly increased)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.ip;
  }
});

// Specialized limiter for image generation - balance between preventing abuse and allowing creativity
export const generateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 image generations per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You've reached the image generation limit. Please try again in a few minutes." },
  keyGenerator: (req) => {
    // If authenticated, use user ID for more personalized rate limiting
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    // Otherwise fall back to IP-based limiting
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for premium users if that feature exists
    return req.user && req.user.isPremium === true;
  }
});
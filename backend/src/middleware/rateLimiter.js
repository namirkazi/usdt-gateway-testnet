// src/middleware/rateLimiter.js
// Per-route rate limiters.

const rateLimit = require('express-rate-limit');

// Strict limiter for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs:  15 * 60 * 1000, // 15 minutes
  max:       10,
  message:   { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs:  60 * 1000, // 1 minute
  max:       100,
  message:   { success: false, error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

module.exports = { authLimiter, apiLimiter };

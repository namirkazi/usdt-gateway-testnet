// src/middleware/auth.js
// JWT bearer token middleware.
// All protected routes use this — it attaches req.admin = { id, username }.

const jwt    = require('jsonwebtoken');
const { error } = require('../utils/response');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Unauthorized — no token', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired', 401);
    }
    return error(res, 'Invalid token', 401);
  }
}

module.exports = { authenticate };

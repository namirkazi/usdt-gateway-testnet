// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/database');
const logger = require('../config/logger');
const { success, error } = require('../utils/response');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return error(res, 'Username and password required', 400);
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password FROM admins WHERE username = ?',
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      // Constant-time rejection to prevent username enumeration
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000');
      return error(res, 'Invalid credentials', 401);
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
      logger.warn('Failed login attempt', { username });
      return error(res, 'Invalid credentials', 401);
    }

    const token = jwt.sign(
      { sub: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info('Admin login', { username: admin.username });

    return success(res, {
      token,
      admin: { id: admin.id, username: admin.username },
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

async function me(req, res) {
  return success(res, { admin: req.admin });
}

module.exports = { login, me };

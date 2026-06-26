// src/routes/auth.js
const express = require('express');
const router  = express.Router();
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');

router.post('/login', authLimiter, login);
router.get('/me',     authenticate, me);

module.exports = router;

// src/routes/index.js
// Central router — mounts all sub-routers.

const express = require('express');
const router  = express.Router();

router.use('/auth',         require('./auth'));
router.use('/wallets',      require('./wallets'));
router.use('/transactions', require('./transactions'));

// Health check — no auth required
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

module.exports = router;

// src/routes/wallets.js
const express = require('express');
const router  = express.Router();
const {
  generateNewWallet,
  listWallets,
  getActiveWallet,
  getWalletQr,
  getStats,
} = require('../controllers/walletController');
const { sweepWallet } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

// All wallet routes require authentication
router.use(authenticate);

router.post('/generate',     generateNewWallet);
router.get('/',              listWallets);
router.get('/active',        getActiveWallet);
router.get('/stats',         getStats);
router.get('/:id/qr',        getWalletQr);
router.post('/:id/sweep',    sweepWallet);

module.exports = router;

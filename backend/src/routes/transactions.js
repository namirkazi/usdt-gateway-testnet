// src/routes/transactions.js
const express = require('express');
const router  = express.Router();
const { listTransactions, getTransaction } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',    listTransactions);
router.get('/:id', getTransaction);

module.exports = router;

// src/controllers/walletController.js

const QRCode  = require('qrcode');
const pool    = require('../config/database');
const logger  = require('../config/logger');
const { encrypt } = require('../utils/crypto');
const { generateWallet, getUsdtBalance, getTrxBalance } = require('../blockchain/tronService');
const { success, error, paginated } = require('../utils/response');

/**
 * POST /api/wallets/generate
 * Generate a new TRON wallet and set it as the active wallet.
 * Previous active wallet is archived automatically.
 *
 * Design decision: Only ONE wallet is active at a time.
 * This simplifies the UI and prevents customer confusion.
 * Old wallets remain monitored so late deposits are still caught.
 */
async function generateNewWallet(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Archive the current active wallet
    await conn.query(
      `UPDATE wallets SET status = 'archived', updated_at = NOW() WHERE status = 'active'`
    );

    // Generate fresh wallet from blockchain
    const { address, privateKey } = await generateWallet();

    // Encrypt before any storage
    const encryptedKey = encrypt(privateKey);

    const label = req.body.label || null;

    const [result] = await conn.query(
      `INSERT INTO wallets (address, encrypted_key, status, label)
       VALUES (?, ?, 'active', ?)`,
      [address, encryptedKey, label]
    );

    await conn.commit();

    logger.info('New deposit wallet generated', { address, id: result.insertId });

    // Generate QR code as base64 data URL
    const qrDataUrl = await QRCode.toDataURL(address, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    return success(res, {
      id:        result.insertId,
      address,
      status:    'active',
      label,
      qrCode:    qrDataUrl,
      createdAt: new Date().toISOString(),
    }, 201, 'Wallet generated');
  } catch (err) {
    await conn.rollback();
    logger.error('Wallet generation failed', { error: err.message });
    return error(res, 'Failed to generate wallet', 500);
  } finally {
    conn.release();
  }
}

/**
 * GET /api/wallets
 * List all wallets (active first, then archived).
 */
async function listWallets(req, res) {
  try {
    const [wallets] = await pool.query(
      `SELECT id, address, status, label,
              usdt_balance, trx_balance, last_deposit_at,
              total_received, created_at, last_checked_at
       FROM wallets
       ORDER BY FIELD(status, 'active', 'archived'), created_at DESC`
    );
    return success(res, { wallets });
  } catch (err) {
    logger.error('List wallets error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

/**
 * GET /api/wallets/active
 * Return the single active wallet with live balances and QR code.
 */
async function getActiveWallet(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, address, status, label,
              usdt_balance, trx_balance, last_deposit_at,
              total_received, created_at
       FROM wallets WHERE status = 'active' LIMIT 1`
    );

    if (rows.length === 0) {
      return error(res, 'No active wallet. Generate one first.', 404);
    }

    const wallet = rows[0];

    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(wallet.address, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Fetch live balances (not just cached)
    const [usdtLive, trxLive] = await Promise.all([
      getUsdtBalance(wallet.address),
      getTrxBalance(wallet.address),
    ]);

    // Update cache
    await pool.query(
      `UPDATE wallets SET usdt_balance = ?, trx_balance = ?, last_checked_at = NOW()
       WHERE id = ?`,
      [usdtLive, trxLive, wallet.id]
    );

    return success(res, {
      ...wallet,
      usdt_balance: usdtLive,
      trx_balance:  trxLive,
      qrCode:       qrDataUrl,
    });
  } catch (err) {
    logger.error('getActiveWallet error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

/**
 * GET /api/wallets/:id/qr
 * Return QR code for any wallet by ID.
 */
async function getWalletQr(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT address FROM wallets WHERE id = ?', [id]
    );
    if (rows.length === 0) return error(res, 'Wallet not found', 404);

    const qrDataUrl = await QRCode.toDataURL(rows[0].address, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 2,
    });

    return success(res, { address: rows[0].address, qrCode: qrDataUrl });
  } catch (err) {
    logger.error('getWalletQr error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

/**
 * GET /api/wallets/stats
 * Dashboard summary numbers.
 */
async function getStats(req, res) {
  try {
    const [[walletStats]] = await pool.query(
      `SELECT
         COUNT(*)                              AS total_wallets,
         SUM(usdt_balance)                     AS total_usdt_held,
         SUM(total_received)                   AS total_received_ever
       FROM wallets`
    );

    const [[txStats]] = await pool.query(
      `SELECT
         COUNT(*)                              AS total_transactions,
         SUM(amount_usdt)                      AS total_volume,
         SUM(IF(status='pending', 1, 0))       AS pending_count,
         SUM(IF(status='confirmed', 1, 0))     AS confirmed_count,
         SUM(IF(status='swept', 1, 0))         AS swept_count
       FROM transactions`
    );

    return success(res, { walletStats, txStats });
  } catch (err) {
    logger.error('getStats error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

module.exports = {
  generateNewWallet,
  listWallets,
  getActiveWallet,
  getWalletQr,
  getStats,
};

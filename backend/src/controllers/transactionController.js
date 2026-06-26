// src/controllers/transactionController.js

const pool    = require('../config/database');
const logger  = require('../config/logger');
const { decrypt } = require('../utils/crypto');
const { sweepUsdtToTreasury, getUsdtBalance } = require('../blockchain/tronService');
const { success, error, paginated } = require('../utils/response');

/**
 * GET /api/transactions
 * List transactions with optional filters: wallet_id, status, limit, offset.
 */
async function listTransactions(req, res) {
  const {
    wallet_id, status,
    limit  = 20,
    offset = 0,
  } = req.query;

  const conditions = [];
  const params     = [];

  if (wallet_id) { conditions.push('wallet_id = ?');  params.push(wallet_id); }
  if (status)    { conditions.push('status = ?');     params.push(status); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM transactions ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT id, tx_hash, wallet_id, wallet_address, sender,
              amount_usdt, confirmations, block_number,
              status, sweep_tx_hash, swept_at, detected_at, confirmed_at
       FROM transactions
       ${where}
       ORDER BY detected_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return paginated(res, rows, {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    logger.error('listTransactions error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

/**
 * GET /api/transactions/:id
 */
async function getTransaction(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transactions WHERE id = ?`, [id]
    );
    if (rows.length === 0) return error(res, 'Transaction not found', 404);
    return success(res, { transaction: rows[0] });
  } catch (err) {
    logger.error('getTransaction error', { error: err.message });
    return error(res, 'Server error', 500);
  }
}

/**
 * POST /api/wallets/:id/sweep
 * Manually sweep all USDT from a wallet to the treasury.
 *
 * Security design:
 *  - The treasury address is NEVER sent from the frontend.
 *  - It is read from process.env.TREASURY_ADDRESS server-side only.
 *  - The private key is decrypted in memory, used, then dereferenced.
 *  - We lock the sweep with a DB transaction to prevent double-sweeps.
 */
async function sweepWallet(req, res) {
  const walletId = parseInt(req.params.id);
  if (!walletId) return error(res, 'Invalid wallet ID', 400);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the wallet row for the duration of this operation
    const [[wallet]] = await conn.query(
      `SELECT id, address, encrypted_key, usdt_balance, status
       FROM wallets WHERE id = ? FOR UPDATE`,
      [walletId]
    );

    if (!wallet) {
      await conn.rollback();
      return error(res, 'Wallet not found', 404);
    }

    // Get live balance (not cached)
    const liveBalance = await getUsdtBalance(wallet.address);

    if (liveBalance <= 0) {
      await conn.rollback();
      return error(res, 'No USDT balance to sweep', 400);
    }

    // Check no sweep is already in progress for this wallet
    const [[inProgress]] = await conn.query(
      `SELECT id FROM transactions
       WHERE wallet_id = ? AND status = 'sweeping' LIMIT 1`,
      [walletId]
    );
    if (inProgress) {
      await conn.rollback();
      return error(res, 'A sweep is already in progress for this wallet', 409);
    }

    // Mark all confirmed transactions for this wallet as 'sweeping'
    await conn.query(
      `UPDATE transactions
       SET status = 'sweeping', updated_at = NOW()
       WHERE wallet_id = ? AND status = 'confirmed'`,
      [walletId]
    );

    await conn.commit();

    // ── Perform the on-chain transfer (outside the DB transaction) ──
    let sweepResult;
    try {
      sweepResult = await sweepUsdtToTreasury(
        wallet.encrypted_key,
        wallet.address,
        liveBalance
      );
    } catch (sweepErr) {
      // Roll back the status change if the sweep failed
      await pool.query(
        `UPDATE transactions
         SET status = 'confirmed', updated_at = NOW()
         WHERE wallet_id = ? AND status = 'sweeping'`,
        [walletId]
      );
      logger.error('Sweep failed', { walletId, error: sweepErr.message });
      return error(res, `Sweep failed: ${sweepErr.message}`, 500);
    }

    // ── Persist the successful sweep ────────────────────────────
    await pool.query(
      `UPDATE transactions
       SET status = 'swept',
           sweep_tx_hash = ?,
           swept_at = NOW(),
           updated_at = NOW()
       WHERE wallet_id = ? AND status = 'sweeping'`,
      [sweepResult.txHash, walletId]
    );

    // Zero out the cached balance
    await pool.query(
      `UPDATE wallets
       SET usdt_balance = 0, updated_at = NOW()
       WHERE id = ?`,
      [walletId]
    );

    logger.info('Sweep complete', {
      walletId,
      amount: sweepResult.amount,
      sweepTxHash: sweepResult.txHash,
    });

    return success(res, {
      sweepTxHash: sweepResult.txHash,
      amountSwept: sweepResult.amount,
      to:          'TREASURY (hidden)',
    }, 200, 'Sweep successful');
  } catch (err) {
    await conn.rollback().catch(() => {});
    logger.error('sweepWallet error', { error: err.message });
    return error(res, 'Server error during sweep', 500);
  } finally {
    conn.release();
  }
}

module.exports = { listTransactions, getTransaction, sweepWallet };

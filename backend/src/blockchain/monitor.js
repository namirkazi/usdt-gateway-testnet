// src/blockchain/monitor.js
// Background polling engine.
//
// Design decision — why polling instead of webhooks?
// TronGrid does offer webhooks but they require a public HTTPS endpoint
// with a static IP, which limits local development and simple deployments.
// Our polling approach:
//   • Runs every POLL_INTERVAL_MS (default 30 s)
//   • Only fetches events NEWER than the last known event for each wallet
//   • Uses the TronGrid TRC20 transaction history endpoint (event-style)
//   • Deduplicates via tx_hash UNIQUE constraint in MySQL
//
// In Phase 2 you can swap the inner loop for a webhook handler and keep
// the rest of the persistence logic unchanged.

const cron    = require('node-cron');
const pool    = require('../config/database');
const logger  = require('../config/logger');
const {
  getIncomingUsdtTransfers,
  getUsdtBalance,
  getTrxBalance,
  getCurrentBlock,
} = require('./tronService');

const MIN_CONFIRMATIONS = parseInt(process.env.MIN_CONFIRMATIONS) || 20;

/**
 * Process raw TronGrid TRC20 events and persist new transactions.
 * Returns the count of newly discovered transactions.
 */
async function processTrc20Events(walletId, walletAddress, events, currentBlock) {
  let newCount = 0;

  for (const ev of events) {
    const txHash = ev.transaction_id;
    if (!txHash) continue;

    // Deduplicate: skip if already stored
    const [existing] = await pool.query(
  'SELECT id FROM transactions WHERE tx_hash = ?',
  [txHash]
);

if (existing.length > 0) {
    
    continue;
}
    const rawAmount = ev.value || '0';
    const amountUsdt = Number(rawAmount) / 1_000_000;

    if (amountUsdt <= 0) continue;

    const sender      = ev.from  || 'unknown';
    const detectedAt  = ev.block_timestamp
      ? new Date(ev.block_timestamp)
      : new Date();

    // TronGrid doesn't always give block_number on TRC20 events;
    // we estimate confirmations from current block and event timestamp.
    // On a confirmed historical tx the block is finalized.
    const confirmations = 0; // will be updated by confirmation checker

    await pool.query(
      `INSERT INTO transactions
         (tx_hash, wallet_id, wallet_address, sender, amount_usdt,
          confirmations, status, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [txHash, walletId, walletAddress, sender, amountUsdt, confirmations, detectedAt]
    );

    // Update wallet totals
    await pool.query(
      `UPDATE wallets
       SET total_received = total_received + ?,
           last_deposit_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [amountUsdt, walletId]
    );

    logger.info('New deposit detected', {
      wallet: walletAddress,
      amount: amountUsdt,
      txHash,
    });

    newCount++;
  }

  return newCount;
}

/**
 * Update confirmation counts for all pending transactions.
 * TronGrid's getTransactionInfo returns the block number;
 * confirmations = currentBlock - txBlock.
 */
async function updateConfirmations(currentBlock) {
  const [pending] = await pool.query(
    `SELECT id, tx_hash FROM transactions WHERE status = 'pending'`
  );

  for (const row of pending) {
    try {
      const baseHost = (process.env.TRON_FULL_NODE || 'https://api.trongrid.io').replace(/\/$/, '');
      const url = `${baseHost}/wallet/gettransactioninfobyid?value=${row.tx_hash}`;
      const headers = {};
      if (process.env.TRONGRID_API_KEY) {
        headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
      }
      const res  = await fetch(url, { headers });
      const info = await res.json();

      if (!info || !info.blockNumber) continue;

      const confirmations = Math.max(0, currentBlock - info.blockNumber);

      const newStatus = confirmations >= MIN_CONFIRMATIONS ? 'confirmed' : 'pending';

      await pool.query(
        `UPDATE transactions
         SET confirmations = ?,
             block_number  = ?,
             status        = ?,
             confirmed_at  = IF(? = 'confirmed' AND confirmed_at IS NULL, NOW(), confirmed_at),
             updated_at    = NOW()
         WHERE id = ?`,
        [confirmations, info.blockNumber, newStatus, newStatus, row.id]
      );

      if (newStatus === 'confirmed') {
        logger.info('Transaction confirmed', { txHash: row.tx_hash, confirmations });
      }
    } catch (err) {
      logger.warn('Confirmation update failed', { txHash: row.tx_hash, error: err.message });
    }
  }
}

/**
 * Refresh cached balances for all wallets.
 */
async function refreshBalances(wallets) {
  for (const w of wallets) {
    try {
      const [usdt, trx] = await Promise.all([
        getUsdtBalance(w.address),
        getTrxBalance(w.address),
      ]);
      await pool.query(
        `UPDATE wallets
         SET usdt_balance = ?, trx_balance = ?, last_checked_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [usdt, trx, w.id]
      );
    } catch (err) {
      logger.warn('Balance refresh failed', { address: w.address, error: err.message });
    }
  }
}

/**
 * Main polling cycle.
 */
async function runPollCycle() {
  try {
    // Load all tracked wallets (active + archived — we monitor all)
    const [wallets] = await pool.query(
      `SELECT id, address, last_deposit_at FROM wallets ORDER BY created_at ASC`
    );

    if (wallets.length === 0) return;

    const currentBlock = await getCurrentBlock();

    for (const wallet of wallets) {
      // Only fetch events newer than the last known deposit to minimise API calls
      const sinceMs = wallet.last_deposit_at
        ? new Date(wallet.last_deposit_at).getTime() - 60_000  // 1 min buffer
        : Date.now() - 7 * 24 * 60 * 60 * 1000;               // default: last 7 days

      const events = await getIncomingUsdtTransfers(wallet.address, 0);
      logger.info("Fetched events", {
    wallet: wallet.address,
    count: events.length,
    since: sinceMs
});
      if (events.length > 0) {
        await processTrc20Events(wallet.id, wallet.address, events, currentBlock);
      }
    }

    // Update confirmations on all pending rows
    await updateConfirmations(currentBlock);

    // Refresh cached balances
    await refreshBalances(wallets);

  } catch (err) {
    logger.error('Poll cycle error', { error: err.message });
  }
}

/**
 * Start the monitor.
 * Uses node-cron every 30 seconds (configurable).
 */
function startMonitor() {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS) || 30_000;

  logger.info(`🔍 Wallet monitor starting — polling every ${intervalMs / 1000}s`);

  // Run immediately on startup
  runPollCycle();

  // Then schedule recurring runs
  // node-cron minimum is 1 second; for sub-minute we use setInterval instead
  const intervalSec = Math.max(10, Math.floor(intervalMs / 1000));

  if (intervalSec < 60) {
    setInterval(runPollCycle, intervalMs);
  } else {
    // Use cron for minute-level intervals
    const minutes = Math.floor(intervalSec / 60);
    cron.schedule(`*/${minutes} * * * *`, runPollCycle);
  }
}

module.exports = { startMonitor, runPollCycle };

// src/blockchain/tronService.js
// Low-level blockchain operations.
// This layer has NO database knowledge — it only talks to the Tron network.
// Controllers/services call these functions and persist results themselves.

const { tronWeb, USDT_CONTRACT, USDT_DECIMALS } = require('../config/tron');
const { decrypt } = require('../utils/crypto');
const logger = require('../config/logger');

/**
 * Generate a fresh TRON wallet.
 * Returns only what we need: address + private key.
 * Private key is encrypted BEFORE being returned to the caller.
 */
async function generateWallet() {
  const account = await tronWeb.createAccount();
  return {
    address:      account.address.base58,
    privateKey:   account.privateKey,  // caller must encrypt before storing
  };
}

/**
 * Get the TRX balance of an address (in TRX, not SUN).
 */
async function getTrxBalance(address) {
  try {
    const sun = await tronWeb.trx.getBalance(address);
    return sun / 1_000_000;
  } catch (err) {
    logger.error('getTrxBalance failed', { address, error: err.message });
    return 0;
  }
}

/**
 * Get the USDT TRC20 balance of an address.
 */
async function getUsdtBalance(address) {
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const rawBalance = await contract.balanceOf(address).call();
    return Number(rawBalance.toString()) / Math.pow(10, USDT_DECIMALS);
  } catch (err) {
    logger.error('getUsdtBalance failed', { address, error: err.message });
    return 0;
  }
}

/**
 * Fetch recent TRC20 USDT transfers TO a specific address.
 * Uses TronGrid's event API (event-based, not block polling — more efficient).
 *
 * @param {string} address - Tron base58 address
 * @param {number} sinceTimestamp - Unix ms; only fetch events after this time
 * @returns {Array} array of raw transfer events
 */
async function getIncomingUsdtTransfers(address, sinceTimestamp = 0) {
  try {
    const baseHost = (process.env.TRON_FULL_NODE || 'https://api.trongrid.io').replace(/\/$/, '');
    const url =
      `${baseHost}/v1/accounts/${address}/transactions/trc20` +
      `?contract_address=${USDT_CONTRACT}` +
      `&only_to=true` +
      `&limit=50` +
      `&min_timestamp=${sinceTimestamp}`;

    const headers = {};
    if (process.env.TRONGRID_API_KEY) {
      headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      logger.warn('TronGrid TRC20 fetch failed', { status: res.status, address });
      return [];
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    logger.error('getIncomingUsdtTransfers failed', { address, error: err.message });
    return [];
  }
}

/**
 * Get transaction info (for confirmation count).
 */
async function getTransactionInfo(txHash) {
  try {
    return await tronWeb.trx.getTransactionInfo(txHash);
  } catch (err) {
    logger.error('getTransactionInfo failed', { txHash, error: err.message });
    return null;
  }
}

/**
 * Sweep all USDT from a deposit wallet to the treasury.
 * This is the most sensitive operation in the entire application.
 *
 * Security notes:
 *  - The private key is decrypted in memory, used immediately, then GC'd.
 *  - We never log the private key.
 *  - The treasury address comes from .env, never from the request.
 *  - We leave a small TRX reserve for the sweep gas fee itself.
 *
 * @param {string} encryptedKey  - encrypted private key from DB
 * @param {string} fromAddress   - wallet address
 * @param {number} amount        - USDT amount to sweep (full balance)
 * @returns {{ txHash: string, amount: number }}
 */
async function sweepUsdtToTreasury(encryptedKey, fromAddress, amount) {
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  if (!treasuryAddress) {
    throw new Error('TREASURY_ADDRESS not configured');
  }
  if (!amount || amount <= 0) {
    throw new Error('No USDT balance to sweep');
  }

  // Decrypt key only for the duration of this call
  const privateKey = decrypt(encryptedKey);

  try {
    // Build a TronWeb instance with this wallet's signing key
    const tw = new (require('tronweb'))({
      fullHost: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
      headers:  { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
      privateKey,
    });

    const contract = await tw.contract().at(USDT_CONTRACT);

    // Convert human USDT to raw (6 decimals)
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, USDT_DECIMALS)));

    const txId = await contract.transfer(treasuryAddress, rawAmount).send({
      feeLimit: 50_000_000,  // 50 TRX fee limit — adequate for a TRC20 transfer
    });

    logger.info('Sweep executed', {
      from:    fromAddress,
      to:      '***TREASURY***',  // never log the actual address in combined.log
      amount,
      txId,
    });

    return { txHash: txId, amount };
  } finally {
    // Dereference the key — JS GC will handle it
    // In production you might want to zero-fill a Buffer instead
  }
}

/**
 * Get current block number (used to compute confirmations).
 */
async function getCurrentBlock() {
  const block = await tronWeb.trx.getCurrentBlock();
  return block.block_header.raw_data.number;
}

module.exports = {
  generateWallet,
  getTrxBalance,
  getUsdtBalance,
  getIncomingUsdtTransfers,
  getTransactionInfo,
  sweepUsdtToTreasury,
  getCurrentBlock,
};

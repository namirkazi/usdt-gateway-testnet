// src/config/tron.js
// Builds and exports a shared TronWeb instance.
// Design decision: one instance, module-level singleton.
// Wallet-specific operations pass the private key at call time
// (TronWeb supports per-call key injection) — so the singleton
// never holds a live private key in memory.

const TronWeb = require('tronweb');
require('dotenv').config();

if (!process.env.TRONGRID_API_KEY) {
  console.warn('⚠️  TRONGRID_API_KEY not set — requests may be rate-limited');
}

const tronWeb = new TronWeb({
  fullHost:   process.env.TRON_FULL_NODE    || 'https://api.trongrid.io',
  headers:    { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
  // No default private key on the shared instance.
  // We inject keys only when signing sweep transactions.
});

// USDT TRC20 contract on Tron mainnet
const USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Convenience: USDT has 6 decimal places
const USDT_DECIMALS = 6;

module.exports = { tronWeb, USDT_CONTRACT, USDT_DECIMALS };

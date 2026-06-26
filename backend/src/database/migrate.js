// src/database/migrate.js
// Run once: node src/database/migrate.js
// Creates all tables if they do not exist.
// Safe to re-run (uses CREATE TABLE IF NOT EXISTS).

require('dotenv').config();
const pool = require('../config/database');
const logger = require('../config/logger');

const migrations = [
  // ── admins ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS admins (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(64)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // ── wallets ──────────────────────────────────────────────
  // Design decision: we store one encrypted private key per wallet row.
  // The encryption key lives ONLY in .env (ENCRYPTION_KEY).
  // status: active | archived
  // Only one row may have status='active' at a time (enforced in service layer).
  `CREATE TABLE IF NOT EXISTS wallets (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    address         VARCHAR(64)  NOT NULL UNIQUE,
    encrypted_key   TEXT         NOT NULL COMMENT 'AES-256 encrypted private key',
    status          ENUM('active','archived') NOT NULL DEFAULT 'active',
    label           VARCHAR(128) NULL COMMENT 'optional human label',
    usdt_balance    DECIMAL(24,6) NOT NULL DEFAULT 0.000000,
    trx_balance     DECIMAL(24,6) NOT NULL DEFAULT 0.000000,
    last_checked_at DATETIME     NULL,
    last_deposit_at DATETIME     NULL,
    total_received  DECIMAL(24,6) NOT NULL DEFAULT 0.000000,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // ── transactions ─────────────────────────────────────────
  // status: pending | confirmed | swept | failed
  // sweep_tx_hash is populated after a successful sweep.
  `CREATE TABLE IF NOT EXISTS transactions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tx_hash         VARCHAR(128) NOT NULL UNIQUE COMMENT 'TRC20 transaction hash',
    wallet_id       INT UNSIGNED NOT NULL,
    wallet_address  VARCHAR(64)  NOT NULL,
    sender          VARCHAR(64)  NOT NULL,
    amount_usdt     DECIMAL(24,6) NOT NULL,
    confirmations   INT UNSIGNED NOT NULL DEFAULT 0,
    block_number    BIGINT UNSIGNED NULL,
    status          ENUM('pending','confirmed','swept','failed') NOT NULL DEFAULT 'pending',
    sweep_tx_hash   VARCHAR(128) NULL,
    swept_at        DATETIME     NULL,
    detected_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at    DATETIME     NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT,
    INDEX idx_wallet_id (wallet_id),
    INDEX idx_status    (status),
    INDEX idx_detected  (detected_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // ── settings ─────────────────────────────────────────────
  // Key-value store for runtime-configurable settings.
  // Avoids touching .env for things the admin might change.
  `CREATE TABLE IF NOT EXISTS settings (
    \`key\`       VARCHAR(64)   NOT NULL PRIMARY KEY,
    value       TEXT          NOT NULL,
    description VARCHAR(255)  NULL,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // Default settings
  `INSERT IGNORE INTO settings (\`key\`, value, description) VALUES
    ('min_confirmations', '20',    'Minimum block confirmations to mark a tx Confirmed'),
    ('poll_interval_ms',  '30000', 'Milliseconds between wallet polling cycles'),
    ('auto_sweep',        'false', 'Automatically sweep confirmed deposits (Phase 2)'),
    ('sweep_threshold',   '1',     'Minimum USDT balance before auto-sweep triggers');`,
];

(async () => {
  const conn = await pool.getConnection();
  try {
    for (const sql of migrations) {
      await conn.query(sql);
    }
    logger.info('✅ Migrations complete');
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
})();

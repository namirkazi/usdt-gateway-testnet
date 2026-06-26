// src/database/seed.js
// Creates the initial admin account.
// Run ONCE after migrate: node src/database/seed.js
// Credentials come from .env: ADMIN_USERNAME / ADMIN_PASSWORD

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../config/database');
const logger = require('../config/logger');

(async () => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    logger.error('ADMIN_PASSWORD not set in .env');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    const [result] = await pool.query(
      `INSERT INTO admins (username, password)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      [username, hash]
    );
    logger.info(`✅ Admin account seeded (username: ${username})`);
  } catch (err) {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  } finally {
    pool.end();
  }
})();

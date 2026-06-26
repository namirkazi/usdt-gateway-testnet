// src/utils/crypto.js
// AES-256 encryption / decryption for private keys at rest.
//
// Design decision: We use CryptoJS AES which defaults to CBC mode
// with a random 8-byte salt and PBKDF2-derived IV, giving us
// a different ciphertext every time even for the same plaintext.
// The ENCRYPTION_KEY in .env is the sole secret.
//
// In Phase 2 you could swap this for libsodium secretbox for
// authenticated encryption without changing the interface.

const CryptoJS = require('crypto-js');

const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return key;
};

/**
 * Encrypt a private key string.
 * @param {string} plaintext - hex private key
 * @returns {string} base64-encoded ciphertext
 */
function encrypt(plaintext) {
  return CryptoJS.AES.encrypt(plaintext, getKey()).toString();
}

/**
 * Decrypt a stored private key.
 * @param {string} ciphertext - previously encrypted value
 * @returns {string} original hex private key
 */
function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, getKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };

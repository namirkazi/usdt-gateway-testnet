// src/index.js
// Application entry point.
// Wires together Express, middleware, routes, and the background monitor.

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const fs      = require('fs');
const path    = require('path');

const logger   = require('./config/logger');
const routes   = require('./routes');
const { apiLimiter }   = require('./middleware/rateLimiter');
const { startMonitor } = require('./blockchain/monitor');

// ── Ensure log directory exists ───────────────────────────
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// ── App setup ─────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet());

// CORS — allow only the configured frontend origin
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: msg => logger.http(msg.trim()) },
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Global rate limiter
app.use('/api', apiLimiter);

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 4000;

app.listen(PORT, () => {
  logger.info(`🚀 Gateway API running on http://localhost:${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Treasury: ${process.env.TREASURY_ADDRESS ? '✅ configured' : '❌ NOT SET'}`);

  // Start background blockchain monitor
  startMonitor();
});

module.exports = app;

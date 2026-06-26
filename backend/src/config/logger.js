// src/config/logger.js
// Winston logger with console + rotating file transports.
// Structured JSON in production; pretty-printed in development.

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, printf } = format;

const devFormat = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true })),
  transports: [
    // Always write to files in production
    new transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: json(),
    }),
    new transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: json(),
    }),
  ],
});

// Pretty console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
  }));
}

module.exports = logger;

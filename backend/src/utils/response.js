// src/utils/response.js
// Standardized API response envelope.
// All routes use these helpers to maintain a consistent shape:
// { success, data?, error?, message? }

const success = (res, data = {}, statusCode = 200, message = 'OK') => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  const body = { success: false, error: message };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  return res.status(statusCode).json(body);
};

const paginated = (res, data, pagination) => {
  return res.status(200).json({ success: true, data, pagination });
};

module.exports = { success, error, paginated };

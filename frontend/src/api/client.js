// src/api/client.js
// Centralized Axios instance with automatic JWT injection and 401 handling.

import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('gateway_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gateway_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    client.post('/auth/login', { username, password }),
  me: () => client.get('/auth/me'),
};

// ── Wallets ───────────────────────────────────────────────
export const wallets = {
  generate:  (label) => client.post('/wallets/generate', { label }),
  list:      ()      => client.get('/wallets'),
  active:    ()      => client.get('/wallets/active'),
  stats:     ()      => client.get('/wallets/stats'),
  qr:        (id)    => client.get(`/wallets/${id}/qr`),
  sweep:     (id)    => client.post(`/wallets/${id}/sweep`),
};

// ── Transactions ──────────────────────────────────────────
export const transactions = {
  list: (params = {}) => client.get('/transactions', { params }),
  get:  (id)          => client.get(`/transactions/${id}`),
};

export default client;

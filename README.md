# USDT TRC20 Payment Gateway — Phase 1

A production-quality cryptocurrency payment gateway that accepts USDT on the Tron network (TRC20) via temporary deposit wallets. The treasury/Ownbit wallet address is **never exposed** to the public or to the frontend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│  LoginPage → Dashboard → WalletsPage → TransactionsPage         │
└──────────────────────────┬──────────────────────────────────────┘
                           │  JWT-authenticated REST API
┌──────────────────────────▼──────────────────────────────────────┐
│                     EXPRESS API (Node.js)                        │
│                                                                  │
│  /api/auth          → authController                            │
│  /api/wallets       → walletController                          │
│  /api/transactions  → transactionController                     │
│                                                                  │
│  Background Monitor (node-cron / setInterval)                   │
│    └── Polls TronGrid every 30s for incoming TRC20 transfers    │
└───────────┬──────────────────────────┬──────────────────────────┘
            │                          │
    ┌───────▼───────┐        ┌─────────▼──────────────┐
    │     MySQL     │        │   Tron Blockchain       │
    │  admins       │        │   (via TronGrid API)    │
    │  wallets      │        │                         │
    │  transactions │        │  Read: balances, events │
    │  settings     │        │  Write: sweep tx only   │
    └───────────────┘        └─────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **One active wallet at a time** | Prevents customer confusion; old wallets stay monitored for late deposits |
| **Private keys encrypted at rest** | AES-256 via `crypto-js`; decrypted in-memory only during sweep |
| **Treasury address in `.env` only** | Never sent to frontend; never logged in combined.log; never in DB |
| **Polling over webhooks** | Simpler to deploy; no static IP or public endpoint required; Phase 2 can swap to webhooks without changing persistence logic |
| **tx_hash UNIQUE constraint** | Database-level deduplication prevents double-processing of events |
| **DB transaction on sweep** | Prevents double-sweep via row-level lock (`FOR UPDATE`) |
| **JWT bearer tokens** | Stateless; easy to integrate in Phase 2 with multi-user roles |
| **Clean controller/service/blockchain layers** | Blockchain code has zero DB knowledge; easy to mock for tests |

---

## Project Structure

```
usdt-gateway/
├── backend/
│   ├── src/
│   │   ├── index.js                 # App entry point
│   │   ├── config/
│   │   │   ├── database.js          # MySQL pool
│   │   │   ├── tron.js              # TronWeb singleton
│   │   │   └── logger.js            # Winston logger
│   │   ├── database/
│   │   │   ├── migrate.js           # CREATE TABLE scripts
│   │   │   └── seed.js              # Admin account seeder
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verification
│   │   │   └── rateLimiter.js       # express-rate-limit
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── walletController.js
│   │   │   └── transactionController.js
│   │   ├── routes/
│   │   │   ├── index.js
│   │   │   ├── auth.js
│   │   │   ├── wallets.js
│   │   │   └── transactions.js
│   │   ├── blockchain/
│   │   │   ├── tronService.js       # Pure blockchain operations
│   │   │   └── monitor.js           # Background polling engine
│   │   └── utils/
│   │       ├── crypto.js            # AES encrypt/decrypt
│   │       └── response.js          # Standardized API envelope
│   ├── logs/                        # Auto-created
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   ├── api/
    │   │   └── client.js            # Axios + all API calls
    │   ├── contexts/
    │   │   └── AuthContext.jsx      # Global auth state
    │   ├── components/
    │   │   └── Layout.jsx           # Sidebar + shell
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── DashboardPage.jsx    # Main command center
    │       ├── WalletsPage.jsx
    │       └── TransactionsPage.jsx
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Prerequisites

- **Node.js** ≥ 18
- **MySQL** 8.x (or MariaDB 10.6+)
- **TronGrid API key** — free at https://www.trongrid.io/
- **A Tron wallet** for your treasury (Ownbit or any cold wallet)
- **TRX in each deposit wallet** — TRC20 transfers cost ~15 TRX in bandwidth/energy. You must keep a small TRX balance in each deposit wallet for the sweep to succeed. Fund each wallet with ~20–30 TRX after generating it.

---

## Setup

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values. Critical fields:

```env
# Generate JWT secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=...

# Generate encryption key (32+ chars):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=...

# Your Ownbit cold wallet — NEVER expose this publicly
TREASURY_ADDRESS=T...

# Free API key from trongrid.io
TRONGRID_API_KEY=...
```

### 3. Create Database

```sql
CREATE DATABASE usdt_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run Migrations & Seed

```bash
cd backend
node src/database/migrate.js
node src/database/seed.js
```

### 5. Start Development

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000** and log in with the credentials from your `.env`.

---

## Production Deployment

### Backend (PM2)

```bash
npm install -g pm2
cd backend
NODE_ENV=production pm2 start src/index.js --name usdt-gateway-api
pm2 save
pm2 startup
```

### Frontend (Nginx)

```bash
cd frontend
npm run build
# Copy dist/ to your web server root
```

Nginx config snippet:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    root /var/www/usdt-gateway/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except `/api/auth/login`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Verify token |

### Wallets
| Method | Path | Description |
|---|---|---|
| POST | `/api/wallets/generate` | Generate new deposit wallet |
| GET | `/api/wallets` | List all wallets |
| GET | `/api/wallets/active` | Get active wallet + live balances + QR |
| GET | `/api/wallets/stats` | Dashboard summary stats |
| GET | `/api/wallets/:id/qr` | QR code for any wallet |
| POST | `/api/wallets/:id/sweep` | Sweep USDT → treasury |

### Transactions
| Method | Path | Description |
|---|---|---|
| GET | `/api/transactions` | List (filter: status, wallet_id, limit, offset) |
| GET | `/api/transactions/:id` | Single transaction |

---

## Security Checklist

- [x] Private keys AES-256 encrypted at rest
- [x] Treasury address only in `.env`, never in API responses
- [x] JWT authentication on all endpoints
- [x] Rate limiting (10 login attempts / 15 min; 100 req/min general)
- [x] Helmet security headers
- [x] CORS restricted to configured frontend origin
- [x] DB-level tx_hash unique constraint prevents double processing
- [x] Row-level lock on sweep prevents concurrent double-sweeps
- [x] Input validation via express-validator
- [x] Winston structured logging (error + combined)
- [x] Private key never logged
- [x] Treasury address never logged in combined.log
- [ ] HTTPS (configure via reverse proxy — Nginx + Let's Encrypt)
- [ ] DB backups (schedule via cron)
- [ ] Secrets management (consider Vault or AWS Secrets Manager for production)

---

## Important: Fund Deposit Wallets with TRX

Every new deposit wallet needs TRX to pay for bandwidth/energy when sweeping. Without it, the sweep transaction will fail.

**Recommended**: Send 20–30 TRX to each newly generated wallet before sharing the address with customers.

---

## Phase 2 Roadmap

These features are architecturally prepared but not yet implemented:

- **Auto-sweep**: The `auto_sweep` setting in the `settings` table is already there; monitor.js just needs to call `sweepWallet` after confirmation threshold is met.
- **Webhooks**: Replace the polling loop in `monitor.js` with a TronGrid webhook handler — the `processTrc20Events()` and `updateConfirmations()` functions stay unchanged.
- **Multi-user**: `admins` table is ready; add a `role` column and user-scoped wallet assignment.
- **Notifications**: Add a `notify_url` to `settings`; call it after each new deposit.
- **Address rotation**: Expose a cron-based `generate` call in `monitor.js` to rotate the active wallet every N deposits or N hours.

---

## Testing on Shasta Testnet

Change `.env`:
```env
TRON_FULL_NODE=https://api.shasta.trongrid.io
USDT_CONTRACT_ADDRESS=TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs
```

Get free Shasta TRX at https://www.trongrid.io/shasta and test USDT from the Shasta faucet.

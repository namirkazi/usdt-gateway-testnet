# TRON USDT Payment Gateway (Nile Testnet)

> A full-stack cryptocurrency payment gateway built with **Node.js**, **Express**, **React**, and **MySQL** that accepts **TRC20 USDT** deposits on the **TRON Nile Testnet**. The project demonstrates secure wallet management, blockchain monitoring, transaction tracking, and treasury sweeping.

> **Disclaimer**
>
> This project is intended for educational purposes and blockchain development. It has **not** been security audited and should **not** be used to custody real funds without additional security review and production hardening.

---

# Features

* Generate unique TRON deposit wallets
* Monitor incoming TRC20 USDT deposits
* Automatic blockchain confirmation tracking
* Manual treasury sweeping
* AES-256 encrypted private key storage
* Live TRX and USDT balance monitoring
* Transaction history with confirmation status
* JWT authentication
* MySQL transaction persistence
* Background blockchain polling
* RESTful API
* React administration dashboard

---

# Architecture

```
                    Customer Wallet
                           │
                           ▼
                 Temporary Deposit Wallet
                           │
                           ▼
                Background Blockchain Monitor
                           │
                           ▼
                        MySQL Database
                           │
                           ▼
                 Treasury (Cold) Wallet
```

The gateway continuously monitors the TRON blockchain for incoming USDT deposits. Once a transaction reaches the required confirmation threshold, it can be swept securely into the treasury wallet while maintaining a complete transaction history.

---

# Technology Stack

### Backend

* Node.js
* Express.js
* MySQL
* TronWeb
* TronGrid API
* JWT Authentication
* Crypto-JS
* Winston Logger

### Frontend

* React
* Vite
* Axios
* Tailwind CSS

---

# Project Structure

```
usdt-gateway
│
├── backend
│   ├── src
│   │   ├── blockchain
│   │   ├── config
│   │   ├── controllers
│   │   ├── database
│   │   ├── middleware
│   │   ├── routes
│   │   └── utils
│   ├── logs
│   └── package.json
│
├── frontend
│   ├── src
│   ├── public
│   └── package.json
│
└── README.md
```

---

# How It Works

1. Generate a temporary deposit wallet.
2. Share the generated wallet address with the customer.
3. The customer sends TRC20 USDT.
4. The blockchain monitor detects the transaction.
5. Confirmations are tracked automatically.
6. After confirmation, funds can be swept to the treasury wallet.
7. The sweep transaction is recorded for auditing.

---

# Security

This project implements several security practices:

* AES-256 encrypted private keys
* JWT authentication
* Password hashing
* Database transaction locking
* Duplicate transaction protection using unique transaction hashes
* Treasury wallet never exposed to the frontend
* Structured application logging
* Environment variable configuration
* Rate limiting
* Helmet security headers
* CORS protection

---

# Getting Started

## Clone the Repository

```bash
git clone https://github.com/<your-username>/tron-usdt-payment-gateway.git

cd tron-usdt-payment-gateway
```

---

## Backend

```bash
cd backend

npm install
```

Create a `.env` file using `.env.example`.

Example:

```env
PORT=4000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=usdt_gateway

DB_USER=root
DB_PASSWORD=

JWT_SECRET=YOUR_SECRET

ENCRYPTION_KEY=YOUR_KEY

TRON_FULL_NODE=https://api.nileex.io

TRONGRID_API_KEY=

USDT_CONTRACT_ADDRESS=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf

TREASURY_ADDRESS=YOUR_TESTNET_WALLET
```

Run the database migration:

```bash
node src/database/migrate.js
```

Seed the administrator account:

```bash
node src/database/seed.js
```

Start the backend:

```bash
npm run dev
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

---

# Database

The application creates the following primary tables:

* admins
* wallets
* transactions
* settings

---

# Testing

This project is configured for the **TRON Nile Testnet**.

Requirements:

* Nile TRX
* Nile Test USDT
* TronLink configured for Nile Testnet

Typical testing flow:

```
Generate Wallet

↓

Fund Wallet with Test TRX

↓

Send Test USDT

↓

Wait for Confirmations

↓

Sweep to Treasury

↓

Verify Sweep Transaction
```

---

# Current Status

## Completed

* Wallet generation
* Deposit detection
* Confirmation tracking
* Manual treasury sweep
* Transaction history
* Live balance updates
* JWT authentication
* Background polling

## Planned

* Automatic wallet rotation
* Automatic treasury sweeping
* Webhook support
* Multi-user roles
* Docker deployment
* CI/CD pipeline
* Notification system
* Dashboard analytics

---

# API

### Authentication

```
POST /api/auth/login
GET  /api/auth/me
```

### Wallets

```
POST /api/wallets/generate

GET  /api/wallets

GET  /api/wallets/active

GET  /api/wallets/:id/qr

POST /api/wallets/:id/sweep
```

### Transactions

```
GET /api/transactions

GET /api/transactions/:id
```

---

# Future Improvements

* HD Wallet support
* Address rotation
* Multiple cryptocurrency support
* Automatic sweeping
* Email notifications
* Webhook integration
* Multi-signature treasury wallets
* Cold wallet management
* Audit dashboard
* Metrics and monitoring

---

# License

This project is released under the MIT License.

---

# Author

**Mohammed Namir Kazi**

Engineering Student • Full Stack Developer • Blockchain Developer

GitHub: https://github.com/namirkazi

LinkedIn: https://www.linkedin.com/in/mohammed-namir-kazi

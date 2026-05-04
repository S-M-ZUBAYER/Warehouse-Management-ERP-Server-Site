# Grozziie ERP — Warehouse & Order Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-6.x-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

**A production-ready, multi-tenant ERP backend for warehouse and order management.**  
Built with Node.js, Express, MySQL, Redis, and Sequelize ORM.

[API Documentation](#-api-documentation) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Modules](#-modules) • [Environment Setup](#-environment-variables)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Features](#-features)
- [Modules](#-modules)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Security](#-security)
- [Performance](#-performance)
- [Contributing](#-contributing)

---

## 🌐 Overview

Grozziie ERP is a **multi-tenant SaaS backend** designed for businesses managing warehouses, inventory, and e-commerce orders across multiple platforms (Shopee, Lazada, TikTok Shop, WooCommerce, Shopify, Amazon).

Each registered company gets a **fully isolated data environment**. Every table is scoped by `company_id`, ensuring zero data leakage between tenants. A single company owner (admin) can manage multiple warehouses, sub accounts with role-based permissions, platform store connections, products, SKUs, inventory, and orders — all from one unified API.

---

## 🛠 Tech Stack

| Layer            | Technology                    |
| ---------------- | ----------------------------- |
| Runtime          | Node.js 18+                   |
| Framework        | Express.js 4.x                |
| Database         | MySQL 8.0                     |
| ORM              | Sequelize 6.x                 |
| Cache / Session  | Redis 7.x                     |
| Authentication   | JWT (Access + Refresh tokens) |
| Password Hashing | bcryptjs                      |
| Validation       | express-validator             |
| File Uploads     | Multer                        |
| API Docs         | Swagger UI / OpenAPI 3.0      |
| Security         | Helmet, CORS, Rate Limiting   |
| Logging          | Morgan                        |
| Compression      | gzip via compression          |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Frontend)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                    Express.js Server                         │
│  helmet │ cors │ morgan │ compression │ rate-limiter         │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌──────▼───────┐
│  JWT Auth    │  │   API Routes   │  │  Swagger UI  │
│  Middleware  │  │   /api/v1/     │  │  /api-docs   │
└───────┬──────┘  └────────┬───────┘  └──────────────┘
        │                  │
        │         ┌────────▼───────────────────┐
        │         │      Module Layer           │
        │         │  auth │ users │ roles       │
        │         │  warehouses │ platforms     │
        │         │  products │ inventory       │
        │         │  orders │ dashboard         │
        │         └────────┬───────────────────┘
        │                  │
        ├──────────────────┤
        │                  │
┌───────▼──────┐  ┌────────▼───────┐
│    Redis     │  │  MySQL 8.0     │
│  Sessions    │  │  Sequelize ORM │
│  Cache       │  │  32 Tables     │
│  Rate Limit  │  │  Multi-tenant  │
└──────────────┘  └────────────────┘
```

### Multi-Tenancy Design

- Every table has `company_id` as the **first foreign key** after the primary key
- No query ever runs without `WHERE company_id = ?`
- Redis keys are namespaced: `company:{id}:cache:{resource}`
- Enterprise clients can have dedicated databases (configured via `dedicated_db_host`)

---

## ✨ Features

### ✅ Currently Implemented

- **Multi-tenant Registration** — Company + Owner role + Admin user created atomically in one transaction
- **JWT Authentication** — Access token (7d) + Refresh token (30d) with Redis session management
- **Token Blacklisting** — Logout invalidates tokens in Redis instantly
- **Sub Account Management** — Create, update, delete sub accounts with role and permission assignment
- **Role Management** — Custom roles with page-level and sub-page permission maps
- **Warehouse Management** — Multi-warehouse support with default warehouse, auto-generated codes
- **Rate Limiting** — General API limiter + strict auth limiter (10 attempts / 15 min)
- **Swagger UI** — Interactive API docs at `/api-docs`
- **Standardized Responses** — Every response follows `{ success, message, data, pagination }` format
- **Redis Caching** — List queries cached with pattern-based invalidation on mutations
- **Global Error Handler** — Sequelize, JWT, Multer errors all handled centrally

### 🚧 Coming Soon

- Platform Store Authorization (Shopee, Lazada, TikTok, Amazon)
- Product & Merchant SKU Catalog
- Combine SKU (Bundles)
- Platform SKU Mapping
- Inventory Management with stock alerts
- Inbound Orders
- Order Management (unified multi-platform)
- Manual Orders
- Dashboard KPIs & Analytics

---

## 📦 Modules

```
modules/
├── auth/          → Register, Login, Logout, Refresh Token, Get Profile
├── users/         → Sub Account CRUD with store & warehouse permissions
├── roles/         → Role CRUD with page-level permission management
└── warehouses/    → Warehouse CRUD with default warehouse management
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0
- Redis 7.x

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/grozziie-erp-server.git
cd grozziie-erp-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials and secrets
```

### 4. Create the database

```sql
CREATE DATABASE grozziie_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Run migrations (creates all tables)

```bash
node scripts/syncDb.js
```

### 6. Start the server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### 7. Open API docs

```
http://localhost:5000/api-docs
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# App
NODE_ENV=development
PORT=5000
APP_NAME=Grozziie ERP
APP_URL=http://localhost:5000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=grozziie_erp
DB_USER=root
DB_PASS=your_mysql_password

# JWT
JWT_SECRET=your_super_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=another_super_secret_for_refresh_tokens
JWT_REFRESH_EXPIRES_IN=30d

# Encryption (for platform tokens — must be exactly 32 characters)
ENCRYPTION_KEY=32_character_key_for_aes_256_here

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# File Upload
UPLOAD_MAX_SIZE=5242880
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

> ⚠️ **Never commit your `.env` file to Git.** Use `.env.example` as the template.

---

## 🗄 Database Setup

The project uses MySQL with Sequelize ORM. Tables are created via migration SQL files or the sync script.

### Option A — Sequelize Sync (recommended for development)

```bash
# Create missing tables only (safe)
node scripts/syncDb.js

# Add missing columns to existing tables
node scripts/syncDb.js --alter

# Drop and recreate all tables (WARNING: destroys all data)
node scripts/syncDb.js --force
```

### Option B — Raw SQL Migrations

Run in order:

```bash
mysql -u root -p grozziie_erp < migrations/001_create_auth_tables.sql
mysql -u root -p grozziie_erp < migrations/002_create_warehouses_table.sql
mysql -u root -p grozziie_erp < migrations/003_create_roles_table.sql
```

### Database Schema

32 tables across 8 domains:

| Domain           | Tables                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tenant & Auth    | `companies`, `users`, `roles`, `user_store_permissions`, `user_warehouse_permissions`                                   |
| Platform & Store | `platform_connections`, `platform_sync_logs`, `user_store_permissions`                                                  |
| Warehouse        | `warehouses`, `warehouse_zones`, `rack_locations`                                                                       |
| Product & SKU    | `categories`, `products`, `merchant_skus`, `combine_skus`, `combine_sku_items`                                          |
| SKU Mapping      | `platform_product_bindings`, `platform_product_sync_queue`                                                              |
| Inventory        | `inventory`, `inventory_movements`, `inbound_orders`, `inbound_order_items`                                             |
| Orders           | `orders`, `order_items`, `order_logs`, `outbound_orders`, `outbound_order_items`                                        |
| System & Audit   | `stock_alert_settings`, `notifications`, `audit_logs`, `background_jobs`, `subscription_plans`, `company_subscriptions` |

---

## 📖 API Documentation

Interactive Swagger UI is available at:

```
http://localhost:5000/api-docs
```

All endpoints require a Bearer JWT token except:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`

To authenticate in Swagger:

1. Call `POST /auth/login` to get your `accessToken`
2. Click **Authorize** button (top right)
3. Enter: `Bearer YOUR_ACCESS_TOKEN`

---

## 📁 Project Structure

```
grozziie-erp-server/
│
├── config/
│   ├── database.js          ← MySQL + Sequelize connection
│   ├── redis.js             ← Redis client with safe wrappers
│   ├── swagger.js           ← OpenAPI 3.0 spec (inline paths)
│   └── rateLimiter.js       ← General + auth rate limiters
│
├── middlewares/
│   ├── auth.js              ← JWT verify + Redis session check
│   ├── errorHandler.js      ← Global error handler
│   ├── notFound.js          ← 404 handler
│   └── validate.js          ← express-validator wrapper
│
├── models/
│   ├── index.js             ← Sequelize init + all associations
│   ├── Company.js
│   ├── User.js
│   ├── Role.js
│   ├── Warehouse.js
│   ├── UserStorePermission.js
│   └── UserWarehousePermission.js
│
├── modules/
│   ├── auth/
│   │   ├── auth.routes.js
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   └── auth.validator.js
│   ├── users/
│   │   └── users.routes.js
│   ├── roles/
│   │   ├── roles.routes.js
│   │   ├── roles.controller.js
│   │   ├── roles.service.js
│   │   └── roles.validator.js
│   └── warehouses/
│       ├── warehouses.routes.js
│       ├── warehouses.controller.js
│       ├── warehouses.service.js
│       └── warehouses.validator.js
│
├── routes/
│   └── index.js             ← Master router
│
├── utils/
│   ├── response.js          ← sendSuccess / sendError helpers
│   ├── encryption.js        ← AES-256 encrypt/decrypt
│   ├── pagination.js        ← Reusable pagination helper
│   ├── auditLogger.js       ← Audit log writer
│   └── generateNo.js        ← Auto-generate order/inbound numbers
│
├── migrations/
│   ├── 001_create_auth_tables.sql
│   ├── 002_create_warehouses_table.sql
│   └── 003_create_roles_table.sql
│
├── scripts/
│   └── syncDb.js            ← Sequelize sync utility
│
├── uploads/                 ← Uploaded files (gitignored)
├── .env                     ← Environment variables (gitignored)
├── .env.example             ← Template with empty values
├── .gitignore
├── index.js                 ← App entry point
└── package.json
```

---

## 🔌 API Endpoints

### Auth

| Method | Endpoint                     | Auth | Description                      |
| ------ | ---------------------------- | ---- | -------------------------------- |
| `POST` | `/api/v1/auth/register`      | ❌   | Register company + admin account |
| `POST` | `/api/v1/auth/login`         | ❌   | Login (admin or sub account)     |
| `POST` | `/api/v1/auth/logout`        | ✅   | Logout + blacklist token         |
| `POST` | `/api/v1/auth/refresh-token` | ❌   | Get new access token             |
| `GET`  | `/api/v1/auth/me`            | ✅   | Get current user profile         |

### Users (Sub Accounts)

| Method   | Endpoint            | Role        | Description                   |
| -------- | ------------------- | ----------- | ----------------------------- |
| `GET`    | `/api/v1/users`     | All         | List sub accounts (paginated) |
| `POST`   | `/api/v1/users`     | owner/admin | Create sub account            |
| `GET`    | `/api/v1/users/:id` | All         | Get sub account details       |
| `PUT`    | `/api/v1/users/:id` | owner/admin | Update sub account            |
| `DELETE` | `/api/v1/users/:id` | owner/admin | Delete sub account            |

### Roles

| Method   | Endpoint                             | Role        | Description                     |
| -------- | ------------------------------------ | ----------- | ------------------------------- |
| `GET`    | `/api/v1/roles/permissions/template` | All         | Get permission structure for UI |
| `GET`    | `/api/v1/roles`                      | All         | List roles with user count      |
| `POST`   | `/api/v1/roles`                      | owner/admin | Create role                     |
| `GET`    | `/api/v1/roles/:id`                  | All         | Get role details                |
| `PUT`    | `/api/v1/roles/:id`                  | owner/admin | Update role                     |
| `PATCH`  | `/api/v1/roles/:id/permissions`      | owner/admin | Update permissions only         |
| `DELETE` | `/api/v1/roles/:id`                  | owner/admin | Delete role                     |

### Warehouses

| Method   | Endpoint                             | Role        | Description              |
| -------- | ------------------------------------ | ----------- | ------------------------ |
| `GET`    | `/api/v1/warehouses`                 | All         | List warehouses          |
| `POST`   | `/api/v1/warehouses`                 | owner/admin | Create warehouse         |
| `GET`    | `/api/v1/warehouses/:id`             | All         | Get warehouse details    |
| `PUT`    | `/api/v1/warehouses/:id`             | owner/admin | Update warehouse         |
| `DELETE` | `/api/v1/warehouses/:id`             | owner/admin | Delete warehouse         |
| `PATCH`  | `/api/v1/warehouses/:id/set-default` | owner/admin | Set as default warehouse |

### Standard Response Format

```json
// Success
{
  "success": true,
  "message": "Warehouses fetched successfully",
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Error
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Warehouse name is required" }
  ]
}
```

---

## 🔐 Security

| Feature            | Implementation                              |
| ------------------ | ------------------------------------------- |
| Password hashing   | bcryptjs with salt rounds 12                |
| JWT tokens         | HS256 signed, 7d access / 30d refresh       |
| Token blacklisting | Redis-based on logout                       |
| Session validation | Every request checks Redis session          |
| Rate limiting      | 100 req/15min general, 10 req/15min on auth |
| Security headers   | Helmet.js (CSP, HSTS, XSS protection)       |
| CORS               | Whitelist-based origin control              |
| Input validation   | express-validator on all POST/PUT endpoints |
| SQL injection      | Sequelize ORM parameterized queries         |
| Sensitive data     | AES-256-GCM encryption for platform tokens  |
| Multi-tenancy      | company_id scope on every query             |

---

## ⚡ Performance

| Feature                | Implementation                                     |
| ---------------------- | -------------------------------------------------- |
| Redis caching          | List queries cached 2 min, invalidated on mutation |
| Cache namespacing      | `company:{id}:cache:{resource}:p{page}:l{limit}`   |
| Connection pooling     | MySQL pool: max 10, idle 10s                       |
| Response compression   | gzip via compression middleware                    |
| Indexes                | Composite indexes on all common query patterns     |
| BIGINT for high-volume | orders, inventory_movements, audit_logs            |
| Soft deletes           | products, orders (deleted_at column)               |

---

## 🧪 Scripts

```bash
npm run dev          # Start with nodemon (auto-restart)
npm start            # Production start
node scripts/syncDb.js           # Create missing tables
node scripts/syncDb.js --alter   # Add missing columns
node scripts/syncDb.js --force   # Recreate all tables (dev only)
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/platform-authorization`
3. Commit changes: `git commit -m "feat: add platform authorization module"`
4. Push to branch: `git push origin feature/platform-authorization`
5. Open a Pull Request

### Commit Convention

```
feat:     New feature
fix:      Bug fix
docs:     Documentation update
refactor: Code refactoring
perf:     Performance improvement
chore:    Build/config changes
```

---

## 👨‍💻 Author

**S M Zubayer** — Full Stack Developer  
📧 smzubayer9004@gmail.com

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
  <sub>Built with ❤️ for scalable multi-tenant ERP</sub>
</div>

# WMS Backend — Node.js Complete Reference (Inventory Management part)

## File Structure

```
project/
├── migrations/
│   ├── 006_create_merchant_skus.sql          ← product catalogue
│   ├── 007_create_combine_skus.sql           ← bundle SKUs + computed_quantity
│   ├── 008_create_combine_sku_items.sql      ← bundle composition (child SKUs + ratios)
│   ├── 009_create_sku_warehouse_stock.sql    ← real-time stock per SKU per warehouse
│   ├── 010_create_stock_ledger_entries.sql   ← immutable audit log (append-only)
│   ├── 011_create_inbound_orders.sql         ← inbound shipment lifecycle
│   ├── 012_create_inbound_order_lines.sql    ← per-SKU lines within an inbound
│   ├── 013_create_platform_stores.sql        ← Shopee/TikTok/Lazada store connections
│   ├── 014_create_platform_sku_mappings.sql  ← bridge: internal SKU ↔ platform listing
│   └── 015_create_order_sale_lines.sql       ← sale events + idempotency guard
│
├── models/
│   ├── MerchantSku.js          ← REPLACE with MerchantSku_updated.js (adds stock associations)
│   ├── CombineSku.js           ← REPLACE with CombineSku_updated.js  (adds computed_quantity)
│   ├── CombineSkuItem.js       ← unchanged from your original
│   ├── SkuWarehouseStock.js    ← NEW
│   ├── StockLedgerEntry.js     ← NEW
│   ├── InboundOrder.js         ← NEW
│   ├── InboundOrderLine.js     ← NEW
│   ├── PlatformStore.js        ← NEW
│   ├── PlatformSkuMapping.js   ← NEW
│   └── OrderSaleLine.js        ← NEW
│
├── modules/
│   ├── merchant-skus/
│   │   ├── merchantSkus.controller.js    ← unchanged
│   │   ├── merchantSkus.routes.js        ← unchanged
│   │   ├── merchantSkus.service.js       ← REPLACE with merchantSkus_service_updated.js
│   │   └── merchantSkus.validator.js     ← unchanged
│   │
│   ├── combine-skus/
│   │   ├── combineskus.controller.js     ← unchanged
│   │   ├── combineskus.routes.js         ← unchanged
│   │   ├── combineskus.service.js        ← REPLACE with combineskus_service_updated.js
│   │   └── combineskus.validator.js      ← unchanged
│   │
│   ├── inbound/                          ← NEW module
│   │   ├── inbound.controller.js
│   │   ├── inbound.routes.js
│   │   ├── inbound.service.js
│   │   └── inbound.validator.js
│   │
│   ├── stock/                            ← NEW module
│   │   ├── stock.controller.js
│   │   ├── stock.routes.js
│   │   └── stock.service.js
│   │
│   ├── platform-stores/                  ← NEW module
│   │   ├── platformStores.controller.js
│   │   ├── platformStores.routes.js
│   │   └── platformStores.service.js
│   │
│   ├── platform-sku-mappings/            ← NEW module
│   │   ├── platformSkuMappings.controller.js
│   │   ├── platformSkuMappings.routes.js
│   │   └── platformSkuMappings.service.js
│   │
│   └── swagger/
│       ├── merchant-skus_paths.js        ← your original
│       ├── combine-skus_paths.js         ← your original
│       ├── inbound_paths.js              ← NEW
│       └── stock_platform_paths.js       ← NEW (stock + platformStores + platformSkuMappings)
│
├── workers/
│   └── combinedSkuRecomputeWorker.js     ← NEW background process
│
└── routes/
    └── index.js                          ← NEW central router (routes_index.js)
```

---

## Migration Order

Run in this exact sequence (tables reference each other via FK):

```bash
mysql -u root -p your_db < migrations/006_create_merchant_skus.sql
mysql -u root -p your_db < migrations/007_create_combine_skus.sql
mysql -u root -p your_db < migrations/008_create_combine_sku_items.sql
mysql -u root -p your_db < migrations/009_create_sku_warehouse_stock.sql
mysql -u root -p your_db < migrations/010_create_stock_ledger_entries.sql
mysql -u root -p your_db < migrations/011_create_inbound_orders.sql
mysql -u root -p your_db < migrations/012_create_inbound_order_lines.sql
mysql -u root -p your_db < migrations/013_create_platform_stores.sql
mysql -u root -p your_db < migrations/014_create_platform_sku_mappings.sql
mysql -u root -p your_db < migrations/015_create_order_sale_lines.sql
```

---

## Wire up routes in app.js

```js
// app.js
app.use("/api/v1", require("./routes/index"));
```

---

## Start the recompute worker

Run as a **separate process** alongside your Express server:

```bash
node workers/combinedSkuRecomputeWorker.js
```

With PM2:

```js
// ecosystem.config.js
module.exports = {
  apps: [
    { name: "wms-api", script: "app.js" },
    { name: "sku-worker", script: "workers/combinedSkuRecomputeWorker.js" },
  ],
};
```

---

## Complete API Reference

### Merchant SKUs

| Method | Endpoint                        | Role                |
| ------ | ------------------------------- | ------------------- |
| GET    | /api/v1/merchant-skus/dropdowns | all                 |
| GET    | /api/v1/merchant-skus           | all                 |
| GET    | /api/v1/merchant-skus/:id       | all                 |
| POST   | /api/v1/merchant-skus           | owner/admin/manager |
| PUT    | /api/v1/merchant-skus/:id       | owner/admin/manager |
| DELETE | /api/v1/merchant-skus/:id       | owner/admin/manager |
| DELETE | /api/v1/merchant-skus/bulk      | owner/admin/manager |

### Combine SKUs

| Method | Endpoint                    | Role                |
| ------ | --------------------------- | ------------------- |
| GET    | /api/v1/combine-skus/picker | all                 |
| GET    | /api/v1/combine-skus        | all                 |
| GET    | /api/v1/combine-skus/:id    | all                 |
| POST   | /api/v1/combine-skus        | owner/admin/manager |
| PUT    | /api/v1/combine-skus/:id    | owner/admin/manager |
| DELETE | /api/v1/combine-skus/:id    | owner/admin/manager |

### Inbound

| Method | Endpoint                    | Description                                 |
| ------ | --------------------------- | ------------------------------------------- |
| GET    | /api/v1/inbound/dropdowns   | warehouses + currencies                     |
| GET    | /api/v1/inbound/picker      | SKU search for adding lines                 |
| GET    | /api/v1/inbound             | list with filters                           |
| GET    | /api/v1/inbound/:id         | single detail                               |
| POST   | /api/v1/inbound             | create draft                                |
| PUT    | /api/v1/inbound/:id         | update draft fields/lines                   |
| PUT    | /api/v1/inbound/:id/ship    | draft → on_the_way, increments qty_inbound  |
| PUT    | /api/v1/inbound/:id/receive | on_the_way → completed, atomic stock update |
| PUT    | /api/v1/inbound/:id/cancel  | cancel + reverse qty_inbound                |

### Stock

| Method | Endpoint                              | Description                                  |
| ------ | ------------------------------------- | -------------------------------------------- |
| GET    | /api/v1/stock/merchant/:merchantSkuId | stock by SKU (all warehouses)                |
| GET    | /api/v1/stock/combine/:combineSkuId   | combine SKU with child stock                 |
| POST   | /api/v1/stock/bulk                    | bulk stock query (Java startup sync)         |
| POST   | /api/v1/stock/adjust                  | manual adjustment (admin only)               |
| POST   | /api/v1/stock/deduct                  | **Java-facing deduction after sale webhook** |
| GET    | /api/v1/stock/ledger                  | audit log (paginated)                        |

### Platform Stores

| Method | Endpoint                           | Description                                 |
| ------ | ---------------------------------- | ------------------------------------------- |
| GET    | /api/v1/platform-stores            | list connected stores                       |
| GET    | /api/v1/platform-stores/:id        | single store                                |
| POST   | /api/v1/platform-stores            | connect new store                           |
| PUT    | /api/v1/platform-stores/:id        | update settings                             |
| PUT    | /api/v1/platform-stores/:id/tokens | **Java: update OAuth tokens after refresh** |
| DELETE | /api/v1/platform-stores/:id        | disconnect                                  |

### Platform SKU Mappings

| Method | Endpoint                                        | Description                               |
| ------ | ----------------------------------------------- | ----------------------------------------- |
| GET    | /api/v1/platform-sku-mappings/pending-sync      | **Java polls for products to push**       |
| GET    | /api/v1/platform-sku-mappings                   | list all mappings                         |
| GET    | /api/v1/platform-sku-mappings/:id               | single mapping                            |
| POST   | /api/v1/platform-sku-mappings                   | create mapping                            |
| PUT    | /api/v1/platform-sku-mappings/:id               | update warehouse / active flag            |
| PUT    | /api/v1/platform-sku-mappings/:id/sync-callback | **Java writes back platform listing IDs** |
| DELETE | /api/v1/platform-sku-mappings/:id               | remove mapping                            |

---

## Java Integration Contract

The Java Spring Boot team needs exactly these 5 endpoints. Give them this reference:

### 1. Product push — what to push and where to find it

```
GET /api/v1/platform-sku-mappings/pending-sync?platform=shopee
```

Returns up to 100 mappings with `sync_status` of `pending`, `out_of_sync`, or `failed`.
Each record includes the full merchant SKU or combine SKU payload (name, title, price, weight, dimensions, image).

After successfully pushing to the platform, Java calls:

```
PUT /api/v1/platform-sku-mappings/:id/sync-callback
Body: { success: true, platformSkuId: "...", platformListingId: "...", platformModelId: "..." }
```

On failure:

```
Body: { success: false, errorMessage: "Rate limit exceeded" }
```

### 2. Stock query before sync

```
POST /api/v1/stock/bulk
Body: { merchantSkuIds: [1,2,3], combineSkuIds: [1] }
```

Returns a map of SKU ID → `{ qty_on_hand, qty_reserved, qty_inbound, qty_available }`.
Java uses `qty_available` as the number to push to the platform listing.

### 3. Stock deduction after sale webhook

```
POST /api/v1/stock/deduct
Body: {
  platformMappingId: 5,
  platformOrderId: "SHOPEE-ORD-12345",
  platformOrderItemId: "SHOPEE-ITEM-001",   ← optional, for item-level idempotency
  quantitySold: 2
}
```

**Idempotent** — safe to retry. Returns `alreadyDeducted: true` if already processed.
For combine SKUs, automatically deducts each child SKU proportionally (quantity × ratio).

Response includes updated stock numbers:

```json
{
  "alreadyDeducted": false,
  "deductions": [
    { "merchantSkuId": 3, "newQtyOnHand": 148 },
    { "merchantSkuId": 7, "newQtyOnHand": 96 }
  ],
  "combineSkuId": 2
}
```

Java uses `newQtyOnHand - qty_reserved` to push the updated available qty back to the platform listing.

### 4. OAuth token storage

```
PUT /api/v1/platform-stores/:id/tokens
Body: { accessToken: "...", refreshToken: "...", tokenExpiresAt: "2024-03-01T00:00:00Z" }
```

Node.js stores tokens. Java reads them from `GET /api/v1/platform-stores` when making platform API calls.

### 5. Mark out of sync (optional but recommended)

When Java detects stock drift or a product update on the Node.js side, call `sync-callback`
with `success: false` to trigger `sync_status: out_of_sync` — Node.js will include it
in the next `pending-sync` response for re-push.

---

## Key Business Rules

### Combined SKU quantity formula

```sql
computed_quantity = MIN( FLOOR(qty_on_hand / item.quantity) )
-- across all child SKUs in combine_sku_items
-- e.g. SKU-A has 100 units, ratio=2; SKU-B has 60 units, ratio=1
--   → MIN(FLOOR(100/2), FLOOR(60/1)) = MIN(50, 60) = 50
```

This runs:

- After every inbound receipt (via Redis worker)
- After every stock deduction (via Redis worker)
- After every manual adjustment (via Redis worker)
- Inline after create/update of a combine SKU

### Stock deduction for combine SKUs

When 1 unit of a combine SKU is sold:

- Each child SKU is deducted by `quantity_sold × item.quantity`
- All deductions happen in a single MySQL transaction
- The combine SKU's `computed_quantity` is recomputed after commit

### Inbound lifecycle

```
draft  →  [ship]  →  on_the_way  →  [receive]  →  completed
  ↓                      ↓
[cancel]              [cancel] (reverses qty_inbound)
```

- At `ship`: `qty_inbound += qty_expected` for each line
- At `receive`: `qty_on_hand += qty_received`, `qty_inbound -= qty_expected`
- Partial receipt is allowed (qty_received < qty_expected → `has_discrepancy = true`)
- Both ops are fully atomic MySQL transactions

### Delete guards

- Cannot delete a merchant SKU if it is part of any combine SKU
- Cannot delete a merchant SKU if `qty_on_hand > 0`
- Cannot delete a platform store if it has active SKU mappings

---

## Redis Queue Keys

| Key                                          | Purpose                                           |
| -------------------------------------------- | ------------------------------------------------- |
| `queue:combine_sku_recompute`                | Jobs for background combine SKU qty recomputation |
| `company:{id}:cache:merchant_skus:*`         | Merchant SKU list cache (60s TTL pattern)         |
| `company:{id}:cache:combine_skus:*`          | Combine SKU list cache                            |
| `company:{id}:cache:platform_stores:*`       | Platform store cache                              |
| `company:{id}:cache:platform_sku_mappings:*` | Mapping cache                                     |

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

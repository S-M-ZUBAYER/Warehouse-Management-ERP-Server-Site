# Grozziie ERP Backend

Multi-tenant warehouse, inventory, SKU, order, and platform integration backend built with Node.js, Express, MySQL, Redis, Sequelize, JWT authentication, and Swagger/OpenAPI documentation.

This repository is intended for backend API work only. Do not commit real API credentials, database passwords, OAuth tokens, webhook keys, or `.env` files.

## Current Status

The project has grown beyond the original warehouse setup. It now includes:

- Company registration, login, JWT sessions, refresh tokens, and logout
- Role, page, sub-account, store permission, and warehouse permission management
- Warehouse management with default warehouse support
- Merchant SKU catalog and Combine SKU bundle management
- Inventory and stock tracking by warehouse
- Inbound and outbound stock flows
- Stock ledger and stock adjustment support
- Platform store authorization records
- Platform product and SKU mapping workflows
- SKU sync groups for linked merchant SKUs
- Shopee/TikTok style platform order deduction endpoints
- Manual orders and platform manual orders
- Pack failed, push successful, and withdraw order tracking
- EasyParcel manual order shipment integration support
- Swagger API documentation at `/api-docs`

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL |
| ORM | Sequelize |
| Cache / queue support | Redis |
| Auth | JWT, bcryptjs |
| Validation | express-validator |
| API docs | Swagger UI / OpenAPI |
| Security middleware | Helmet, CORS, rate limiting |
| Uploads | Multer / static upload serving |

## Main Modules

| Module | Purpose |
| --- | --- |
| `auth` | Register, login, logout, profile, refresh token |
| `users` | Sub-account management |
| `roles` | Role and permission management |
| `Pages` | Page/menu permission source |
| `warehouses` | Warehouse setup and default warehouse handling |
| `merchantSkus` | Merchant SKU CRUD, image handling, stock relationship |
| `combineskus` | Bundle/combined SKU management |
| `inventory` | Inventory list and platform mapping inventory views |
| `stock` | Stock query, adjustment, ledger, sale deduction helpers |
| `inbound` | Inbound draft, ship, receive, cancel flow |
| `outbound` | Outbound draft and stock flow |
| `platformStores` | Platform store records and token metadata |
| `platformProducts` | Platform product import/sync helpers |
| `platformSkuMappings` | Internal SKU to platform listing mapping |
| `skuMapping` | SKU mapping workflow APIs |
| `skuSyncGroup` | Linked merchant SKU groups |
| `platformOrderDeductions` | Marketplace order notification stock deduction |
| `manualOrders` | Manual order creation, shipment, status, stock deduction |
| `platformManualOrders` | Platform-style manual order upload and fulfillment |
| `packFailedOrders` | Failed pack order tracking |
| `pushSuccessfulOrders` | Successful push/order tracking |
| `withdrawOrders` | Withdraw order tracking |
| `dashboard` | Dashboard data endpoints |

## Important Business Rules

- Data is scoped by `company_id` for multi-tenant isolation.
- Most protected endpoints require a Bearer JWT token.
- Page access is enforced through role/page permission checks.
- Merchant SKU names are normalized to uppercase.
- Merchant SKU delete is now permanent only when safe:
  - blocked if used in Combine SKU
  - blocked if stock on hand is greater than zero
  - blocked if order/history tables still reference the SKU
- Combine SKU available quantity is calculated from child SKU stock and quantity ratios.
- Stock updates are transaction-based for inbound, outbound, manual order, and platform deduction flows.
- Platform/webhook callbacks should use server-side secrets only.

## API Entry Points

Base API path:

```text
/api/v1
```

Common public paths:

```text
GET  /health
GET  /api-docs
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
```

Common protected route groups:

```text
/api/v1/users
/api/v1/roles
/api/v1/pages
/api/v1/warehouses
/api/v1/merchant-skus
/api/v1/combine-skus
/api/v1/inventory
/api/v1/stock
/api/v1/inbound
/api/v1/outbound
/api/v1/order-management
/api/v1/platform-stores
/api/v1/platform-products
/api/v1/platform-sku-mappings
/api/v1/sku-mapping
/api/v1/sku-sync-groups
/api/v1/platform-manual-orders
/api/v1/platform-order-deductions
```

Use Swagger at `/api-docs` for the detailed request/response shapes.

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Review `.env` carefully and replace every secret with your own private value.

Start the server:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Database sync helper:

```bash
npm run db:sync
```

The server defaults to port `5000` unless `PORT` is set.

## Environment Variables

Use placeholders only in committed files. Never commit real values.

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
APP_NAME=Grozziie ERP
APP_URL=http://localhost:5000

DB_HOST=*****
DB_PORT=3306
DB_NAME=*****
DB_USER=*****
DB_PASS=*****

JWT_SECRET=*****
JWT_REFRESH_SECRET=*****
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

REDIS_HOST=*****
REDIS_PORT=6379
REDIS_PASSWORD=*****
REDIS_DB=0

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
UPLOAD_PATH=./uploads

EASYPARCEL_MODE=sandbox
EASYPARCEL_API_BASE_URL=*****
EASYPARCEL_MY_CLIENT_ID=*****
EASYPARCEL_MY_CLIENT_SECRET=*****
EASYPARCEL_MY_ACCESS_TOKEN=*****
EASYPARCEL_MY_REFRESH_TOKEN=*****
EASYPARCEL_SG_CLIENT_ID=*****
EASYPARCEL_SG_CLIENT_SECRET=*****
EASYPARCEL_SG_ACCESS_TOKEN=*****
EASYPARCEL_SG_REFRESH_TOKEN=*****

SHOPEE_ORDER_WEBHOOK_API_KEY=*****
TIKTOK_ORDER_WEBHOOK_API_KEY=*****
```

Important: if `.env.example` is committed publicly, keep it as a template only. Do not place live credentials, tokens, client secrets, or private URLs there.

## Database

The project uses Sequelize models and SQL migration files under `migrations/`.

Migration files currently cover:

- Auth, companies, users, roles, pages, and permissions
- Warehouses
- Merchant SKUs, Combine SKUs, stock, and stock ledger
- Inbound and outbound orders
- Platform stores, platform products, SKU mappings, and order sale lines
- SKU sync groups
- Manual orders and platform manual orders
- Order status/support tables
- EasyParcel/manual-order logistics fields

For local development, use:

```bash
npm run db:sync
```

For production or shared environments, review and run SQL migrations carefully in order. Back up the database before schema changes.

## Project Structure

```text
config/        Database, Redis, rate limiting, Swagger config
middlewares/   Auth and request middleware
migrations/    SQL schema changes
models/        Sequelize models and associations
modules/       Feature modules with routes/controllers/services
routes/        API route registration
scripts/       Database helper scripts
uploads/       Runtime uploaded files
utils/         Shared response, permission, crypto, and helper utilities
workers/       Background stock/Combine SKU worker
```

## Security Notes

- Keep `.env` out of Git.
- Rotate any credential that was ever pushed to a public repository.
- Store platform tokens and webhook keys only on the backend.
- Use strong JWT secrets in production.
- Restrict CORS origins to trusted frontend domains.
- Do not expose database host, username, password, API keys, OAuth client secrets, or access/refresh tokens in README, screenshots, frontend code, or issue comments.

## Useful Commands

```bash
npm install
npm start
npm run dev
npm run db:sync
node workers/combinedSkuRecomputeWorker.js
```

## API Response Format

Most endpoints follow a consistent shape:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

Error responses use:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## Notes For GitHub Push

Before pushing publicly:

- Check that `.env` is ignored.
- Review `.env.example` and replace any real credentials with `*****`.
- Do not include access tokens, refresh tokens, API keys, webhook keys, database passwords, or private server URLs.
- Confirm uploaded customer/order files are not committed.
- Confirm Swagger examples do not contain real shop IDs, order IDs, tokens, or customer data.

## License

ISC

# Changelog

All notable changes to Grozziie ERP will be documented here.

---

## [1.0.0] — 2025 (Initial Release)

### Added

- Multi-tenant architecture — every table scoped by `company_id`
- Company registration with owner role auto-creation (atomic transaction)
- JWT authentication — access token (7d) + refresh token (30d)
- Redis session management + token blacklisting on logout
- Sub account management with store and warehouse permissions
- Role management with page-level and sub-page permission maps
- Warehouse management with auto-generated codes and default warehouse
- Rate limiting — 100 req/15min general, 10 req/15min on auth routes
- Swagger UI at `/api-docs` with full OpenAPI 3.0 spec
- Standardized API response format `{ success, message, data, pagination }`
- Redis caching on list queries with pattern-based invalidation
- Global error handler for Sequelize, JWT, Multer errors
- SQL migrations for auth tables, warehouses, and roles
- Sequelize sync script with safe/alter/force modes

### Security

- bcryptjs password hashing (salt rounds 12)
- Helmet.js security headers
- CORS whitelist-based origin control
- express-validator input sanitization
- AES-256-GCM encryption ready for platform tokens

---

## Upcoming

### [1.1.0] — Platform & Store Authorization

- Platform connections (Shopee, Lazada, TikTok, Amazon, WooCommerce, Shopify)
- OAuth token management with AES-256 encryption
- Store sync logs

### [1.2.0] — Product & SKU Catalog

- Product catalog with categories
- Merchant SKU management
- Combine SKU (bundle products)
- Platform SKU mapping

### [1.3.0] — Inventory Management

- Stock levels per warehouse
- Inventory movements (immutable audit trail)
- Inbound orders (Draft → On The Way → Completed)
- Stock alerts

### [1.4.0] — Order Management

- Unified orders from all platforms
- Order status workflow
- Manual orders
- Outbound orders

### [1.5.0] — Dashboard & Analytics

- KPI cards
- Inventory charts
- Order status summary
- Sales trend

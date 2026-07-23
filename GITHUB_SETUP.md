# GitHub Setup Guide

## Repository Description (copy this into GitHub)

```
🏭 Multi-tenant Warehouse & Order Management ERP backend. Built with Node.js, Express, MySQL, Redis & Sequelize. Features JWT auth, role-based access control, multi-warehouse management, and platform integrations for Shopee, Lazada, TikTok Shop & more.
```

## Repository Topics (add these tags on GitHub)

```
nodejs expressjs mysql redis sequelize jwt multi-tenant erp warehouse-management
order-management inventory-management rest-api swagger saas backend
```

---

## Step-by-Step: Push to GitHub

### 1. Initialize Git in your project

```bash
cd warehouse_erp_management_system_server_site
git init
```

### 2. Add all files

```bash
git add .
```

### 3. First commit

```bash
git commit -m "feat: initial release — auth, users, roles, warehouses modules

- Multi-tenant architecture with company_id scoping
- JWT auth with Redis session management and token blacklisting
- Sub account management with store and warehouse permissions
- Role management with page-level permission maps
- Warehouse management with default warehouse support
- Rate limiting, Helmet, CORS, Swagger UI
- MySQL + Sequelize ORM with full index strategy
- Redis caching with pattern-based invalidation"
```

### 4. Create repository on GitHub

Go to https://github.com/new and fill in:

| Field               | Value                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Repository name** | `grozziie-erp-server`                                                                                                                                                                                                                                        |
| **Description**     | 🏭 Multi-tenant Warehouse & Order Management ERP backend. Built with Node.js, Express, MySQL, Redis & Sequelize. Features JWT auth, role-based access control, multi-warehouse management, and platform integrations for Shopee, Lazada, TikTok Shop & more. |
| **Visibility**      | Private (recommended for production code)                                                                                                                                                                                                                    |
| **Initialize**      | ❌ Do NOT check "Add README" — you already have one                                                                                                                                                                                                          |

### 5. Connect and push

```bash
git remote add origin https://github.com/YOUR_USERNAME/grozziie-erp-server.git
git branch -M main
git push -u origin main
```

---

## Recommended Branch Strategy

```
main          ← production-ready code only
develop       ← integration branch
feature/*     ← new features (e.g. feature/platform-authorization)
fix/*         ← bug fixes
```

### Set up develop branch

```bash
git checkout -b develop
git push -u origin develop
```

### Start a new feature

```bash
git checkout develop
git checkout -b feature/platform-authorization
# ... make changes ...
git add .
git commit -m "feat: add platform store authorization module"
git push origin feature/platform-authorization
# Then open a Pull Request: feature/platform-authorization → develop
```

---

## Commit Message Convention

Follow Conventional Commits for clean history:

```bash
# New feature
git commit -m "feat: add inventory management module"

# Bug fix
git commit -m "fix: resolve Redis session key mismatch on logout"

# Documentation
git commit -m "docs: update API endpoints in README"

# Performance
git commit -m "perf: add Redis caching to warehouse list endpoint"

# Refactor
git commit -m "refactor: extract pagination logic into utils/pagination.js"

# Configuration
git commit -m "chore: add .env.example with all required variables"
```

---

## What's in .gitignore (already configured)

| Ignored         | Reason                          |
| --------------- | ------------------------------- |
| `.env`          | Contains secrets — never commit |
| `node_modules/` | Reinstall with `npm install`    |
| `uploads/*`     | User uploaded files             |
| `*.log`         | Log files                       |
| `.DS_Store`     | macOS system files              |

---

## After pushing, set up on GitHub

1. Go to your repo → **Settings** → **Branches**
2. Set `main` as the default branch
3. Add branch protection rule on `main`:
   - ✅ Require pull request before merging
   - ✅ Require at least 1 review
4. Go to **About** (top right of repo) → Add description and topics

---

## Environment on Server (Production)

Never push `.env` — instead use GitHub Secrets or your server's environment:

```bash
# On your production server
export NODE_ENV=production
export DB_HOST=your_production_db_host
export JWT_SECRET=your_production_secret
# ... etc
```

Or use a process manager like PM2:

```bash
npm install -g pm2
pm2 start index.js --name grozziie-erp --env production
pm2 save
pm2 startup
```

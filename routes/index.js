'use strict';
const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../config/rateLimiter');

// ─── Apply general rate limiter to all /api/v1 routes ────────────────────────
router.use(apiLimiter);

// ─── Active modules ───────────────────────────────────────────────────────────
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/users/users.routes'));
router.use('/pages', require('../modules/Pages/Pages.routes'));
router.use('/roles', require('../modules/roles/roles.routes'));
router.use('/warehouses', require('../modules/warehouses/warehouses.routes'));
router.use('/merchant-skus', require('../modules/merchantSkus/merchantSkus.routes'));
router.use('/combine-skus', require('../modules/combineskus/combineskus.routes'));

// ── Inventory: SKU management ─────────────────────────────────────────────────
// router.use('/merchant-skus', require('../modules/merchant-skus/merchantSkus.routes'));
// router.use('/combine-skus', require('../modules/combine-skus/combineskus.routes'));

// ── Inventory: Inbound shipments ──────────────────────────────────────────────
router.use('/inbound', require('../modules/inbound/inbound.routes'));

// ── Inventory: Stock management + deduction API ───────────────────────────────
router.use('/stock', require('../modules/stock/stock.routes'));

// ── Platform integration ──────────────────────────────────────────────────────
router.use('/platform-stores', require('../modules/platformStores/platformStores.routes'));
router.use('/platform-sku-mappings', require('../modules/platformSkuMappings/platformSkuMappings.routes'));

// TODO: Uncomment as you build each module
// router.use('/companies',    require('../modules/companies/companies.routes'));
// router.use('/roles',        require('../modules/roles/roles.routes'));
// router.use('/platforms',    require('../modules/platforms/platforms.routes'));
// router.use('/products',     require('../modules/products/products.routes'));
// router.use('/sku-mapping',  require('../modules/skuMapping/skuMapping.routes'));
// router.use('/inventory',    require('../modules/inventory/inventory.routes'));
// router.use('/inbound',      require('../modules/inbound/inbound.routes'));
// router.use('/orders',       require('../modules/orders/orders.routes'));
// router.use('/manual-orders',require('../modules/manualOrders/manualOrders.routes'));
// router.use('/dashboard',    require('../modules/dashboard/dashboard.routes'));

module.exports = router;
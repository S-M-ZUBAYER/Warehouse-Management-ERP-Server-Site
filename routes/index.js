'use strict';
const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../config/rateLimiter');
const { requirePageAccess } = require('../utils/permissions');
const { authenticate } = require('../middlewares/auth');

// ─── Apply general rate limiter to all /api/v1 routes ────────────────────────
router.use(apiLimiter);

// ─── Active modules ───────────────────────────────────────────────────────────
router.use('/auth', require('../modules/auth/auth.routes'));

// System configuration / account pages
router.use('/users', authenticate, requirePageAccess('sub_account'), require('../modules/users/users.routes'));
router.use('/pages', require('../modules/Pages/Pages.routes'));
router.use('/roles', authenticate, requirePageAccess('role_management'), require('../modules/roles/roles.routes'));

// Main modules with page permission protection. Owner bypasses these checks.
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/warehouses', authenticate, requirePageAccess('warehouse_management'), require('../modules/warehouses/warehouses.routes'));
router.use('/merchant-skus', authenticate, requirePageAccess('merchant_sku'), require('../modules/merchantSkus/merchantSkus.routes'));
router.use('/combine-skus', authenticate, requirePageAccess('combine_sku'), require('../modules/combineskus/combineskus.routes'));
router.use('/inventory', authenticate, requirePageAccess('inventory_list'), require('../modules/inventory/inventory.routes'));
router.use('/stock', authenticate, requirePageAccess('inventory_list'), require('../modules/stock/stock.routes'));
router.use('/inbound', authenticate, requirePageAccess('inbound'), require('../modules/inbound/inbound.routes'));

// Marketplace order notifications. This route has its own API-key middleware
// because Shopee/TikTok webhook workers do not use the ERP user JWT flow.
router.use('/platform-order-deductions', require('../modules/platformOrderDeductions/platformOrderDeductions.routes'));

// Platform / SKU mapping pages
router.use('/platform-stores', authenticate, requirePageAccess('store_authorization'), require('../modules/platformStores/platformStores.routes'));
router.use('/platform-products', authenticate, requirePageAccess('sku_mapping'), require('../modules/platformProducts/platformProducts.routes'));
router.use('/platform-sku-mappings', authenticate, requirePageAccess('sku_mapping'), require('../modules/platformSkuMappings/platformSkuMappings.routes'));
router.use('/sku-mapping', authenticate, requirePageAccess('sku_mapping'), require('../modules/skuMapping/skuMapping.routes'));
router.use('/sku-sync-groups', authenticate, requirePageAccess('sku_mapping'), require('../modules/skuSyncGroup/skuSyncGroup.routes'));

module.exports = router;

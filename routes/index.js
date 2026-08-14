'use strict';
const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../config/rateLimiter');
const { requirePageAccess } = require('../utils/permissions');
const { authenticate } = require('../middlewares/auth');
const platformManualOrdersController = require('../modules/platformManualOrders/platformManualOrders.controller');

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
router.get('/warehouses', authenticate, (req, res, next) => {
    const keys = Object.keys(req.query || {});
    if (keys.length === 1 && keys[0] === 'companyId') {
        return platformManualOrdersController.listWarehouses(req, res, next);
    }
    return next();
});
router.get('/warehouses/:warehouseId/merchant-skus', authenticate, platformManualOrdersController.listWarehouseMerchantSkus);
router.use('/warehouses', authenticate, requirePageAccess('warehouse_management'), require('../modules/warehouses/warehouses.routes'));
router.use('/merchant-skus', authenticate, requirePageAccess('merchant_sku'), require('../modules/merchantSkus/merchantSkus.routes'));
router.use('/combine-skus', authenticate, requirePageAccess('combine_sku'), require('../modules/combineskus/combineskus.routes'));
router.use('/inventory', authenticate, requirePageAccess('inventory_list'), require('../modules/inventory/inventory.routes'));
router.use('/stock', authenticate, requirePageAccess('inventory_list'), require('../modules/stock/stock.routes'));
router.use('/inbound', authenticate, requirePageAccess('inbound'), require('../modules/inbound/inbound.routes'));
router.use('/outbound', authenticate, requirePageAccess('inbound'), require('../modules/outbound/outbound.routes'));
router.use('/order-management', authenticate, require('../modules/packFailedOrders/packFailedOrders.routes'));
router.use('/order-management', authenticate, require('../modules/pushSuccessfulOrders/pushSuccessfulOrders.routes'));
router.use('/order-management', authenticate, require('../modules/withdrawOrders/withdrawOrders.routes'));
router.use('/order-management', authenticate, require('../modules/manualOrders/manualOrders.routes'));
router.use('/auto-order-accept', authenticate, require('../modules/autoOrderAccept/autoOrderAccept.routes'));
router.use('/platform-manual-orders', authenticate, require('../modules/platformManualOrders/platformManualOrders.routes'));
router.use('/return-orders', authenticate, requirePageAccess('return_order'), require('../modules/returnOrders/returnOrders.routes'));

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

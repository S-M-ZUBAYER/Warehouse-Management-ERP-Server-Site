'use strict';

const express = require('express');
const router  = express.Router();

const ctrl = require('./inventory.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    listInventoryValidator,
    countInventoryValidator,
    setStockAlertValidator,
    syncInventoryValidator,
    updateInventoryStockValidator,
} = require('./inventory.validator');

router.use(authenticate);

// ── Static routes MUST come before any /:param routes ──────────────────────

// GET /api/v1/inventory/dropdowns
// Returns warehouses for the filter bar
router.get('/dropdowns', ctrl.getDropdowns);

// GET /api/v1/inventory/counts
// Returns { all, mapped, unmapped } for tab badges
// Query: ?warehouseId=1
router.get('/counts', countInventoryValidator, ctrl.getInventoryCounts);

// GET /api/v1/inventory
// Paginated inventory list — stock + merchant SKU + mapping status
// Query: ?warehouseId=1&search=WM&skuType=sku_name&mappingStatus=all&page=1&limit=20
router.get('/', listInventoryValidator, ctrl.getInventoryList);

// PUT /api/v1/inventory/stock-alert
// Set minimum stock alert for selected inventory rows
// Body: { skuIds: [1,2,3], minStock: 10 }
// Roles: owner | admin | manager
router.put(
    '/stock-alert',
    setStockAlertValidator,
    ctrl.setStockAlert
);

// PUT /api/v1/inventory/sync
// Mark selected mapped SKUs out_of_sync → Java picks up and re-pushes to platforms
// Body: { skuIds: [] }  ← empty = sync ALL mapped SKUs for this company
// Roles: owner | admin | manager
router.put(
    '/sync',
    syncInventoryValidator,
    ctrl.syncInventory
);

// PUT /api/v1/inventory/:id/stock
// Edit quantity and lock quantity for one inventory row
router.put(
    '/:id/stock',
    updateInventoryStockValidator,
    ctrl.updateInventoryStock
);

module.exports = router;

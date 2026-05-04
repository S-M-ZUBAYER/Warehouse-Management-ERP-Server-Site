'use strict';

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const ctrl = require('./stock.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

router.use(authenticate);

// ─── Validators ───────────────────────────────────────────────────────────────
const adjustValidator = [
    body('merchantSkuId').notEmpty().isInt({ min: 1 }),
    body('warehouseId').notEmpty().isInt({ min: 1 }),
    body('adjustmentQty')
        .notEmpty().withMessage('adjustmentQty is required')
        .isInt().withMessage('Must be an integer (positive to add, negative to remove)'),
    body('notes').optional().trim().isLength({ max: 500 }),
];

const deductValidator = [
    body('platformMappingId').notEmpty().withMessage('platformMappingId is required').isInt({ min: 1 }),
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ min: 1, max: 100 }),
    body('platformOrderItemId').optional().trim().isLength({ max: 100 }),
    body('quantitySold').notEmpty().withMessage('quantitySold is required').isInt({ min: 1 }),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/v1/stock/ledger  — audit log (before param routes)
router.get('/ledger', ctrl.getStockLedger);

// GET /api/v1/stock/merchant/:merchantSkuId
router.get('/merchant/:merchantSkuId', ctrl.getStockByMerchantSku);

// GET /api/v1/stock/combine/:combineSkuId
router.get('/combine/:combineSkuId', ctrl.getStockByCombineSku);

// POST /api/v1/stock/bulk  — Java: bulk stock query before push
router.post('/bulk', ctrl.getBulkStock);

// POST /api/v1/stock/adjust  — manual correction (owner/admin only)
router.post('/adjust', requireRole('owner', 'admin'), adjustValidator, ctrl.manualAdjustStock);

// POST /api/v1/stock/deduct  — Java-facing: called after platform sale webhook
// Uses a service account check in addition to JWT (Java must pass its API key)
router.post('/deduct', deductValidator, ctrl.deductStock);

module.exports = router;
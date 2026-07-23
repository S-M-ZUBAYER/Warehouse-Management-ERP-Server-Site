'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('./merchantSkus.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createMerchantSkuValidator,
    updateMerchantSkuValidator,
    listMerchantSkuValidator,
} = require('./merchantSkus.validator');

router.use(authenticate);

// GET  /api/v1/merchant-skus/dropdowns   — warehouse + country dropdowns for filters
router.get('/dropdowns', ctrl.getDropdowns);

// GET  /api/v1/merchant-skus             — product list with all filters
router.get('/', listMerchantSkuValidator, ctrl.getMerchantSkus);

// GET  /api/v1/merchant-skus/:id         — product detail
router.get('/:id', ctrl.getMerchantSkuById);

// POST /api/v1/merchant-skus             — create product/SKU
router.post('/', requireRole('owner', 'admin', 'manager'), createMerchantSkuValidator, ctrl.createMerchantSku);

// PUT  /api/v1/merchant-skus/:id         — update product/SKU
router.put('/:id', requireRole('owner', 'admin', 'manager'), updateMerchantSkuValidator, ctrl.updateMerchantSku);

// DELETE /api/v1/merchant-skus/bulk      — bulk delete (must be before /:id)
router.delete('/bulk', requireRole('owner', 'admin', 'manager'), ctrl.bulkDeleteMerchantSkus);

// DELETE /api/v1/merchant-skus/:id       — delete single
router.delete('/:id', requireRole('owner', 'admin', 'manager'), ctrl.deleteMerchantSku);

module.exports = router;
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('./combineskus.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createCombineSkuValidator,
    updateCombineSkuValidator,
    listCombineSkuValidator,
} = require('./combineskus.validator');

router.use(authenticate);

// GET /api/v1/combine-skus/picker  — merchant SKU picker (must be before /:id)
router.get('/picker', ctrl.getMerchantSkusForPicker);

// GET  /api/v1/combine-skus
router.get('/', listCombineSkuValidator, ctrl.getCombineSkus);

// GET  /api/v1/combine-skus/:id
router.get('/:id', ctrl.getCombineSkuById);

// POST /api/v1/combine-skus
router.post('/', requireRole('owner', 'admin', 'manager'), createCombineSkuValidator, ctrl.createCombineSku);

// PUT  /api/v1/combine-skus/:id
router.put('/:id', requireRole('owner', 'admin', 'manager'), updateCombineSkuValidator, ctrl.updateCombineSku);

// DELETE /api/v1/combine-skus/:id
router.delete('/:id', requireRole('owner', 'admin', 'manager'), ctrl.deleteCombineSku);

module.exports = router;
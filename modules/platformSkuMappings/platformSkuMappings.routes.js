'use strict';

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const ctrl = require('./platformSkuMappings.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

router.use(authenticate);

const createValidator = [
    body('platformStoreId').notEmpty().isInt({ min: 1 }).withMessage('platformStoreId is required'),
    body('merchantSkuId').optional({ nullable: true }).isInt({ min: 1 }),
    body('combineSkuId').optional({ nullable: true }).isInt({ min: 1 }),
    body('fulfillmentWarehouseId').optional({ nullable: true }).isInt({ min: 1 }),
];

const syncCallbackValidator = [
    body('success').notEmpty().isBoolean().withMessage('success (boolean) is required'),
    body('platformSkuId').optional().trim().isLength({ max: 100 }),
    body('platformListingId').optional().trim().isLength({ max: 100 }),
    body('platformModelId').optional().trim().isLength({ max: 100 }),
    body('errorMessage').optional().trim(),
];

// GET /api/v1/platform-sku-mappings/pending-sync  — Java polls this (BEFORE /:id)
router.get('/pending-sync', ctrl.getPendingSyncMappings);

// GET /api/v1/platform-sku-mappings
router.get('/', ctrl.getPlatformSkuMappings);

// GET /api/v1/platform-sku-mappings/:id
router.get('/:id', ctrl.getPlatformSkuMappingById);

// POST /api/v1/platform-sku-mappings
router.post('/', requireRole('owner', 'admin', 'manager'), createValidator, ctrl.createPlatformSkuMapping);

// PUT /api/v1/platform-sku-mappings/:id
router.put('/:id', requireRole('owner', 'admin', 'manager'), ctrl.updatePlatformSkuMapping);

// PUT /api/v1/platform-sku-mappings/:id/sync-callback  — Java writes back platform listing IDs
router.put('/:id/sync-callback', syncCallbackValidator, ctrl.syncCallback);

// DELETE /api/v1/platform-sku-mappings/:id
router.delete('/:id', requireRole('owner', 'admin', 'manager'), ctrl.deletePlatformSkuMapping);

module.exports = router;
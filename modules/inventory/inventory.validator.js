'use strict';

const { query, body } = require('express-validator');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/inventory
// ─────────────────────────────────────────────────────────────────────────────
const listInventoryValidator = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),

    query('warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid warehouseId'),

    query('skuType')
        .optional()
        .isIn(['sku_name', 'product_name', 'gtin', 'store_id'])
        .withMessage('skuType must be sku_name | product_name | gtin | store_id'),

    query('mappingStatus')
        .optional()
        .isIn(['all', 'mapped', 'unmapped'])
        .withMessage('mappingStatus must be all | mapped | unmapped'),

    query('search')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('search too long'),

    query('sortBy')
        .optional()
        .isIn(['created_at', 'updated_at', 'qty_on_hand', 'sku_name'])
        .withMessage('Invalid sortBy field'),

    query('sortOrder')
        .optional()
        .isIn(['ASC', 'DESC']),
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/inventory/counts
// ─────────────────────────────────────────────────────────────────────────────
const countInventoryValidator = [
    query('warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid warehouseId'),
];

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/inventory/stock-alert
// ─────────────────────────────────────────────────────────────────────────────
const setStockAlertValidator = [
    body('skuIds')
        .notEmpty().withMessage('skuIds array is required')
        .isArray({ min: 1 }).withMessage('skuIds must be a non-empty array'),

    body('skuIds.*')
        .isInt({ min: 1 }).withMessage('Each skuId must be a positive integer'),

    body('minStock')
        .notEmpty().withMessage('minStock is required')
        .isInt({ min: 0 }).withMessage('minStock must be a non-negative integer'),
];

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/inventory/sync
// ─────────────────────────────────────────────────────────────────────────────
const syncInventoryValidator = [
    body('skuIds')
        .optional()
        .isArray().withMessage('skuIds must be an array'),

    body('skuIds.*')
        .optional()
        .isInt({ min: 1 }).withMessage('Each skuId must be a positive integer'),
];

module.exports = {
    listInventoryValidator,
    countInventoryValidator,
    setStockAlertValidator,
    syncInventoryValidator,
};

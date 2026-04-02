'use strict';
const { body, query } = require('express-validator');

const createCombineSkuValidator = [
    body('combineName')
        .trim()
        .notEmpty().withMessage('Combine SKU name is required')
        .isLength({ min: 2, max: 255 }).withMessage('Name max 255 characters'),

    body('combineSkuCode')
        .trim()
        .notEmpty().withMessage('Combine SKU code is required')
        .isLength({ min: 1, max: 100 }).withMessage('Code max 100 characters'),

    body('gtin').optional().trim().isLength({ max: 50 }),
    body('description').optional().trim(),
    body('sellingPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('costPrice').optional().isDecimal({ decimal_digits: '0,2' }),

    body('weight').optional().isDecimal({ decimal_digits: '0,2' }),
    body('length').optional().isDecimal({ decimal_digits: '0,2' }),
    body('width').optional().isDecimal({ decimal_digits: '0,2' }),
    body('height').optional().isDecimal({ decimal_digits: '0,2' }),

    body('warehouseId')
        .optional()
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),

    body('status')
        .optional()
        .isIn(['active', 'inactive']),

    // items: [{ merchantSkuId: 1, quantity: 2 }, ...]
    body('items')
        .notEmpty().withMessage('At least one merchant SKU item is required')
        .isArray({ min: 1 }).withMessage('Items must be a non-empty array'),

    body('items.*.merchantSkuId')
        .notEmpty().withMessage('merchantSkuId is required in each item')
        .isInt({ min: 1 }).withMessage('Invalid merchantSkuId'),

    body('items.*.quantity')
        .notEmpty().withMessage('quantity is required in each item')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

const updateCombineSkuValidator = [
    body('combineName').optional().trim().isLength({ min: 2, max: 255 }),
    body('gtin').optional().trim(),
    body('description').optional().trim(),
    body('sellingPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('costPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('weight').optional().isDecimal({ decimal_digits: '0,2' }),
    body('length').optional().isDecimal({ decimal_digits: '0,2' }),
    body('width').optional().isDecimal({ decimal_digits: '0,2' }),
    body('height').optional().isDecimal({ decimal_digits: '0,2' }),
    body('warehouseId').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['active', 'inactive']),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.merchantSkuId').optional().isInt({ min: 1 }),
    body('items.*.quantity').optional().isInt({ min: 1 }),
];

const listCombineSkuValidator = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('warehouseId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['active', 'inactive']),
    query('sortBy').optional().isIn(['created_at', 'updated_at', 'combine_name']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
];

module.exports = {
    createCombineSkuValidator,
    updateCombineSkuValidator,
    listCombineSkuValidator,
};
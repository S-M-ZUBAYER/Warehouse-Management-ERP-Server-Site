'use strict';
const { body, query } = require('express-validator');

const createMerchantSkuValidator = [
    body('skuName')
        .trim()
        .notEmpty().withMessage('SKU name is required')
        .isLength({ min: 1, max: 100 }).withMessage('SKU name max 100 characters'),

    body('skuTitle')
        .trim()
        .notEmpty().withMessage('SKU title is required')
        .isLength({ min: 2, max: 255 }).withMessage('SKU title max 255 characters'),

    body('warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),

    body('gtin')
        .optional().trim().isLength({ max: 50 }),

    body('productDetails')
        .optional().trim(),

    body('weight')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Weight must be a decimal'),

    body('length')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Length must be a decimal'),

    body('width')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Width must be a decimal'),

    body('height')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Height must be a decimal'),

    body('price')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Price must be a decimal'),

    body('costPrice')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('Cost price must be a decimal'),

    body('country')
        .optional().trim().isLength({ max: 100 }),

    body('status')
        .optional({ values: 'falsy' })
        .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),

    body('image')
        .optional({ values: 'falsy' })
        .custom((val) => {
            if (val && typeof val !== 'string') throw new Error('Image must be a base64 string');
            return true;
        }),
];

const updateMerchantSkuValidator = [
    body('skuTitle')
        .optional().trim()
        .isLength({ min: 2, max: 255 }),

    body('warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }),

    body('gtin').optional().trim(),
    body('productDetails').optional().trim(),

    body('weight').optional().isDecimal({ decimal_digits: '0,2' }),
    body('length').optional().isDecimal({ decimal_digits: '0,2' }),
    body('width').optional().isDecimal({ decimal_digits: '0,2' }),
    body('height').optional().isDecimal({ decimal_digits: '0,2' }),
    body('price').optional().isDecimal({ decimal_digits: '0,2' }),
    body('costPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('country').optional().trim(),

    body('status')
        .optional({ values: 'falsy' })
        .isIn(['active', 'inactive']),

    body('image')
        .optional({ values: 'falsy' })
        .custom((val) => {
            if (val && typeof val !== 'string') throw new Error('Image must be a base64 string');
            return true;
        }),
];

const listMerchantSkuValidator = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('warehouseId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['active', 'inactive', 'all', 'in_stock', 'out_of_stock']),
    query('country').optional().trim(),
    query('sortBy').optional().isIn(['created_at', 'updated_at', 'sku_name', 'sku_title']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
];

module.exports = {
    createMerchantSkuValidator,
    updateMerchantSkuValidator,
    listMerchantSkuValidator,
};
'use strict';
const { body, query } = require('express-validator');

const outboundLinesValidator = [
    body('lines')
        .notEmpty().withMessage('At least one SKU line is required')
        .isArray({ min: 1 }).withMessage('Lines must be a non-empty array'),
    body('lines.*.merchantSkuId')
        .notEmpty().withMessage('merchantSkuId is required in each line')
        .isInt({ min: 1 }).withMessage('Invalid merchantSkuId'),
    body('lines.*.qtyExpected')
        .notEmpty().withMessage('qtyExpected is required in each line')
        .isInt({ min: 1 }).withMessage('qtyExpected must be at least 1'),
    body('lines.*.unitCost')
        .optional({ values: 'falsy' })
        .isDecimal({ decimal_digits: '0,2' }).withMessage('unitCost must be a decimal'),
    body('lines.*.currency')
        .optional().trim().isLength({ max: 10 }),
];

const createOutboundValidator = [
    body('warehouseId')
        .notEmpty().withMessage('Warehouse is required')
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),
    body('supplierName').optional().trim().isLength({ max: 255 }),
    body('supplierReference').optional().trim().isLength({ max: 100 }),
    body('receivingWarehouseName').trim().notEmpty().withMessage('Receiving warehouse is required').isLength({ max: 255 }),
    body('receivingWarehouseAddress').trim().notEmpty().withMessage('Receiving warehouse full address is required').isLength({ max: 1000 }),
    body('notes').optional().trim(),
    ...outboundLinesValidator,
];

const updateOutboundValidator = [
    body('warehouseId')
        .optional()
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),
    body('supplierName').optional().trim().isLength({ max: 255 }),
    body('supplierReference').optional().trim().isLength({ max: 100 }),
    body('receivingWarehouseName').trim().notEmpty().withMessage('Receiving warehouse is required').isLength({ max: 255 }),
    body('receivingWarehouseAddress').trim().notEmpty().withMessage('Receiving warehouse full address is required').isLength({ max: 1000 }),
    body('notes').optional().trim(),
    body('lines').optional().isArray({ min: 1 }).withMessage('Lines must be a non-empty array'),
    body('lines.*.merchantSkuId').optional().isInt({ min: 1 }).withMessage('Invalid merchantSkuId'),
    body('lines.*.qtyExpected').optional().isInt({ min: 1 }).withMessage('qtyExpected must be at least 1'),
    body('lines.*.unitCost').optional({ values: 'falsy' }).isDecimal({ decimal_digits: '0,2' }).withMessage('unitCost must be a decimal'),
    body('lines.*.currency').optional().trim().isLength({ max: 10 }),
];

const shipOutboundValidator = [
    body('trackingNumber')
        .notEmpty().withMessage('Tracking number is required')
        .trim().isLength({ min: 1, max: 100 }),
    body('purchaseCurrency')
        .notEmpty().withMessage('Purchase currency is required')
        .trim().isLength({ min: 2, max: 10 }),
    body('estimatedArrival')
        .notEmpty().withMessage('Estimated arrival date is required')
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('estimatedArrival must be YYYY-MM-DD'),
    body('exchangeRate').optional({ values: 'falsy' }).isDecimal({ decimal_digits: '0,6' }),
    body('shippingCost').optional({ values: 'falsy' }).isDecimal({ decimal_digits: '0,2' }),
    body('supplierName').optional().trim().isLength({ max: 255 }),
    body('supplierReference').optional().trim().isLength({ max: 100 }),
    body('receivingWarehouseName').optional().trim().isLength({ max: 255 }),
    body('receivingWarehouseAddress').optional().trim().isLength({ max: 1000 }),
    body('notes').optional().trim(),
];

const receiveOutboundValidator = [
    body('lines')
        .notEmpty().withMessage('Receive lines are required')
        .isArray({ min: 1 }),
    body('lines.*.lineId')
        .notEmpty().withMessage('lineId is required in each line')
        .isInt({ min: 1 }),
    body('lines.*.qtyReceived')
        .notEmpty().withMessage('qtyReceived is required in each line')
        .isInt({ min: 0 }).withMessage('qtyReceived must be 0 or more'),
    body('lines.*.discrepancyNotes').optional().trim().isLength({ max: 500 }),
    body('supplierName').optional().trim().isLength({ max: 255 }),
    body('supplierReference').optional().trim().isLength({ max: 100 }),
    body('receivingWarehouseName').optional().trim().isLength({ max: 255 }),
    body('receivingWarehouseAddress').optional().trim().isLength({ max: 1000 }),
    body('notes').optional().trim(),
];

const listOutboundValidator = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('warehouseId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['draft', 'on_the_way', 'completed', 'all']),
    query('dateFrom').optional().isDate({ format: 'YYYY-MM-DD' }),
    query('dateTo').optional().isDate({ format: 'YYYY-MM-DD' }),
    query('sortBy').optional().isIn(['created_at', 'updated_at', 'estimated_arrival', 'outbound_id']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
];

module.exports = {
    createOutboundValidator,
    updateOutboundValidator,
    shipOutboundValidator,
    receiveOutboundValidator,
    listOutboundValidator,
};

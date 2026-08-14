'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('./returnOrders.controller');

const router = express.Router();

const RETURN_STATUS_VALUES = ['need_to_check', 'defect_found', 'pending_inspection', 'resalable_item'];
const RETURN_TYPE_VALUES = ['by_logistic', 'by_buyer_use_logistic', 'by_buyer_direct_give', 'without_logistic'];

const normalizeChoice = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const normalizeReturnStatusInput = (value) => {
    const key = normalizeChoice(value);
    const aliases = {
        need_to_check: 'need_to_check',
        needtocheck: 'need_to_check',
        defect_found: 'defect_found',
        defectfound: 'defect_found',
        pending_inspection: 'pending_inspection',
        pendinginspection: 'pending_inspection',
        resalable_item: 'resalable_item',
        resaleable_item: 'resalable_item',
        resalable: 'resalable_item',
        resaleable: 'resalable_item',
    };
    return aliases[key] || value;
};

const normalizeReturnTypeInput = (value) => {
    const key = normalizeChoice(value);
    const aliases = {
        by_logistic: 'by_logistic',
        by_buyer_use_logistic: 'by_buyer_use_logistic',
        by_buyer: 'by_buyer_use_logistic',
        by_buyer_direct_give: 'by_buyer_direct_give',
        buyer_direct: 'by_buyer_direct_give',
        without_logistic: 'without_logistic',
        no_logistic: 'without_logistic',
    };
    const normalized = aliases[key] || key;
    return RETURN_TYPE_VALUES.includes(normalized) ? normalized : 'without_logistic';
};

const idParam = [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
];

const listValidator = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
    query('platform').optional().isIn(['all', 'manual', 'shopee', 'tiktok']).withMessage('Invalid platform'),
    query('status').optional().isString().trim(),
    query('warehouseId').optional().custom((value) => value === 'all' || Number.isInteger(Number(value))).withMessage('Invalid warehouseId'),
    query('storeId').optional().custom((value) => value === 'all' || Number.isInteger(Number(value))).withMessage('Invalid storeId'),
    query('search').optional().isString().trim(),
    query('searchType').optional().isIn(['Single Search', 'Batch Search']).withMessage('Invalid searchType'),
    query('skuType').optional().isIn(['SKU', 'Order Number', 'Tracking Number', 'Return ID', 'Return Status', 'Platform Status']).withMessage('Invalid skuType'),
    query('sortField').optional().isIn(['platformCreateTime', 'platformUpdateTime', 'returnStatus', 'platformStatus']).withMessage('Invalid sortField'),
    query('sortDirection').optional().isIn(['asc', 'desc', 'ASC', 'DESC']).withMessage('Invalid sortDirection'),
    query('startDate').optional().isInt({ min: 1 }).withMessage('startDate must be a Unix timestamp in seconds'),
    query('endDate').optional().isInt({ min: 1 }).withMessage('endDate must be a Unix timestamp in seconds'),
];

const syncReturnValidator = [
    body('platformStoreId').optional().custom((value) => value === 'all' || Number.isInteger(Number(value))).withMessage('Invalid platformStoreId'),
    body('storeId').optional().custom((value) => value === 'all' || Number.isInteger(Number(value))).withMessage('Invalid storeId'),
    body('storeIds').optional().isArray().withMessage('storeIds must be an array'),
    body('storeIds.*').optional().isInt({ min: 1 }).withMessage('storeIds must contain positive integers'),
    body('days').optional().isInt({ min: 1, max: 30 }).withMessage('days must be between 1 and 30'),
    body('startDate').optional().isInt({ min: 1 }).withMessage('startDate must be a Unix timestamp in seconds'),
    body('endDate').optional().isInt({ min: 1 }).withMessage('endDate must be a Unix timestamp in seconds'),
    body('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be between 1 and 100'),
];

const manualReturnValidator = [
    body('warehouseId').isInt({ min: 1 }).withMessage('warehouseId is required'),
    body('platform').isIn(['shopee', 'tiktok']).withMessage('platform is required'),
    body('platformStoreId').isInt({ min: 1 }).withMessage('platformStoreId is required'),
    body('orderNumber').isString().trim().notEmpty().withMessage('orderNumber is required'),
    body('warehousePackageNo').optional().isString().trim(),
    body('trackingNumber').optional().isString().trim(),
    body('logisticName').optional().isString().trim(),
    body('storeName').optional().isString().trim(),
    body('remark').optional().isString().trim(),
    body('lines').isArray({ min: 1 }).withMessage('At least one return item is required'),
    body('lines.*.merchantSkuId').isInt({ min: 1 }).withMessage('merchantSkuId is required'),
    body('lines.*.quantity').isInt({ min: 1 }).withMessage('quantity must be a positive integer'),
];

const manualReturnLookupValidator = [
    body('platform').isIn(['shopee', 'tiktok']).withMessage('platform is required'),
    body('platformStoreId').isInt({ min: 1 }).withMessage('platformStoreId is required'),
    body('orderNumber').isString().trim().notEmpty().withMessage('orderNumber is required'),
];

const updateStatusValidator = [
    ...idParam,
    body('returnStatus')
        .customSanitizer(normalizeReturnStatusInput)
        .isIn(RETURN_STATUS_VALUES)
        .withMessage('Invalid returnStatus'),
    body('returnType')
        .customSanitizer(normalizeReturnTypeInput)
        .isIn(RETURN_TYPE_VALUES)
        .withMessage('Invalid returnType'),
    body('warehouseId').isInt({ min: 1 }).withMessage('warehouseId is required'),
    body('returnTrackingNo').optional().isString().trim(),
    body('localReturnTrackingNo').optional().isString().trim(),
    body('trackingNumber').optional().isString().trim(),
    body('logisticName').optional().isString().trim(),
    body('remark').optional().isString().trim(),
];

const deleteValidator = [
    ...idParam,
    body('orderNumber').isString().trim().notEmpty().withMessage('orderNumber confirmation is required'),
];

router.get('/', listValidator, ctrl.listReturnOrders);
router.get('/sync/status', ctrl.getSyncStatus);
router.post('/sync/tiktok', syncReturnValidator, ctrl.syncTikTokReturnOrders);
router.post('/sync/shopee', syncReturnValidator, ctrl.syncShopeeReturnOrders);
router.post('/manual/order-lookup', manualReturnLookupValidator, ctrl.lookupManualReturnOrder);
router.post('/manual', manualReturnValidator, ctrl.createManualReturnOrder);
router.get('/:id', idParam, ctrl.getReturnOrderById);
router.patch('/:id/status', updateStatusValidator, ctrl.updateReturnStatus);
router.delete('/:id', deleteValidator, ctrl.deleteReturnOrder);

module.exports = router;

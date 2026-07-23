'use strict';

const express = require('express');
const { body, query } = require('express-validator');

const ctrl = require('./packFailedOrders.controller');

const router = express.Router();

const platformValidator = (location) =>
    location('platform').notEmpty().withMessage('platform is required').isIn(['shopee', 'tiktok']).withMessage('platform must be shopee or tiktok');

const companyQueryValidator = query('companyId').optional().trim().isLength({ min: 1, max: 100 });
const companyBodyValidator = body('companyId').optional().trim().isLength({ min: 1, max: 100 });

const listValidator = [
    companyQueryValidator,
    platformValidator(query),
    query('storeId').notEmpty().withMessage('storeId is required').trim().isLength({ min: 1, max: 100 }),
];

const upsertValidator = [
    companyBodyValidator,
    platformValidator(body),
    body('storeId').notEmpty().withMessage('storeId is required').trim().isLength({ min: 1, max: 100 }),
    body('orders').isArray({ min: 1 }).withMessage('orders must be a non-empty array'),
    body('orders.*.orderId').notEmpty().withMessage('orderId is required').trim().isLength({ min: 1, max: 100 }),
    body('orders.*.reason').notEmpty().withMessage('reason is required').trim().isLength({ min: 1, max: 500 }),
];

const deleteValidator = [
    companyBodyValidator,
    platformValidator(body),
    body('storeId').notEmpty().withMessage('storeId is required').trim().isLength({ min: 1, max: 100 }),
    body('orderIds').isArray({ min: 1 }).withMessage('orderIds must be a non-empty array'),
    body('orderIds.*').notEmpty().withMessage('orderId is required').trim().isLength({ min: 1, max: 100 }),
];

router.get('/pack-failed-orders', listValidator, ctrl.listPackFailedOrders);
router.post('/pack-failed-orders', upsertValidator, ctrl.upsertPackFailedOrders);
router.delete('/pack-failed-orders', deleteValidator, ctrl.deletePackFailedOrders);

module.exports = router;

'use strict';

const express = require('express');
const { body, query } = require('express-validator');

const ctrl = require('./pushSuccessfulOrders.controller');

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
];

router.get('/push-successful-orders', listValidator, ctrl.listPushSuccessfulOrders);
router.post('/push-successful-orders', upsertValidator, ctrl.upsertPushSuccessfulOrders);

module.exports = router;

'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('./orderActivityLogs.controller');
const { sendError } = require('../../utils/response');

const router = express.Router();
const publicRouter = express.Router();

const requireWebhookApiKey = (req, res, next) => {
    const expectedKey = process.env.ORDER_WEBHOOK_API_KEY;

    if (!expectedKey) return next();

    const providedKey = req.headers['x-api-key'] || req.headers['x-order-webhook-key'];
    if (providedKey !== expectedKey) {
        return sendError(res, 'Invalid webhook API key', 401);
    }

    next();
};

const platformValidator = (source) =>
    source('platform').notEmpty().withMessage('platform is required').isIn(['shopee', 'tiktok']);

const orderIdParamValidator = param('orderId').notEmpty().withMessage('orderId is required').trim().isLength({ max: 100 });

const createLogValidator = [
    body('companyId').notEmpty().withMessage('companyId is required').isInt({ min: 1 }),
    platformValidator(body),
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    body('platformOrderItemId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('platformStoreId').optional({ nullable: true }).isInt({ min: 1 }),
    body('storeId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('storeName').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('eventType').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('title').optional({ nullable: true }).trim().isLength({ max: 180 }),
    body('oldStatus').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('newStatus').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('actorType').optional({ nullable: true }).isIn(['USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM']),
    body('source').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('sourceEventId').optional({ nullable: true }).trim().isLength({ max: 180 }),
    body('platformRegion').optional({ nullable: true }).trim().isLength({ max: 10 }),
    body('platformTimezone').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('platformLocalOccurredAt').optional({ nullable: true }).trim().isLength({ max: 30 }),
];

const createUserLogValidator = [
    platformValidator(body),
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    body('platformOrderItemId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('platformStoreId').optional({ nullable: true }).isInt({ min: 1 }),
    body('storeId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('storeName').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('eventType').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('title').optional({ nullable: true }).trim().isLength({ max: 180 }),
    body('oldStatus').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('newStatus').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('actorType').optional({ nullable: true }).isIn(['USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM']),
    body('source').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('sourceEventId').optional({ nullable: true }).trim().isLength({ max: 180 }),
    body('platformRegion').optional({ nullable: true }).trim().isLength({ max: 10 }),
    body('platformTimezone').optional({ nullable: true }).trim().isLength({ max: 80 }),
    body('platformLocalOccurredAt').optional({ nullable: true }).trim().isLength({ max: 30 }),
];

router.get(
    '/platform-orders/:platform/:orderId/activity-logs',
    [platformValidator(param), orderIdParamValidator, query('companyId').optional({ nullable: true }).isInt({ min: 1 })],
    ctrl.listActivityLogs
);

router.post('/platform-orders/activity-logs', createUserLogValidator, ctrl.createActivityLog);

router.post(
    '/platform-orders/activity-logs/bulk',
    [
        body('logs').isArray({ min: 1 }).withMessage('logs must be a non-empty array'),
        body('logs.*.platform').notEmpty().withMessage('platform is required').isIn(['shopee', 'tiktok']),
        body('logs.*.platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    ],
    ctrl.createManyActivityLogs
);

publicRouter.post('/activity-logs', requireWebhookApiKey, createLogValidator, ctrl.createWebhookActivityLog);

module.exports = router;
module.exports.publicRouter = publicRouter;

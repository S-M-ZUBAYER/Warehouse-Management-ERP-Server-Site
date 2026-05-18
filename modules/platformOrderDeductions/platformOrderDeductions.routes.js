'use strict';

const express = require('express');
const { body } = require('express-validator');

const ctrl = require('./platformOrderDeductions.controller');
const { sendError } = require('../../utils/response');

const router = express.Router();
const publicShopeeRouter = express.Router();
const publicTikTokRouter = express.Router();

const requireWebhookApiKey = (req, res, next) => {
    const expectedKey = process.env.ORDER_WEBHOOK_API_KEY;

    if (!expectedKey && process.env.NODE_ENV === 'production') {
        return sendError(res, 'ORDER_WEBHOOK_API_KEY is not configured', 500);
    }

    if (!expectedKey) return next();

    const providedKey = req.headers['x-api-key'] || req.headers['x-order-webhook-key'];
    if (providedKey !== expectedKey) {
        return sendError(res, 'Invalid webhook API key', 401);
    }

    next();
};

const commonOrderFieldsValidator = [
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    body('platformOrderItemId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('quantitySold').notEmpty().withMessage('quantitySold is required').isInt({ min: 1 }),

    body('platformMappingId').optional({ nullable: true }).isInt({ min: 1 }),
    body('externalStoreId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('shopId').optional({ nullable: true }).trim().isLength({ max: 100 }),

    body('productId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('itemId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('skuId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('modelId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('listingId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('warehouseId').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('locationId').optional({ nullable: true }).trim().isLength({ max: 100 }),
];

const shopeeDeductValidator = [
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    body('platformOrderItemId').notEmpty().withMessage('platformOrderItemId is required').trim().isLength({ max: 100 }),
    body('quantitySold').notEmpty().withMessage('quantitySold is required').isInt({ min: 1 }),
    body('shopId').notEmpty().withMessage('shopId is required').trim().isLength({ max: 100 }),
    body('itemId').notEmpty().withMessage('itemId is required').trim().isLength({ max: 100 }),
    body('modelId').notEmpty().withMessage('modelId is required').trim().isLength({ max: 100 }),
];

const tiktokDeductValidator = [
    body('platformOrderId').notEmpty().withMessage('platformOrderId is required').trim().isLength({ max: 100 }),
    body('platformOrderItemId').notEmpty().withMessage('platformOrderItemId is required').trim().isLength({ max: 100 }),
    body('quantitySold').notEmpty().withMessage('quantitySold is required').isInt({ min: 1 }),
    body('openId').notEmpty().withMessage('openId is required').trim().isLength({ max: 100 }),
    body('cipherId').notEmpty().withMessage('cipherId is required').trim().isLength({ max: 255 }),
    body('productId').notEmpty().withMessage('productId is required').trim().isLength({ max: 100 }),
    body('skuId').notEmpty().withMessage('skuId is required').trim().isLength({ max: 100 }),
    body('warehouseId').notEmpty().withMessage('warehouseId is required').trim().isLength({ max: 100 }),
];

publicShopeeRouter.post('/', shopeeDeductValidator, ctrl.deductShopeeOrderNotification);
publicTikTokRouter.post('/', tiktokDeductValidator, ctrl.deductTikTokOrderNotification);

router.post('/shopee', shopeeDeductValidator, ctrl.deductShopeeOrderNotification);
router.post('/tiktok', tiktokDeductValidator, ctrl.deductTikTokOrderNotification);

module.exports = router;
module.exports.publicShopeeRouter = publicShopeeRouter;
module.exports.publicTikTokRouter = publicTikTokRouter;

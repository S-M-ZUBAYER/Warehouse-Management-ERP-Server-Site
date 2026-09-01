'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const ctrl = require('./adminManagement.controller');
const { sendError } = require('../../utils/response');

const router = express.Router();

const lower = (value) => String(value || '').trim().toLowerCase();

const getAllowedEmails = () =>
    String(process.env.ADMIN_MANAGEMENT_EMAILS || '')
        .split(',')
        .map(lower)
        .filter(Boolean);

const requireAdminManagementAccess = (req, res, next) => {
    const role = lower(req.user?.role);
    const email = lower(req.user?.email);
    const allowedEmails = getAllowedEmails();

    if (!['owner', 'admin'].includes(role)) {
        return sendError(res, 'Access denied. Admin management access requires owner or admin role.', 403);
    }

    if (!allowedEmails.length) {
        return sendError(res, 'ADMIN_MANAGEMENT_EMAILS is not configured on the server.', 500);
    }

    if (!allowedEmails.includes(email)) {
        return sendError(res, 'Access denied. Your email is not allowed for admin management APIs.', 403);
    }

    return next();
};

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return sendError(
            res,
            'Validation failed',
            400,
            errors.array().map((error) => ({ field: error.path, message: error.msg }))
        );
    }
    return next();
};

const listPlatformStoreUsersValidator = [
    query('platform').optional().isIn(['tiktok', 'shopee', 'TikTok', 'Shopee']).withMessage('platform must be tiktok or shopee'),
    query('search').optional().isString().trim().isLength({ max: 150 }).withMessage('search must be 150 characters or fewer'),
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
    query('export').optional().isBoolean().withMessage('export must be true or false'),
    query('includeDeleted').optional().isBoolean().withMessage('includeDeleted must be true or false'),
];

const listPlatformTransactionsValidator = [
    query('platform').optional().isIn(['all', 'tiktok', 'shopee', 'All', 'TikTok', 'Shopee']).withMessage('platform must be all, tiktok, or shopee'),
    query('search').optional().isString().trim().isLength({ max: 150 }).withMessage('search must be 150 characters or fewer'),
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
    query('export').optional().isBoolean().withMessage('export must be true or false'),
];

const listShippingWalletPaymentsValidator = [
    query('search').optional().isString().trim().isLength({ max: 150 }).withMessage('search must be 150 characters or fewer'),
    query('email').optional().isString().trim().isLength({ max: 150 }).withMessage('email must be 150 characters or fewer'),
    query('companyId').optional().isInt({ min: 1 }).withMessage('companyId must be a positive integer'),
    query('currency').optional().isString().trim().isLength({ min: 2, max: 10 }).withMessage('currency must be 2 to 10 characters'),
    query('status').optional().isString().trim().isLength({ max: 50 }).withMessage('status must be 50 characters or fewer'),
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
    query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid date'),
    query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid date'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
    query('export').optional().isBoolean().withMessage('export must be true or false'),
];

const listGiftsValidator = [
    query('status').optional().isIn([
        'all',
        'pending_address',
        'address_submitted',
        'processing',
        'on_the_way',
        'shipped',
        'delivered',
        'received',
        'declined',
        'cancelled',
        'canceled',
        'PENDING_ADDRESS',
        'ADDRESS_SUBMITTED',
        'ON_THE_WAY',
        'DELIVERED',
        'RECEIVED',
        'DECLINED',
        'CANCELLED',
    ]).withMessage('status is not valid'),
    query('search').optional().isString().trim().isLength({ max: 150 }).withMessage('search must be 150 characters or fewer'),
    query('country').optional().isString().trim().isLength({ max: 80 }).withMessage('country must be 80 characters or fewer'),
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
    query('export').optional().isBoolean().withMessage('export must be true or false'),
];

const giftIdValidator = [
    param('giftId').isInt({ min: 1 }).withMessage('giftId must be a positive integer'),
];

const updateGiftStatusValidator = [
    ...giftIdValidator,
    body('status').isIn([
        'on_the_way',
        'shipped',
        'delivered',
        'cancelled',
        'canceled',
        'ON_THE_WAY',
        'DELIVERED',
        'CANCELLED',
    ]).withMessage('status must be shipped/on_the_way, delivered, or cancelled'),
    body('trackingNumber').optional().isString().trim().isLength({ max: 120 }).withMessage('trackingNumber must be 120 characters or fewer'),
    body('tracking_number').optional().isString().trim().isLength({ max: 120 }).withMessage('tracking_number must be 120 characters or fewer'),
    body('note').optional().isString().trim().isLength({ max: 1000 }).withMessage('note must be 1000 characters or fewer'),
];

router.use(requireAdminManagementAccess);

router.get(
    '/platform-store-users',
    listPlatformStoreUsersValidator,
    validate,
    ctrl.listPlatformStoreUsers
);

router.get(
    '/platform-transactions',
    listPlatformTransactionsValidator,
    validate,
    ctrl.listPlatformTransactions
);

router.get(
    '/manual-order-shipping-wallet/payments',
    listShippingWalletPaymentsValidator,
    validate,
    ctrl.listShippingWalletPayments
);

router.get(
    '/gifts',
    listGiftsValidator,
    validate,
    ctrl.listGifts
);

router.get(
    '/gifts/:giftId',
    giftIdValidator,
    validate,
    ctrl.getGiftById
);

router.patch(
    '/gifts/:giftId/status',
    updateGiftStatusValidator,
    validate,
    ctrl.updateGiftStatus
);

module.exports = router;

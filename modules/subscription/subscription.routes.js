'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const { requireRole } = require('../../middlewares/auth');
const ctrl = require('./subscription.controller');

const router = express.Router();

const checkoutValidator = [
    body('planCode').optional().trim().isLength({ min: 1, max: 40 }),
    body('planName').optional().trim().isLength({ min: 1, max: 80 }),
    body().custom((value) => {
        if (!value.planCode && !value.planName) throw new Error('planCode or planName is required');
        return true;
    }),
    body('currency').optional().trim().isLength({ min: 3, max: 3 }),
    body('country').optional().trim().isLength({ min: 2, max: 2 }),
    body('storeIds').optional().isArray(),
    body('storeIds.*').optional().isInt({ min: 1 }),
    body('platformStoreIds').optional().isArray(),
    body('platformStoreIds.*').optional().isInt({ min: 1 }),
    body('stores').optional().isArray(),
    body('couponCode').optional().trim().isLength({ min: 3, max: 20 }),
];

const stripeCheckoutCompleteValidator = [
    body('sessionId').trim().notEmpty().isLength({ max: 255 }),
];

const couponValidator = [
    body('couponCode').trim().notEmpty().isLength({ min: 3, max: 20 }),
    body('planCode').optional().trim().isLength({ min: 1, max: 40 }),
    body('planName').optional().trim().isLength({ min: 1, max: 80 }),
    body('currency').optional().trim().isLength({ min: 3, max: 3 }),
    body('country').optional().trim().isLength({ min: 2, max: 2 }),
    body('durationDays').optional().isInt({ min: 1 }),
    body('storeIds').optional().isArray(),
    body('storeIds.*').optional().isInt({ min: 1 }),
    body('platformStoreIds').optional().isArray(),
    body('platformStoreIds.*').optional().isInt({ min: 1 }),
    body('stores').optional().isArray(),
];

const referralEligibilityValidator = [
    body('planCode').optional().trim().isLength({ min: 1, max: 40 }),
    body('planName').optional().trim().isLength({ min: 1, max: 80 }),
    body().custom((value) => {
        if (!value.planCode && !value.planName && !value.durationDays) {
            throw new Error('planCode, planName or durationDays is required');
        }
        return true;
    }),
    body('currency').optional().trim().isLength({ min: 3, max: 3 }),
    body('country').optional().trim().isLength({ min: 2, max: 2 }),
    body('durationDays').optional().isInt({ min: 1 }),
    body('storeIds').optional().isArray(),
    body('storeIds.*').optional().isInt({ min: 1 }),
    body('platformStoreIds').optional().isArray(),
    body('platformStoreIds.*').optional().isInt({ min: 1 }),
    body('stores').optional().isArray(),
];

const addressValidator = [
    body('address').isObject().withMessage('address is required'),
    body('address.fullName').trim().notEmpty().isLength({ max: 120 }),
    body('address.phone').trim().notEmpty().isLength({ max: 40 }),
    body('address.addressLine1').trim().notEmpty().isLength({ max: 255 }),
    body('address.addressLine2').optional().trim().isLength({ max: 255 }),
    body('address.zipCode').optional().trim().isLength({ max: 40 }),
    body('address.city').trim().notEmpty().isLength({ max: 120 }),
    body('address.state').optional().trim().isLength({ max: 120 }),
    body('address.postalCode').optional().trim().isLength({ max: 40 }),
    body('address').custom((address) => {
        if (!String(address.zipCode || address.postalCode || '').trim()) {
            throw new Error('zipCode is required');
        }
        return true;
    }),
    body('address.country').trim().notEmpty().isLength({ max: 120 }),
];

const operationalStatusValidator = [
    body('status').isIn(['ON_THE_WAY', 'DELIVERED', 'CANCELLED']),
    body('trackingNumber').optional().trim().isLength({ max: 120 }),
    body('note').optional().trim().isLength({ max: 1000 }),
];

router.post('/checkout', requireRole('owner'), checkoutValidator, ctrl.createStripeCheckoutSession);
router.post('/checkout/complete', requireRole('owner'), stripeCheckoutCompleteValidator, ctrl.completeStripeCheckoutSession);
router.get('/payments', query('platformStoreId').optional().isInt({ min: 1 }), ctrl.getPaymentHistory);
router.post('/referral-eligibility', requireRole('owner'), referralEligibilityValidator, ctrl.checkReferralEligibility);
router.post('/coupons/validate', couponValidator, ctrl.validateCoupon);
router.get('/coupons', ctrl.listCoupons);
router.get('/gifts', ctrl.listGifts);
router.get('/gifts/count', ctrl.getGiftNotificationCount);
router.get('/gifts/:id', ctrl.getGiftDetails);
router.patch('/gifts/:id/seen', ctrl.markGiftSeen);
router.put('/gifts/:id/address', addressValidator, ctrl.submitGiftAddress);
router.patch('/gifts/:id/decline', ctrl.declineGift);
router.patch('/gifts/:id/received', ctrl.confirmGiftReceived);
router.patch('/gifts/:id/status', operationalStatusValidator, ctrl.updateGiftOperationalStatus);

module.exports = router;

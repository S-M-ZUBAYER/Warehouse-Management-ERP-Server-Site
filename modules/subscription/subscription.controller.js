'use strict';

const { validationResult } = require('express-validator');
const service = require('./subscription.service');
const { sendSuccess, sendError } = require('../../utils/response');

const validationErrors = (req) =>
    validationResult(req).array().map((item) => ({ field: item.path, message: item.msg }));

const getPricing = async (req, res, next) => {
    try {
        const result = await service.getPricing(req.query);
        return sendSuccess(res, 'Pricing data fetched successfully', result);
    } catch (err) { next(err); }
};

const listAdminPlans = async (req, res, next) => {
    try {
        const result = await service.listAdminPlans();
        return sendSuccess(res, 'Plans fetched successfully', result);
    } catch (err) { next(err); }
};

const createPlan = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.upsertPlan(req.body);
        return sendSuccess(res, 'Plan created successfully', result, 201);
    } catch (err) { next(err); }
};

const updatePlan = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.upsertPlan(req.body, req.params.planId);
        return sendSuccess(res, 'Plan updated successfully', result);
    } catch (err) { next(err); }
};

const upsertPlanFeature = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.upsertPlanFeature(req.params.planId, req.body);
        return sendSuccess(res, 'Plan feature saved successfully', result);
    } catch (err) { next(err); }
};

const removePlanFeature = async (req, res, next) => {
    try {
        await service.removePlanFeature(req.params.planId, req.params.featureId);
        return sendSuccess(res, 'Plan feature removed successfully');
    } catch (err) { next(err); }
};

const upsertPlanTranslation = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.upsertPlanTranslation(req.params.planId, req.body);
        return sendSuccess(res, 'Plan translation saved successfully', result);
    } catch (err) { next(err); }
};

const upsertPlanPrice = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.upsertPlanPrice(req.params.planId, req.body);
        return sendSuccess(res, 'Plan price saved successfully', result);
    } catch (err) { next(err); }
};

const completeDemoCheckout = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.completeDemoCheckout(req.user, req.body);
        return sendSuccess(res, 'Demo payment completed successfully', result, 201);
    } catch (err) { next(err); }
};

const createStripeCheckoutSession = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.createStripeCheckoutSession(req.user, req.body);
        return sendSuccess(res, 'Stripe checkout session created successfully', result, 201);
    } catch (err) { next(err); }
};

const completeStripeCheckoutSession = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.completeStripeCheckoutSession(req.user, req.body);
        return sendSuccess(res, 'Stripe payment confirmed successfully', result);
    } catch (err) { next(err); }
};

const getPaymentHistory = async (req, res, next) => {
    try {
        const result = await service.getPaymentHistory(req.user, req.query);
        return sendSuccess(res, 'Payment history fetched successfully', result);
    } catch (err) { next(err); }
};

const validateCoupon = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.validateCoupon(req.user, req.body);
        return sendSuccess(res, 'Coupon validation completed', result);
    } catch (err) { next(err); }
};

const checkReferralEligibility = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.checkReferralEligibility(req.user, req.body);
        return sendSuccess(res, 'Referral eligibility checked successfully', result);
    } catch (err) { next(err); }
};

const listCoupons = async (req, res, next) => {
    try {
        const result = await service.listCoupons(req.user);
        return sendSuccess(res, 'Coupons fetched successfully', result);
    } catch (err) { next(err); }
};

const listGifts = async (req, res, next) => {
    try {
        const result = await service.listGifts(req.user);
        return sendSuccess(res, 'Gifts fetched successfully', result);
    } catch (err) { next(err); }
};

const getGiftDetails = async (req, res, next) => {
    try {
        const result = await service.assertGiftAccess(req.user, req.params.id);
        return sendSuccess(res, 'Gift fetched successfully', result);
    } catch (err) { next(err); }
};

const getGiftNotificationCount = async (req, res, next) => {
    try {
        const result = await service.getGiftNotificationCount(req.user);
        return sendSuccess(res, 'Gift notification count fetched successfully', result);
    } catch (err) { next(err); }
};

const markGiftSeen = async (req, res, next) => {
    try {
        const result = await service.markGiftSeen(req.user, req.params.id);
        return sendSuccess(res, 'Gift marked as seen', result);
    } catch (err) { next(err); }
};

const submitGiftAddress = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.submitGiftAddress(req.user, req.params.id, req.body.address);
        return sendSuccess(res, 'Gift address submitted successfully', result);
    } catch (err) { next(err); }
};

const declineGift = async (req, res, next) => {
    try {
        const result = await service.declineGift(req.user, req.params.id, req.body.note);
        return sendSuccess(res, 'Gift declined successfully', result);
    } catch (err) { next(err); }
};

const confirmGiftReceived = async (req, res, next) => {
    try {
        const result = await service.confirmGiftReceived(req.user, req.params.id);
        return sendSuccess(res, 'Gift receipt confirmed successfully', result);
    } catch (err) { next(err); }
};

const updateGiftOperationalStatus = async (req, res, next) => {
    try {
        const errors = validationErrors(req);
        if (errors.length) return sendError(res, 'Validation failed', 400, errors);
        const result = await service.updateGiftOperationalStatus(req.user, req.params.id, req.body.status, req.body);
        return sendSuccess(res, 'Gift status updated successfully', result);
    } catch (err) { next(err); }
};

module.exports = {
    getPricing,
    listAdminPlans,
    createPlan,
    updatePlan,
    upsertPlanFeature,
    removePlanFeature,
    upsertPlanTranslation,
    upsertPlanPrice,
    completeDemoCheckout,
    createStripeCheckoutSession,
    completeStripeCheckoutSession,
    getPaymentHistory,
    validateCoupon,
    checkReferralEligibility,
    listCoupons,
    listGifts,
    getGiftDetails,
    getGiftNotificationCount,
    markGiftSeen,
    submitGiftAddress,
    declineGift,
    confirmGiftReceived,
    updateGiftOperationalStatus,
};

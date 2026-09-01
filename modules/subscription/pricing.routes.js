'use strict';

const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../../middlewares/auth');
const ctrl = require('./subscription.controller');

const router = express.Router();

const planValidator = [
    body('name').trim().notEmpty().isLength({ max: 80 }),
    body('code').trim().notEmpty().isLength({ max: 40 }),
    body('isActive').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('durationDays').optional().isInt({ min: 0 }),
    body('isTrial').optional().isBoolean(),
    body('badgeLabel').optional().trim().isLength({ max: 60 }),
];

const featureValidator = [
    body('featureKey').optional().trim().isLength({ min: 1, max: 100 }),
    body('serialNo').optional().isInt({ min: 1 }),
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('translations').optional().isObject(),
    body('isActive').optional().isBoolean(),
];

const translationValidator = [
    body('language').trim().notEmpty().isLength({ max: 10 }),
    body('displayName').trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim(),
];

const priceValidator = [
    body('country').trim().notEmpty().isLength({ min: 2, max: 2 }),
    body('currency').trim().notEmpty().isLength({ min: 3, max: 3 }),
    body('amount').isFloat({ min: 0 }),
    body('compareAmount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('isAvailable').optional().isBoolean(),
];

router.get('/', ctrl.getPricing);
router.use('/admin', authenticate, requireRole('owner'));
router.get('/admin/plans', ctrl.listAdminPlans);
router.post('/admin/plans', planValidator, ctrl.createPlan);
router.put('/admin/plans/:planId', planValidator, ctrl.updatePlan);
router.post('/admin/plans/:planId/features', featureValidator, ctrl.upsertPlanFeature);
router.delete('/admin/plans/:planId/features/:featureId', ctrl.removePlanFeature);
router.post('/admin/plans/:planId/translations', translationValidator, ctrl.upsertPlanTranslation);
router.post('/admin/plans/:planId/prices', priceValidator, ctrl.upsertPlanPrice);

module.exports = router;

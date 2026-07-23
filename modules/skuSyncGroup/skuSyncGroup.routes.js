'use strict';
// ── skuSyncGroup.controller.js ────────────────────────────────────────────────
const service = require('./skuSyncGroup.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

const listGroups            = async (req, res, next) => { try { return sendSuccess(res, 'Sync groups', await service.listGroups(req.user)); } catch (e) { next(e); } };
const getGroup              = async (req, res, next) => { try { return sendSuccess(res, 'Sync group', await service.getGroup(req.user, parseInt(req.params.groupId, 10))); } catch (e) { next(e); } };
const getEligibleSecondaries = async (req, res, next) => { try { return sendSuccess(res, 'Eligible secondaries', await service.getEligibleSecondaries(req.user, req.query.primarySkuId)); } catch (e) { next(e); } };

const createGroup = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        return sendSuccess(res, 'Group created', await service.createGroup(req.user, req.body), 201);
    } catch (e) { next(e); }
};

const addMember = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        return sendSuccess(res, 'Member added', await service.addMember(req.user, parseInt(req.params.groupId, 10), req.body), 201);
    } catch (e) { next(e); }
};

const addMembersForPrimary = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        const r = await service.addMembersForPrimary(req.user, parseInt(req.params.primarySkuId, 10), req.body);
        return sendSuccess(res, r.message, r, 201);
    } catch (e) { next(e); }
};

const removeMember  = async (req, res, next) => { try { return sendSuccess(res, 'Member removed', await service.removeMember(req.user, parseInt(req.params.groupId, 10), parseInt(req.params.memberSkuId, 10))); } catch (e) { next(e); } };
const dissolveGroup = async (req, res, next) => { try { return sendSuccess(res, 'Group dissolved', await service.dissolveGroup(req.user, parseInt(req.params.groupId, 10))); } catch (e) { next(e); } };

// ── skuSyncGroup.routes.js ────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../../middlewares/auth');
const { body, query } = require('express-validator');

router.use(authenticate);

// GET /api/v1/sku-sync-groups
router.get('/', listGroups);

// GET /api/v1/sku-sync-groups/eligible-secondaries?primarySkuId=X
router.get(
    '/eligible-secondaries',
    [query('primarySkuId').notEmpty().isInt({ min: 1 }).toInt()],
    getEligibleSecondaries
);

// POST /api/v1/sku-sync-groups/primary/:primarySkuId/members
// Creates the group if needed, then links one or more child SKUs.
router.post(
    '/primary/:primarySkuId/members',
    requireRole('owner', 'admin', 'manager'),
    [
        body('secondarySkuIds').isArray({ min: 1 }).withMessage('Select at least one SKU'),
        body('secondarySkuIds.*').isInt({ min: 1 }).toInt(),
    ],
    addMembersForPrimary
);

// GET /api/v1/sku-sync-groups/:groupId
router.get('/:groupId', getGroup);

// POST /api/v1/sku-sync-groups
router.post(
    '/',
    requireRole('owner', 'admin', 'manager'),
    [
        body('primarySkuId').notEmpty().isInt({ min: 1 }).toInt(),
        body('name').optional().isString().trim().isLength({ max: 100 }),
    ],
    createGroup
);

// POST /api/v1/sku-sync-groups/:groupId/members
router.post(
    '/:groupId/members',
    requireRole('owner', 'admin', 'manager'),
    [body('secondarySkuId').notEmpty().isInt({ min: 1 }).toInt()],
    addMember
);

// DELETE /api/v1/sku-sync-groups/:groupId/members/:memberSkuId
router.delete('/:groupId/members/:memberSkuId', requireRole('owner', 'admin', 'manager'), removeMember);

// DELETE /api/v1/sku-sync-groups/:groupId
router.delete('/:groupId', requireRole('owner', 'admin', 'manager'), dissolveGroup);

module.exports = router;
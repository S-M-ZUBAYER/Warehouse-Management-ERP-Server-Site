'use strict';

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const ctrl = require('./platformStores.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

router.use(authenticate);

const createValidator = [
    body('platform').notEmpty().isIn(['shopee', 'tiktok', 'lazada']).withMessage('platform must be shopee, tiktok, or lazada'),
    body('storeName').trim().notEmpty().isLength({ min: 1, max: 255 }),
    body('externalStoreId').trim().notEmpty().isLength({ min: 1, max: 100 }),
    body('externalStoreName').optional().trim().isLength({ max: 255 }),
    body('region').optional().trim().isLength({ max: 10 }),
    body('defaultWarehouseId').optional().isInt({ min: 1 }),
    body('webhookSecret').optional().trim().isLength({ max: 255 }),
];

const updateValidator = [
    body('storeName').optional().trim().isLength({ min: 1, max: 255 }),
    body('externalStoreName').optional().trim().isLength({ max: 255 }),
    body('region').optional().trim().isLength({ max: 10 }),
    body('defaultWarehouseId').optional().isInt({ min: 1 }),
    body('isActive').optional().isBoolean(),
    body('webhookSecret').optional().trim(),
];

// GET  /api/v1/platform-stores
router.get('/', ctrl.getPlatformStores);

// GET  /api/v1/platform-stores/:id
router.get('/:id', ctrl.getPlatformStoreById);

// POST /api/v1/platform-stores
router.post('/', requireRole('owner', 'admin'), createValidator, ctrl.createPlatformStore);

// PUT  /api/v1/platform-stores/:id
router.put('/:id', requireRole('owner', 'admin'), updateValidator, ctrl.updatePlatformStore);

// PUT  /api/v1/platform-stores/:id/tokens  — Java calls this after OAuth refresh
router.put('/:id/tokens', ctrl.updateStoreTokens);

// DELETE /api/v1/platform-stores/:id
router.delete('/:id', requireRole('owner', 'admin'), ctrl.deletePlatformStore);

module.exports = router;
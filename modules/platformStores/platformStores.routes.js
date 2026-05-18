'use strict';

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const ctrl = require('./platformStores.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

const createValidator = [
    body('platform').notEmpty().isIn(['shopee', 'tiktok', 'lazada']).withMessage('platform must be shopee, tiktok, or lazada'),
    body('storeName').trim().notEmpty().isLength({ min: 1, max: 255 }),
    body('externalStoreId').trim().notEmpty().isLength({ min: 1, max: 100 }),
    body('externalStoreName').optional().trim().isLength({ max: 255 }),
    body('storeShopId').optional().trim().isLength({ max: 100 }),
    body('storeOpenId').optional().trim().isLength({ max: 100 }),
    body('storeCipher').optional().trim().isLength({ max: 255 }),
    body('region').optional().trim().isLength({ max: 10 }),
    body('defaultWarehouseId').optional().isInt({ min: 1 }),
    body('webhookSecret').optional().trim().isLength({ max: 255 }),
];

const updateValidator = [
    body('storeName').optional().trim().isLength({ min: 1, max: 255 }),
    body('externalStoreName').optional().trim().isLength({ max: 255 }),
    body('storeShopId').optional().trim().isLength({ max: 100 }),
    body('storeOpenId').optional().trim().isLength({ max: 100 }),
    body('storeCipher').optional().trim().isLength({ max: 255 }),
    body('region').optional().trim().isLength({ max: 10 }),
    body('defaultWarehouseId').optional().isInt({ min: 1 }),
    body('isActive').optional().isBoolean(),
    body('webhookSecret').optional().trim(),
];

const permissionsValidator = [
    body('permissions').optional().isArray().withMessage('permissions must be an array'),
    body('permissions.*.userId').optional().isInt({ min: 1 }).withMessage('userId must be a positive integer'),
    body('permissions.*.canView').optional().isBoolean().withMessage('canView must be boolean'),
    body('permissions.*.canEdit').optional().isBoolean().withMessage('canEdit must be boolean'),
    body('userIds').optional().isArray().withMessage('userIds must be an array'),
    body('userIds.*').optional().isInt({ min: 1 }).withMessage('userIds must contain positive integers'),
];

const byShopIdValidator = [
    query('platform').notEmpty().isIn(['shopee', 'tiktok', 'lazada']).withMessage('platform must be shopee, tiktok, or lazada'),
    query('storeShopId').trim().notEmpty().isLength({ min: 1, max: 100 }).withMessage('storeShopId is required'),
];

router.use(authenticate);

// GET  /api/v1/platform-stores
router.get('/', ctrl.getPlatformStores);

// GET /api/v1/platform-stores/by-shop-id?platform=shopee&storeShopId=123456
router.get('/by-shop-id', byShopIdValidator, ctrl.getPlatformStoreByShopId);

// GET /api/v1/platform-stores/:id/permissions
router.get('/:id/permissions', requireRole('owner'), ctrl.getStorePermissions);

// PUT /api/v1/platform-stores/:id/permissions
router.put('/:id/permissions', requireRole('owner'), permissionsValidator, ctrl.updateStorePermissions);

// GET  /api/v1/platform-stores/:id
router.get('/:id', ctrl.getPlatformStoreById);

// POST /api/v1/platform-stores
router.post('/', requireRole('owner'), createValidator, ctrl.createPlatformStore);

// PUT  /api/v1/platform-stores/:id
router.put('/:id', requireRole('owner'), updateValidator, ctrl.updatePlatformStore);

// PUT  /api/v1/platform-stores/:id/tokens  — Java calls this after OAuth refresh
router.put('/:id/tokens', ctrl.updateStoreTokens);

// DELETE /api/v1/platform-stores/:id
router.delete('/:id', requireRole('owner'), ctrl.deletePlatformStore);

module.exports = router;
module.exports.byShopIdValidator = byShopIdValidator;

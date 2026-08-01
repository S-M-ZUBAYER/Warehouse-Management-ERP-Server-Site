'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { body, query } = require('express-validator');
const ctrl = require('./platformManualOrders.controller');

const router = express.Router();
const uploadRoot = path.resolve(process.env.UPLOAD_PATH || './uploads');
const waybillDir = path.join(uploadRoot, 'platform-manual-waybills');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        fs.mkdirSync(waybillDir, { recursive: true });
        cb(null, waybillDir);
    },
    filename: (_req, file, cb) => {
        const safeOriginal = path.basename(file.originalname || 'waybill.pdf').replace(/[^A-Za-z0-9_.-]/g, '_');
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginal}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

const statusValues = ['Processed', 'On The Way', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

const createUpdateValidators = [
    body('warehouseId').notEmpty().withMessage('warehouseId is required'),
    body('orderNumber').notEmpty().withMessage('orderNumber is required').isLength({ max: 100 }),
    body('orderTime').notEmpty().withMessage('orderTime is required').isLength({ max: 10 }),
    body('orderDate').notEmpty().withMessage('orderDate is required').isISO8601(),
    body('logistic').notEmpty().withMessage('logistic is required'),
    body('sender').notEmpty().withMessage('sender is required'),
    body('buyer').notEmpty().withMessage('buyer is required'),
    body('products').notEmpty().withMessage('products is required'),
];

const updateValidators = [
    body('orderNumber').optional().notEmpty().withMessage('orderNumber is required').isLength({ max: 100 }),
    body('orderTime').optional().notEmpty().withMessage('orderTime is required').isLength({ max: 10 }),
    body('orderDate').optional().notEmpty().withMessage('orderDate is required').isISO8601(),
    body('logistic').optional().notEmpty().withMessage('logistic is required'),
    body('buyer').optional().notEmpty().withMessage('buyer is required'),
    body('package').optional(),
];

router.get('/', [
    query('companyId').notEmpty().withMessage('companyId is required'),
    query('warehouseId').optional(),
    query('statuses').optional().custom((value) => {
        const values = Array.isArray(value) ? value.flatMap((item) => String(item).split(',')) : String(value).split(',');
        const invalid = values.map((item) => item.trim()).filter(Boolean).find((status) => !statusValues.includes(status));
        if (invalid) throw new Error(`statuses must contain only: ${statusValues.join(', ')}`);
        return true;
    }),
    query('searchType').optional().isIn(['Single Search', 'Batch Search']),
    query('searchField').optional().isIn(['SKU', 'Order Number']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
], ctrl.listOrders);

router.post('/', upload.single('waybillFile'), createUpdateValidators, ctrl.createOrder);
router.put('/:id', upload.single('waybillFile'), updateValidators, ctrl.updateOrder);
router.patch('/:id/status', [
    body('shipmentStatus').notEmpty().withMessage('shipmentStatus is required').isIn(statusValues),
], ctrl.updateStatus);
router.delete('/:id', ctrl.deleteOrder);

module.exports = router;

'use strict';

const express = require('express');
const { body } = require('express-validator');

const ctrl = require('./autoOrderAccept.controller');

const router = express.Router();

const runNowValidator = [
    body('platform').optional().isIn(['all', 'shopee', 'tiktok']).withMessage('platform must be all, shopee, or tiktok'),
    body('storeId').optional().custom((value) => {
        if (String(value).toLowerCase() === 'all') return true;
        const id = Number(value);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error('storeId must be a positive integer or all');
        }
        return true;
    }),
];

router.post('/run-now', runNowValidator, ctrl.runNow);

module.exports = router;

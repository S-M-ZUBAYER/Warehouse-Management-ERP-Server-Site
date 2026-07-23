'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./dashboard.controller');
const { authenticate } = require('../../middlewares/auth');

router.use(authenticate);

// GET /api/v1/dashboard/summary
router.get('/summary', ctrl.getSummary);

// GET /api/v1/dashboard/inventory-status?year=2026&month=5
router.get('/inventory-status', ctrl.getInventoryStatus);

// GET /api/v1/dashboard/sales-trends?year=2026&month=5&platform=tiktok
router.get('/sales-trends', ctrl.getSalesTrends);

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('./inbound.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createInboundValidator,
    shipInboundValidator,
    receiveInboundValidator,
    listInboundValidator,
} = require('./inbound.validator');

router.use(authenticate);

// GET /api/v1/inbound/dropdowns    — warehouses + currencies
router.get('/dropdowns', ctrl.getDropdowns);

// GET /api/v1/inbound/picker       — SKU search picker when adding lines to draft
router.get('/picker', ctrl.getSkuPicker);

// GET /api/v1/inbound              — list with filters
router.get('/', listInboundValidator, ctrl.getInboundOrders);

// GET /api/v1/inbound/:id          — single detail
router.get('/:id', ctrl.getInboundOrderById);

// POST /api/v1/inbound             — create draft
router.post('/', requireRole('owner', 'admin', 'manager'), createInboundValidator, ctrl.createInboundOrder);

// PUT /api/v1/inbound/:id          — update draft (fields + lines)
router.put('/:id', requireRole('owner', 'admin', 'manager'), ctrl.updateDraftInbound);

// PUT /api/v1/inbound/:id/ship     — confirm draft → on_the_way
router.put('/:id/ship', requireRole('owner', 'admin', 'manager'), shipInboundValidator, ctrl.shipInboundOrder);

// PUT /api/v1/inbound/:id/receive  — warehouse receives → completed + stock update
router.put('/:id/receive', requireRole('owner', 'admin', 'manager', 'warehouse'), receiveInboundValidator, ctrl.receiveInboundOrder);

// PUT /api/v1/inbound/:id/cancel   — cancel (draft or on_the_way only)
router.put('/:id/cancel', requireRole('owner', 'admin', 'manager'), ctrl.cancelInboundOrder);

module.exports = router;


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
    createManualInboundValidator,
} = require('./inbound.validator');

router.use(authenticate);

// GET /api/v1/inbound/dropdowns    — warehouses + currencies
router.get('/dropdowns', ctrl.getDropdowns);

// GET /api/v1/inbound/picker       — SKU search picker when adding lines to draft
router.get('/picker', ctrl.getSkuPicker);

// GET /api/v1/inbound/manual       — list manual inbound receipts only
router.get('/manual', ctrl.getManualInboundOrders);

// POST /api/v1/inbound/manual      — create manual inbound receipt (direct → completed)
router.post('/manual', createManualInboundValidator, ctrl.createManualInbound);

// GET /api/v1/inbound              — list with filters
router.get('/', listInboundValidator, ctrl.getInboundOrders);

// GET /api/v1/inbound/:id          — single detail
router.get('/:id', ctrl.getInboundOrderById);

// POST /api/v1/inbound             — create draft
router.post('/', createInboundValidator, ctrl.createInboundOrder);

// PUT /api/v1/inbound/:id          — update draft (fields + lines)
router.put('/:id', ctrl.updateDraftInbound);

// PUT /api/v1/inbound/:id/ship     — confirm draft → on_the_way
router.put('/:id/ship', shipInboundValidator, ctrl.shipInboundOrder);

// PUT /api/v1/inbound/:id/receive  — warehouse receives → completed + stock update
router.put('/:id/receive', requireRole('owner', 'admin', 'manager', 'warehouse'), receiveInboundValidator, ctrl.receiveInboundOrder);

// PUT /api/v1/inbound/:id/cancel   — cancel (draft or on_the_way only)
router.put('/:id/cancel', ctrl.cancelInboundOrder);

module.exports = router;

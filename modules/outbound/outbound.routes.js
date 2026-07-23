'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./outbound.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createOutboundValidator,
    updateOutboundValidator,
    shipOutboundValidator,
    receiveOutboundValidator,
    listOutboundValidator,
} = require('./outbound.validator');

router.use(authenticate);

router.get('/dropdowns', ctrl.getDropdowns);
router.get('/picker', ctrl.getSkuPicker);
router.get('/', listOutboundValidator, ctrl.getOutboundOrders);
router.get('/:id', ctrl.getOutboundOrderById);
router.post('/', requireRole('owner', 'admin', 'manager'), createOutboundValidator, ctrl.createOutboundOrder);
router.put('/:id', requireRole('owner', 'admin', 'manager'), updateOutboundValidator, ctrl.updateDraftOutbound);
router.delete('/:id', requireRole('owner', 'admin', 'manager'), ctrl.deleteDraftOutbound);
router.put('/:id/ship', requireRole('owner', 'admin', 'manager'), shipOutboundValidator, ctrl.shipOutboundOrder);
router.put('/:id/receive', requireRole('owner', 'admin', 'manager', 'warehouse'), receiveOutboundValidator, ctrl.receiveOutboundOrder);

module.exports = router;
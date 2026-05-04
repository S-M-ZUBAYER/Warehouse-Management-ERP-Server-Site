'use strict';

const express = require('express');
const router = express.Router();

const warehouseController = require('./warehouses.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createWarehouseValidator,
    updateWarehouseValidator,
    listWarehouseValidator,
} = require('./warehouses.validator');

// All warehouse routes require authentication
router.use(authenticate);

// GET  /api/v1/warehouses          — list all warehouses for company
router.get('/', listWarehouseValidator, warehouseController.getWarehouses);

// GET  /api/v1/warehouses/:id      — get single warehouse
router.get('/:id', warehouseController.getWarehouseById);

// POST /api/v1/warehouses          — create warehouse (owner/admin only)
router.post('/', requireRole('owner', 'admin'), createWarehouseValidator, warehouseController.createWarehouse);

// PUT  /api/v1/warehouses/:id      — update warehouse (owner/admin only)
router.put('/:id', requireRole('owner', 'admin'), updateWarehouseValidator, warehouseController.updateWarehouse);

// DELETE /api/v1/warehouses/:id    — delete warehouse (owner/admin only)
router.delete('/:id', requireRole('owner', 'admin'), warehouseController.deleteWarehouse);

// PATCH /api/v1/warehouses/:id/set-default  — set as default (owner/admin only)
router.patch('/:id/set-default', requireRole('owner', 'admin'), warehouseController.setDefaultWarehouse);

module.exports = router;
'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../auth/auth.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createSubAccountValidator,
    upsertSubAccountValidator,
    updateSubAccountValidator,
} = require('../auth/auth.validator');

// All routes below require authentication
router.use(authenticate);

// GET  /api/v1/users          — list sub accounts
router.get('/', authController.getSubAccounts);

// POST /api/v1/users          — create sub account (owner/admin only)
router.post('/', requireRole('owner'), createSubAccountValidator, authController.createSubAccount);

// GET  /api/v1/users/:id      — get single sub account
router.get('/:id', authController.getSubAccountById);

// PUT  /api/v1/users/:id      — update sub account (owner/admin only)
router.put('/:id', requireRole('owner'), updateSubAccountValidator, authController.updateSubAccount);

// Post  /api/v1/users/upsert      — update sub account (owner/admin only)
router.post('/upsert', requireRole('owner'), upsertSubAccountValidator, authController.upsertSubAccount);

// DELETE /api/v1/users/:id   — delete sub account (owner/admin only)
router.delete('/:id', requireRole('owner'), authController.deleteSubAccount);

module.exports = router;



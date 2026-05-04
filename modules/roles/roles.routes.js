'use strict';

const express = require('express');
const router = express.Router();

const rolesController = require('./roles.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createRoleValidator,
    updateRoleValidator,
    listRolesValidator,
} = require('./roles.validator');

// All routes require authentication
router.use(authenticate);

// GET  /api/v1/roles/permissions/template
// ⚠️  Must be BEFORE /:id route or Express matches 'permissions' as an id
router.get('/permissions/template', rolesController.getPermissionTemplate);

// GET  /api/v1/roles          — list all roles (all authenticated users)
router.get('/', listRolesValidator, rolesController.getRoles);

// GET  /api/v1/roles/:id      — get single role
router.get('/:id', rolesController.getRoleById);

// POST /api/v1/roles          — create role (owner/admin only)
router.post('/', requireRole('owner', 'admin'), createRoleValidator, rolesController.createRole);

// PUT  /api/v1/roles/:id      — update role (owner/admin only)
router.put('/:id', requireRole('owner', 'admin'), updateRoleValidator, rolesController.updateRole);

// PATCH /api/v1/roles/:id/permissions  — update only permissions (owner/admin only)
router.patch('/:id/permissions', requireRole('owner', 'admin'), rolesController.updatePermissions);

// DELETE /api/v1/roles/:id   — delete role (owner/admin only)
router.delete('/:id', requireRole('owner', 'admin'), rolesController.deleteRole);

module.exports = router;
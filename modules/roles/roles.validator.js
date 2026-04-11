'use strict';
const { body, query } = require('express-validator');

// ─── Permission pages visible in UI (from the Add Role modal) ────────────────
const VALID_PAGES = [
    'dashboard',
    'product_management',
    'inventory_management',
    'order_management',
    'warehouse_management',
    'system_configuration',
];

const createRoleValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Role name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Role name must be 2–100 characters'),

    body('description')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 500 }).withMessage('Description max 500 characters'),

    // permissions: object with page keys
    // e.g. { dashboard: { access: true }, product_management: { access: true, sub: { merchant_sku: true } } }
    body('permissions')
        .optional({ values: 'falsy' })
        .isObject().withMessage('Permissions must be an object'),

    body('permissions.dashboard')
        .optional({ values: 'falsy' })
        .isObject().withMessage('dashboard permission must be an object'),

    body('permissions.product_management')
        .optional({ values: 'falsy' })
        .isObject().withMessage('product_management permission must be an object'),

    body('permissions.inventory_management')
        .optional({ values: 'falsy' })
        .isObject().withMessage('inventory_management permission must be an object'),

    body('permissions.order_management')
        .optional({ values: 'falsy' })
        .isObject().withMessage('order_management permission must be an object'),

    body('permissions.warehouse_management')
        .optional({ values: 'falsy' })
        .isObject().withMessage('warehouse_management permission must be an object'),

    body('permissions.system_configuration')
        .optional({ values: 'falsy' })
        .isObject().withMessage('system_configuration permission must be an object'),

    body('subAccountLinkingStatus')
        .optional({ values: 'falsy' })
        .isIn(['linked', 'not_linked']).withMessage('subAccountLinkingStatus must be linked or not_linked'),
];

const updateRoleValidator = [
    body('name')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Role name must be 2–100 characters'),

    body('description')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 500 }).withMessage('Description max 500 characters'),

    body('permissions')
        .optional({ values: 'falsy' })
        .isObject().withMessage('Permissions must be an object'),

    body('subAccountLinkingStatus')
        .optional({ values: 'falsy' })
        .isIn(['linked', 'not_linked']).withMessage('subAccountLinkingStatus must be linked or not_linked'),
];

const listRolesValidator = [
    query('page')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit')
        .optional({ values: 'falsy' })
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),

    query('search')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 100 }),

    query('subAccountLinkingStatus')
        .optional({ values: 'falsy' })
        .isIn(['linked', 'not_linked']).withMessage('Invalid linking status filter'),
];

module.exports = {
    createRoleValidator,
    updateRoleValidator,
    listRolesValidator,
    VALID_PAGES,
};
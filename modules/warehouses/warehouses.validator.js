'use strict';
const { body, query } = require('express-validator');

const createWarehouseValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Warehouse name is required')
        .isLength({ min: 2, max: 150 }).withMessage('Name must be 2–150 characters'),

    body('attribute')
        .notEmpty().withMessage('Warehouse attribute is required')
        .isIn(['own_warehouse', 'third_party_warehouse'])
        .withMessage('Attribute must be own_warehouse or third_party_warehouse'),

    body('managerName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Manager name max 100 characters'),

    body('phone')
        .optional()
        .trim()
        .isLength({ max: 30 }).withMessage('Phone max 30 characters'),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Location max 500 characters'),

    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('City max 100 characters'),

    body('country')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Country max 100 characters'),

    body('status')
        .optional()
        .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
];

const updateWarehouseValidator = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 150 }).withMessage('Name must be 2–150 characters'),

    body('attribute')
        .optional()
        .isIn(['own_warehouse', 'third_party_warehouse'])
        .withMessage('Attribute must be own_warehouse or third_party_warehouse'),

    body('managerName')
        .optional()
        .trim()
        .isLength({ max: 100 }),

    body('phone')
        .optional()
        .trim()
        .isLength({ max: 30 }),

    body('location')
        .optional()
        .trim()
        .isLength({ max: 500 }),

    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 }),

    body('country')
        .optional()
        .trim()
        .isLength({ max: 100 }),

    body('status')
        .optional()
        .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
];

const listWarehouseValidator = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

    query('status')
        .optional()
        .isIn(['active', 'inactive']).withMessage('Invalid status filter'),

    query('attribute')
        .optional()
        .isIn(['own_warehouse', 'third_party_warehouse']).withMessage('Invalid attribute filter'),
];

module.exports = {
    createWarehouseValidator,
    updateWarehouseValidator,
    listWarehouseValidator,
};
const { body } = require('express-validator');

const registerAdminValidator = [
    body('userName')
        .trim()
        .notEmpty().withMessage('User name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

    body('userEmail')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('userPassword')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),

    // Optional fields
    body('companyName')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 150 }).withMessage('Company name max 150 characters'),

    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isMobilePhone().withMessage('Invalid phone number'),

    body('timezone')
        .optional({ values: 'falsy' })
        .trim(),

    body('currency')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code like USD'),

    body('avatar')
        .optional({ values: 'falsy' })
        .custom((val) => { if (val && typeof val !== 'string') throw new Error('Avatar must be a string'); return true; }),
];

const loginValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required'),
];

const refreshTokenValidator = [
    body('refreshToken')
        .notEmpty().withMessage('Refresh token is required'),
];

const forgotPasswordValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
];

const resetPasswordValidator = [
    body('token')
        .notEmpty().withMessage('Reset token is required'),

    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Must contain at least one number'),
];

// ─── Sub Account Validators ───────────────────────────────────────────────────

const createSubAccountValidator = [
    body('accountId')
        .trim()
        .notEmpty().withMessage('Account ID is required')
        .isLength({ min: 2, max: 50 }).withMessage('Account ID must be 2–50 characters'),

    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Must contain at least one number'),

    body('roleId')
        .notEmpty().withMessage('Role is required')
        .isInt({ min: 1 }).withMessage('Invalid role ID'),

    body('warehouseId')
        .notEmpty().withMessage('Warehouse is required')
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),

    body('department')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 100 }).withMessage('Department max 100 characters'),

    body('designation')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 100 }).withMessage('Designation max 100 characters'),

    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isMobilePhone().withMessage('Invalid phone number'),

    body('address')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 255 }).withMessage('Address max 255 characters'),

    body('avatar')
        .optional({ values: 'falsy' })
        .custom((val) => { if (val && typeof val !== 'string') throw new Error('Avatar must be a string'); return true; }),

    // Store permissions: array of connection IDs
    body('storePermissions')
        .optional({ values: 'falsy' })
        .isArray().withMessage('Store permissions must be an array'),

    body('storePermissions.*.connectionId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid connection ID'),

    body('storePermissions.*.canView')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('storePermissions.*.canEdit')
        .optional({ values: 'falsy' })
        .isBoolean(),

    // Warehouse permissions: array of warehouse IDs
    body('warehousePermissions')
        .optional({ values: 'falsy' })
        .isArray().withMessage('Warehouse permissions must be an array'),

    body('warehousePermissions.*.warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),

    body('warehousePermissions.*.canView')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('warehousePermissions.*.canEdit')
        .optional({ values: 'falsy' })
        .isBoolean(),
];

const updateSubAccountValidator = [
    body('name')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

    body('roleId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid role ID'),

    body('department')
        .optional({ values: 'falsy' })
        .trim(),

    body('designation')
        .optional({ values: 'falsy' })
        .trim(),

    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isMobilePhone().withMessage('Invalid phone number'),

    body('address')
        .optional({ values: 'falsy' })
        .trim(),

    body('avatar')
        .optional({ values: 'falsy' })
        .custom((val) => { if (val && typeof val !== 'string') throw new Error('Avatar must be a string'); return true; }),

    body('isActive')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('storePermissions')
        .optional({ values: 'falsy' })
        .isArray(),

    body('warehousePermissions')
        .optional({ values: 'falsy' })
        .isArray(),
];

const upsertSubAccountValidator = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email address')
        .normalizeEmail(),

    body('accountId')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Account ID must be 1–50 characters'),

    body('name')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

    body('password')
        .optional({ values: 'falsy' })
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

    body('roleId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid role ID'),

    body('warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Invalid warehouse ID'),

    body('department')
        .optional({ values: 'falsy' })
        .trim(),

    body('designation')
        .optional({ values: 'falsy' })
        .trim(),

    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isMobilePhone().withMessage('Invalid phone number'),

    body('address')
        .optional({ values: 'falsy' })
        .trim(),

    body('avatar')
        .optional({ values: 'falsy' })
        .custom((val) => {
            if (val && typeof val !== 'string') throw new Error('Avatar must be a base64 string');
            return true;
        }),

    body('isActive')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('isActive must be a boolean'),

    body('storePermissions')
        .optional({ values: 'falsy' })
        .isArray().withMessage('storePermissions must be an array'),

    body('storePermissions.*.connectionId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Each store permission must have a valid connectionId'),

    body('storePermissions.*.canView')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('storePermissions.*.canEdit')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('warehousePermissions')
        .optional({ values: 'falsy' })
        .isArray().withMessage('warehousePermissions must be an array'),

    body('warehousePermissions.*.warehouseId')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Each warehouse permission must have a valid warehouseId'),

    body('warehousePermissions.*.canView')
        .optional({ values: 'falsy' })
        .isBoolean(),

    body('warehousePermissions.*.canEdit')
        .optional({ values: 'falsy' })
        .isBoolean(),
];


module.exports = {
    registerAdminValidator,
    loginValidator,
    refreshTokenValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    createSubAccountValidator,
    updateSubAccountValidator,
    upsertSubAccountValidator,
};
'use strict';

/**
 * Allows only the company owner (is_owner = true) to proceed.
 * Must be used AFTER the authenticate middleware so req.user is populated.
 *
 * Usage:
 *   router.post('/users/upsert', authenticate, ownerOnly, validate, ctrl.upsertUser)
 */
const ownerOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    if (!req.user.is_owner) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Only the company owner can manage subaccounts.',
        });
    }

    next();
};

module.exports = { ownerOnly };
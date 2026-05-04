'use strict';

/**
 * Permission-based authorization middleware.
 * Usage: router.get('/', authorize('warehouse.view'), ctrl.list)
 *
 * Permissions are stored as a JSON array on the Role model:
 * e.g. ["warehouse.view", "warehouse.create", "warehouse.edit", "warehouse.delete"]
 *
 * Super-admin (role.name === 'super_admin') bypasses all permission checks.
 */
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthenticated' });
        }

        const role = user.role;
        if (!role) {
            return res.status(403).json({ success: false, message: 'No role assigned' });
        }

        // Super admin bypasses all checks
        if (role.name === 'super_admin') return next();

        // Parse permissions (stored as JSON string or already parsed array)
        let permissions = [];
        try {
            permissions = typeof role.permissions === 'string'
                ? JSON.parse(role.permissions)
                : role.permissions || [];
        } catch {
            permissions = [];
        }

        const hasAll = requiredPermissions.every((perm) => permissions.includes(perm));
        if (!hasAll) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permission: ${requiredPermissions.join(', ')}`,
            });
        }

        next();
    };
};

module.exports = { authorize };
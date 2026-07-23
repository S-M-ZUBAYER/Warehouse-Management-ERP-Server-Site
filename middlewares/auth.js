'use strict';

const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { sendError } = require('../utils/response');
const { parsePermissions } = require('../utils/permissions');

// ─── Authenticate — verify JWT + check blacklist + check session ──────────────

const authenticate = async (req, res, next) => {
    if (req.user) return next();
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided. Please log in.', 401);
        }

        const token = authHeader.split(' ')[1];

        const isBlacklisted = await redis.exists(`blacklist:${token}`);
        if (isBlacklisted) {
            return sendError(res, 'Token has been invalidated. Please log in again.', 401);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return sendError(res, 'Token expired. Please refresh your token.', 401);
            }
            return sendError(res, 'Invalid token.', 401);
        }

        const sessionKey = `company:${decoded.companyId}:session:${decoded.userId}`;
        const session = await redis.get(sessionKey);
        if (!session) {
            return sendError(res, 'Session expired. Please log in again.', 401);
        }

        // Load current user + current role permissions on every request so role
        // permission changes apply immediately after the owner edits a role.
        const { User, Role } = require('../models');
        const dbUser = await User.findOne({
            where: { id: decoded.userId, company_id: decoded.companyId, is_active: true },
            attributes: ['id', 'company_id', 'role_id', 'name', 'email', 'role', 'avatar_url'],
            include: [{ model: Role, as: 'roleInfo', attributes: ['id', 'name', 'permissions'] }],
        });

        if (!dbUser) {
            return sendError(res, 'User account not found or inactive.', 401);
        }

        const roleName = String(dbUser.role || dbUser.roleInfo?.name || decoded.role || '').toLowerCase();
        const rolePermissions = parsePermissions(dbUser.roleInfo?.permissions);

        req.user = {
            userId: dbUser.id,
            companyId: dbUser.company_id,
            role: roleName,
            roleId: dbUser.role_id,
            roleName: dbUser.roleInfo?.name || dbUser.role,
            email: dbUser.email,
            name: dbUser.name,
            avatarUrl: dbUser.avatar_url,
            is_owner: roleName === 'owner',
            isOwner: roleName === 'owner',
            permissions: rolePermissions,
        };

        next();
    } catch (err) {
        next(err);
    }
};

// ─── Require Role — use after authenticate ────────────────────────────────────

const requireRole = (...roles) => {
    const allowedRoles = roles.map((role) => String(role || '').toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'Unauthorized', 401);
        }

        const currentRole = String(req.user.role || '').toLowerCase();

        if (!allowedRoles.includes(currentRole)) {
            return sendError(
                res,
                `Access denied. Required role: ${roles.join(' or ')}`,
                403
            );
        }

        next();
    };
};

// ─── Require Company Status — blocks suspended companies ──────────────────────

const requireActiveCompany = async (req, res, next) => {
    try {
        const { Company } = require('../models');

        const company = await Company.findByPk(req.user.companyId, {
            attributes: ['id', 'status'],
        });

        if (!company || company.status === 'suspended') {
            return sendError(res, 'Company account is suspended. Contact support.', 403);
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { authenticate, requireRole, requireActiveCompany };

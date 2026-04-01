'use strict';

const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { sendError } = require('../utils/response');

// ─── Authenticate — verify JWT + check blacklist + check session ──────────────

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided. Please log in.', 401);
        }

        const token = authHeader.split(' ')[1];

        // Check token blacklist (logout tokens)
        const isBlacklisted = await redis.exists(`blacklist:${token}`);
        if (isBlacklisted) {
            return sendError(res, 'Token has been invalidated. Please log in again.', 401);
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return sendError(res, 'Token expired. Please refresh your token.', 401);
            }
            return sendError(res, 'Invalid token.', 401);
        }

        // Check session still active in Redis
        const sessionKey = `company:${decoded.companyId}:session:${decoded.userId}`;
        const session = await redis.get(sessionKey);
        if (!session) {
            return sendError(res, 'Session expired. Please log in again.', 401);
        }

        // Attach user context to request
        req.user = {
            userId: decoded.userId,
            companyId: decoded.companyId,
            role: decoded.role,
            email: decoded.email,
        };

        next();
    } catch (err) {
        next(err);
    }
};

// ─── Require Role — use after authenticate ────────────────────────────────────

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'Unauthorized', 401);
        }

        if (!roles.includes(req.user.role)) {
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
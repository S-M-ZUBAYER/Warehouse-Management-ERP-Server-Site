'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateAccessToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

const generateRefreshToken = (payload) =>
    jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

const hashPassword = async (password) => bcrypt.hash(password, 12);

const comparePassword = async (plain, hashed) => bcrypt.compare(plain, hashed);

// Redis key helpers
const sessionKey = (companyId, userId) => `company:${companyId}:session:${userId}`;
const blacklistKey = (token) => `blacklist:${token}`;

// ─── Register Admin (Company Owner) ──────────────────────────────────────────

const registerAdmin = async (data) => {
    const { User, Company, Role } = require('../../models');

    const { userName, userEmail, userPassword, companyName, phone, timezone, currency, avatar } = data;

    // Check email uniqueness globally
    const existingUser = await User.findOne({ where: { email: userEmail } });
    if (existingUser) {
        const err = new Error('Email already registered');
        err.statusCode = 409;
        throw err;
    }

    // Use transaction — company + user + default role must all succeed or all fail
    const result = await sequelize.transaction(async (t) => {

        // 1. Create the company (slug from email prefix + uuid snippet)
        const slugBase = (companyName || userName)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 40);
        const slug = `${slugBase}-${uuidv4().substring(0, 8)}`;

        const company = await Company.create({
            name: companyName || userName,
            slug,
            email: userEmail,
            phone: phone || null,
            timezone: timezone || 'UTC',
            currency: currency || 'USD',
            plan: 'trial',
            status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        }, { transaction: t });

        // 2. Create default Owner role for this company
        const ownerRole = await Role.create({
            company_id: company.id,
            name: 'Owner',
            description: 'Full access — company owner',
            permissions: JSON.stringify({
                dashboard: true, users: true, roles: true, warehouses: true,
                platforms: true, products: true, inventory: true,
                inbound: true, orders: true, reports: true, settings: true,
            }),
        }, { transaction: t });

        // 3. Create the admin user
        const hashedPassword = await hashPassword(userPassword);

        let avatarUrl = null;
        if (avatar) {
            // Store base64 as data URI — in production swap with S3 upload
            avatarUrl = `data:image/jpeg;base64,${avatar}`;
        }

        const user = await User.create({
            company_id: company.id,
            name: userName,
            email: userEmail,
            password: hashedPassword,
            role: 'owner',
            role_id: ownerRole.id,
            avatar_url: avatarUrl,
            account_id: `ADM-${company.id.toString().padStart(6, '0')}`,
            is_active: true,
        }, { transaction: t });

        return { company, user };
    });

    // 4. Generate tokens
    const tokenPayload = {
        userId: result.user.id,
        companyId: result.company.id,
        role: 'owner',
        email: userEmail,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 5. Cache session in Redis
    await redis.set(
        sessionKey(result.company.id, result.user.id),
        JSON.stringify({ userId: result.user.id, companyId: result.company.id, role: 'owner' }),
        { EX: 30 * 24 * 60 * 60 } // 30 days
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            accountId: result.user.account_id,
            avatarUrl: result.user.avatar_url,
            companyId: result.company.id,
            companyName: result.company.name,
            companySlug: result.company.slug,
            plan: result.company.plan,
        },
    };
};

// ─── Login (Admin + Sub Account — same endpoint) ─────────────────────────────

const login = async ({ email, password }) => {
    const { User, Company } = require('../../models');

    const user = await User.findOne({
        where: { email },
        include: [{
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'slug', 'plan', 'status', 'trial_ends_at'],
        }],
    });

    if (!user) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    if (!user.is_active) {
        const err = new Error('Your account has been deactivated. Contact your admin.');
        err.statusCode = 403;
        throw err;
    }

    if (user.company.status === 'suspended') {
        const err = new Error('Company account suspended. Please contact support.');
        err.statusCode = 403;
        throw err;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    const tokenPayload = {
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
        email: user.email,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Cache session
    await redis.set(
        sessionKey(user.company_id, user.id),
        JSON.stringify({ userId: user.id, companyId: user.company_id, role: user.role }),
        { EX: 30 * 24 * 60 * 60 }
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            accountId: user.account_id,
            avatarUrl: user.avatar_url,
            department: user.department,
            designation: user.designation,
            companyId: user.company_id,
            companyName: user.company.name,
            companySlug: user.company.slug,
            plan: user.company.plan,
            trialEndsAt: user.company.trial_ends_at,
        },
    };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = async ({ userId, companyId, accessToken }) => {
    // Remove session from Redis
    await redis.del(sessionKey(companyId, userId));

    // Blacklist the access token until it expires naturally
    const decoded = jwt.decode(accessToken);
    if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await redis.set(blacklistKey(accessToken), '1', { EX: ttl });
        }
    }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

const refreshAccessToken = async ({ refreshToken }) => {
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
        const err = new Error('Invalid or expired refresh token');
        err.statusCode = 401;
        throw err;
    }

    // Check session still exists in Redis
    const session = await redis.get(sessionKey(decoded.companyId, decoded.userId));
    if (!session) {
        const err = new Error('Session expired. Please log in again.');
        err.statusCode = 401;
        throw err;
    }

    const newAccessToken = generateAccessToken({
        userId: decoded.userId,
        companyId: decoded.companyId,
        role: decoded.role,
        email: decoded.email,
    });

    return { accessToken: newAccessToken };
};

// ─── Create Sub Account (admin only) ─────────────────────────────────────────

const createSubAccount = async (adminUser, data) => {
    const models = require('../../models');
    const { User, Role, UserStorePermission, UserWarehousePermission } = models;
    const Warehouse = models.Warehouse || null;
    const PlatformConnection = models.PlatformConnection || null;

    const {
        accountId, name, email, password, roleId, warehouseId,
        department, designation, phone, address, avatar,
        storePermissions = [], warehousePermissions = [],
    } = data;

    // Only owner/admin can create sub accounts
    if (!['owner', 'admin'].includes(adminUser.role)) {
        const err = new Error('You do not have permission to create sub accounts');
        err.statusCode = 403;
        throw err;
    }

    // Check email unique within company
    const existing = await User.findOne({
        where: { company_id: adminUser.companyId, email },
    });
    if (existing) {
        const err = new Error('Email already in use within this company');
        err.statusCode = 409;
        throw err;
    }

    // Check accountId unique within company
    const existingAccountId = await User.findOne({
        where: { company_id: adminUser.companyId, account_id: accountId },
    });
    if (existingAccountId) {
        const err = new Error('Account ID already in use');
        err.statusCode = 409;
        throw err;
    }

    // Validate role belongs to this company
    const role = await Role.findOne({
        where: { id: roleId, company_id: adminUser.companyId },
    });
    if (!role) {
        const err = new Error('Invalid role for this company');
        err.statusCode = 400;
        throw err;
    }

    // Validate warehouse belongs to this company (skip if model not loaded yet)
    if (Warehouse) {
        const warehouse = await Warehouse.findOne({
            where: { id: warehouseId, company_id: adminUser.companyId },
        });
        if (!warehouse) {
            const err = new Error('Invalid warehouse for this company');
            err.statusCode = 400;
            throw err;
        }
    }

    const result = await sequelize.transaction(async (t) => {
        const hashedPassword = await hashPassword(password);

        let avatarUrl = null;
        if (avatar) {
            avatarUrl = `data:image/jpeg;base64,${avatar}`;
        }

        // Create user
        const user = await User.create({
            company_id: adminUser.companyId,
            name,
            email,
            password: hashedPassword,
            role: role.name.toLowerCase(),
            role_id: roleId,
            account_id: accountId,
            department: department || null,
            designation: designation || null,
            phone: phone || null,
            address: address || null,
            avatar_url: avatarUrl,
            is_active: true,
        }, { transaction: t });

        // Store permissions
        if (storePermissions.length > 0) {
            // Validate all connectionIds belong to this company
            const connectionIds = storePermissions.map(p => p.connectionId);
            if (PlatformConnection) {
                const validConnections = await PlatformConnection.count({
                    where: { id: { [Op.in]: connectionIds }, company_id: adminUser.companyId },
                });
                if (validConnections !== connectionIds.length) {
                    const err = new Error('One or more store connections are invalid');
                    err.statusCode = 400;
                    throw err;
                }
            }

            await UserStorePermission.bulkCreate(
                storePermissions.map(p => ({
                    company_id: adminUser.companyId,
                    user_id: user.id,
                    connection_id: p.connectionId,
                    can_view: p.canView !== false,
                    can_edit: p.canEdit || false,
                })),
                { transaction: t }
            );
        }

        // Warehouse permissions
        if (warehousePermissions.length > 0) {
            const whIds = warehousePermissions.map(p => p.warehouseId);
            if (Warehouse) {
                const validWarehouses = await Warehouse.count({
                    where: { id: { [Op.in]: whIds }, company_id: adminUser.companyId },
                });
                if (validWarehouses !== whIds.length) {
                    const err = new Error('One or more warehouse IDs are invalid');
                    err.statusCode = 400;
                    throw err;
                }
            }

            await UserWarehousePermission.bulkCreate(
                warehousePermissions.map(p => ({
                    company_id: adminUser.companyId,
                    user_id: user.id,
                    warehouse_id: p.warehouseId,
                    can_view: p.canView !== false,
                    can_edit: p.canEdit || false,
                })),
                { transaction: t }
            );
        }

        return user;
    });

    // Invalidate company users cache
    await redis.flushByPattern(`company:${adminUser.companyId}:cache:users*`);

    return {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        accountId: result.account_id,
        department: result.department,
        designation: result.designation,
        phone: result.phone,
        avatarUrl: result.avatar_url,
        isActive: result.is_active,
        companyId: adminUser.companyId,
    };
};

// ─── Get Sub Account List ─────────────────────────────────────────────────────

const getSubAccounts = async (adminUser, { page = 1, limit = 20, search, roleId, isActive }) => {
    const { User, Role } = require('../../models');

    const cacheKey = `company:${adminUser.companyId}:cache:users:p${page}:l${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached && !search && !roleId && isActive === undefined) {
        return JSON.parse(cached);
    }

    const where = {
        company_id: adminUser.companyId,
        role: { [Op.ne]: 'owner' }, // Don't list owner in sub accounts
    };

    if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { account_id: { [Op.like]: `%${search}%` } },
        ];
    }
    if (roleId) where.role_id = roleId;
    if (isActive !== undefined) where.is_active = isActive === 'true';

    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
        where,
        include: [{ model: Role, as: 'roleInfo', attributes: ['id', 'name'] }],
        attributes: { exclude: ['password'] },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
    });

    const result = {
        data: rows,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit),
        },
    };

    // Cache for 2 minutes (no filters)
    if (!search && !roleId && isActive === undefined) {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 120 });
    }

    return result;
};

// ─── Get Single Sub Account ───────────────────────────────────────────────────

const getSubAccountById = async (adminUser, userId) => {
    const _m = require('../../models');
    const { User, Role, UserStorePermission, UserWarehousePermission } = _m;
    const PlatformConnection = _m.PlatformConnection || null;
    const Warehouse = _m.Warehouse || null;

    const user = await User.findOne({
        where: { id: userId, company_id: adminUser.companyId },
        attributes: { exclude: ['password'] },
        include: [
            { model: Role, as: 'roleInfo', attributes: ['id', 'name', 'permissions'] },
            {
                model: UserStorePermission,
                as: 'storePermissions',
                include: PlatformConnection ? [{ model: PlatformConnection, as: 'connection', attributes: ['id', 'platform', 'shop_name', 'store_nickname'] }] : [],
            },
            {
                model: UserWarehousePermission,
                as: 'warehousePermissions',
                include: Warehouse ? [{ model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'] }] : [],
            },
        ],
    });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    return user;
};

// ─── Update Sub Account ───────────────────────────────────────────────────────

const updateSubAccount = async (adminUser, userId, data) => {
    const { User, UserStorePermission, UserWarehousePermission } = require('../../models');

    if (!['owner', 'admin'].includes(adminUser.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const user = await User.findOne({
        where: { id: userId, company_id: adminUser.companyId, role: { [Op.ne]: 'owner' } },
    });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    await sequelize.transaction(async (t) => {
        const updates = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.roleId !== undefined) updates.role_id = data.roleId;
        if (data.department !== undefined) updates.department = data.department;
        if (data.designation !== undefined) updates.designation = data.designation;
        if (data.phone !== undefined) updates.phone = data.phone;
        if (data.address !== undefined) updates.address = data.address;
        if (data.isActive !== undefined) updates.is_active = data.isActive;
        if (data.avatar !== undefined) updates.avatar_url = `data:image/jpeg;base64,${data.avatar}`;

        await user.update(updates, { transaction: t });

        // Replace store permissions if provided
        if (data.storePermissions !== undefined) {
            await UserStorePermission.destroy({
                where: { company_id: adminUser.companyId, user_id: userId },
                transaction: t,
            });
            if (data.storePermissions.length > 0) {
                await UserStorePermission.bulkCreate(
                    data.storePermissions.map(p => ({
                        company_id: adminUser.companyId,
                        user_id: userId,
                        connection_id: p.connectionId,
                        can_view: p.canView !== false,
                        can_edit: p.canEdit || false,
                    })),
                    { transaction: t }
                );
            }
        }

        // Replace warehouse permissions if provided
        if (data.warehousePermissions !== undefined) {
            await UserWarehousePermission.destroy({
                where: { company_id: adminUser.companyId, user_id: userId },
                transaction: t,
            });
            if (data.warehousePermissions.length > 0) {
                await UserWarehousePermission.bulkCreate(
                    data.warehousePermissions.map(p => ({
                        company_id: adminUser.companyId,
                        user_id: userId,
                        warehouse_id: p.warehouseId,
                        can_view: p.canView !== false,
                        can_edit: p.canEdit || false,
                    })),
                    { transaction: t }
                );
            }
        }
    });

    // Invalidate caches
    await redis.flushByPattern(`company:${adminUser.companyId}:cache:users*`);
    // If user was deactivated, kill their session
    if (data.isActive === false) {
        await redis.del(sessionKey(adminUser.companyId, userId));
    }

    return getSubAccountById(adminUser, userId);
};

// ─── Delete Sub Account ───────────────────────────────────────────────────────

const deleteSubAccount = async (adminUser, userId) => {
    const { User } = require('../../models');

    if (!['owner', 'admin'].includes(adminUser.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const user = await User.findOne({
        where: { id: userId, company_id: adminUser.companyId, role: { [Op.ne]: 'owner' } },
    });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }

    await user.destroy();

    // Kill their session immediately
    await redis.del(sessionKey(adminUser.companyId, userId));
    await redis.flushByPattern(`company:${adminUser.companyId}:cache:users*`);
};

module.exports = {
    registerAdmin,
    login,
    logout,
    refreshAccessToken,
    createSubAccount,
    getSubAccounts,
    getSubAccountById,
    updateSubAccount,
    deleteSubAccount,
};
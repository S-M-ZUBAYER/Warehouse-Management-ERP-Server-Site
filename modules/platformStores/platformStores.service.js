'use strict';

const { Op } = require('sequelize');
const { getPermittedStoreIds, assertStorePermission, isOwner } = require('../../utils/permissions');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:platform_stores${suffix ? ':' + suffix : ''}`;

const toBool = (value) => value === true || value === 'true' || value === 1 || value === '1';

const assertStore = async (user, storeId, options = {}) => {
    const { PlatformStore, Warehouse } = require('../../models');
    const store = await PlatformStore.findOne({
        where: { id: storeId, company_id: user.companyId, deleted_at: null },
        attributes: options.includeSecrets ? undefined : { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        include: [{ model: Warehouse, as: 'defaultWarehouse', attributes: ['id', 'name', 'code'], required: false }],
        transaction: options.transaction,
    });
    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }
    if (!options.skipPermissionCheck) {
        await assertStorePermission(user, storeId, { canEdit: Boolean(options.canEdit) });
    }
    return store;
};

// ─── List Platform Stores ──────────────────────────────────────────────────────
const getPlatformStores = async (user, filters = {}) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const { platform, isActive, page = 1, limit = 20 } = filters;

    const where = { company_id: user.companyId, deleted_at: null };
    if (platform && platform !== 'all') where.platform = platform;
    if (isActive !== undefined) where.is_active = toBool(isActive);

    const permittedStoreIds = await getPermittedStoreIds(user);
    if (Array.isArray(permittedStoreIds)) {
        if (!permittedStoreIds.length) {
            return { data: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 } };
        }
        where.id = { [Op.in]: permittedStoreIds };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PlatformStore.findAndCountAll({
        where,
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        include: [{
            model: Warehouse,
            as: 'defaultWarehouse',
            attributes: ['id', 'name', 'code'],
            required: false,
        }],
        order: [['platform', 'ASC'], ['store_name', 'ASC']],
        limit: parseInt(limit),
        offset,
    });

    return {
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    };
};

// ─── Get Single ────────────────────────────────────────────────────────────────
const getPlatformStoreById = async (user, storeId) => assertStore(user, storeId);

const getPlatformStoreByPlatformAndShopId = async (user, { platform, storeShopId }) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const store = await PlatformStore.findOne({
        where: {
            company_id: user.companyId,
            platform,
            store_shop_id: storeShopId,
            deleted_at: null,
        },
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        include: [{
            model: Warehouse,
            as: 'defaultWarehouse',
            attributes: ['id', 'name', 'code'],
            required: false,
        }],
    });

    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }

    await assertStorePermission(user, store.id);
    return store;
};

const getPublicPlatformStoreByPlatformAndShopId = async ({ platform, storeShopId }) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const store = await PlatformStore.findOne({
        where: {
            platform,
            store_shop_id: storeShopId,
            deleted_at: null,
        },
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        include: [{
            model: Warehouse,
            as: 'defaultWarehouse',
            attributes: ['id', 'name', 'code'],
            required: false,
        }],
    });

    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }

    return store;
};

// ─── Create ────────────────────────────────────────────────────────────────────
const createPlatformStore = async (user, data) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const {
        platform, storeName, externalStoreId, region,
        defaultWarehouseId, webhookSecret,
        storeShopId, storeOpenId, storeCipher,
    } = data;

    const existing = await PlatformStore.findOne({
        where: { company_id: user.companyId, platform, external_store_id: externalStoreId },
    });
    if (existing) {
        const err = new Error(`A ${platform} store with this external store ID is already connected`);
        err.statusCode = 409;
        throw err;
    }

    if (defaultWarehouseId) {
        const wh = await Warehouse.findOne({ where: { id: defaultWarehouseId, company_id: user.companyId } });
        if (!wh) {
            const err = new Error('Invalid default warehouse');
            err.statusCode = 400;
            throw err;
        }
    }

    const store = await PlatformStore.create({
        company_id: user.companyId,
        platform,
        store_name: storeName,
        external_store_id: externalStoreId,
        external_store_name: data.externalStoreName || null,
        store_shop_id: storeShopId || null,
        store_open_id: storeOpenId || null,
        store_cipher: storeCipher || null,
        region: region || null,
        webhook_secret: webhookSecret || null,
        default_warehouse_id: defaultWarehouseId || null,
        is_active: true,
        created_by: user.userId,
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getPlatformStoreById(user, store.id);
};

// ─── Update ────────────────────────────────────────────────────────────────────
const updatePlatformStore = async (user, storeId, data) => {
    const { PlatformStore } = require('../../models');

    const store = await PlatformStore.findOne({
        where: { id: storeId, company_id: user.companyId, deleted_at: null },
    });
    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }
    await assertStorePermission(user, storeId, { canEdit: true });

    const updates = {};
    if (data.storeName !== undefined) updates.store_name = data.storeName;
    if (data.externalStoreName !== undefined) updates.external_store_name = data.externalStoreName;
    if (data.storeShopId !== undefined) updates.store_shop_id = data.storeShopId;
    if (data.storeOpenId !== undefined) updates.store_open_id = data.storeOpenId;
    if (data.storeCipher !== undefined) updates.store_cipher = data.storeCipher;
    if (data.region !== undefined) updates.region = data.region;
    if (data.defaultWarehouseId !== undefined) updates.default_warehouse_id = data.defaultWarehouseId;
    if (data.isActive !== undefined) updates.is_active = toBool(data.isActive);
    if (data.webhookSecret !== undefined) updates.webhook_secret = data.webhookSecret;

    await store.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getPlatformStoreById(user, storeId);
};

// ─── Update tokens (called by Java after OAuth refresh) ───────────────────────
const updateStoreTokens = async (user, storeId, { accessToken, refreshToken, tokenExpiresAt }) => {
    const { PlatformStore } = require('../../models');

    const store = await PlatformStore.findOne({
        where: { id: storeId, company_id: user.companyId, deleted_at: null },
    });
    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }

    await store.update({
        access_token: accessToken || store.access_token,
        refresh_token: refreshToken || store.refresh_token,
        token_expires_at: tokenExpiresAt ? new Date(tokenExpiresAt) : store.token_expires_at,
    });

    return { id: store.id, token_expires_at: store.token_expires_at };
};

// ─── Store Permission List ────────────────────────────────────────────────────
const getStorePermissions = async (user, storeId, filters = {}) => {
    const { User, Role, UserStorePermission } = require('../../models');
    const { search, roleId, isActive } = filters;

    const store = await assertStore(user, storeId);

    const where = {
        company_id: user.companyId,
        is_active: true,
        // Owner can always access every store. The modal is for sub-account / staff access.
        role: { [Op.ne]: 'owner' },
    };
    if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { account_id: { [Op.like]: `%${search}%` } },
        ];
    }
    if (roleId && roleId !== 'all') where.role_id = roleId;
    if (isActive !== undefined) where.is_active = toBool(isActive);

    const [users, permissions] = await Promise.all([
        User.findAll({
            where,
            attributes: ['id', 'name', 'email', 'account_id', 'role_id', 'role', 'is_active'],
            include: [{ model: Role, as: 'roleInfo', attributes: ['id', 'name'] }],
            order: [['created_at', 'DESC']],
        }),
        UserStorePermission.findAll({
            where: { company_id: user.companyId, connection_id: storeId },
            raw: true,
        }),
    ]);

    const permissionMap = new Map(permissions.map((permission) => [Number(permission.user_id), permission]));

    return {
        store: {
            id: store.id,
            platform: store.platform,
            storeName: store.store_name,
            externalStoreId: store.external_store_id,
            region: store.region,
        },
        users: users.map((item) => {
            const permission = permissionMap.get(Number(item.id));
            return {
                id: item.id,
                account: item.account_id || item.email,
                email: item.email,
                fullName: item.name,
                roleId: item.roleInfo?.id || item.role_id || null,
                roleName: item.roleInfo?.name || item.role || '-',
                isActive: Boolean(item.is_active),
                selected: Boolean(permission?.can_view),
                canView: Boolean(permission?.can_view),
                canEdit: Boolean(permission?.can_edit),
            };
        }),
    };
};

// ─── Update Store Permissions ─────────────────────────────────────────────────
const updateStorePermissions = async (user, storeId, data = {}) => {
    const { User, UserStorePermission } = require('../../models');
    const permissionsInput = Array.isArray(data.permissions)
        ? data.permissions
        : Array.isArray(data.userIds)
            ? data.userIds.map((id) => ({ userId: id, canView: true, canEdit: false }))
            : [];

    await assertStore(user, storeId);

    const normalized = permissionsInput
        .map((permission) => ({
            userId: Number(permission.userId || permission.user_id || permission.id),
            canView: permission.canView !== false && permission.can_view !== false,
            canEdit: Boolean(permission.canEdit || permission.can_edit),
        }))
        .filter((permission) => Number.isInteger(permission.userId) && permission.userId > 0 && permission.canView);

    const userIds = [...new Set(normalized.map((permission) => permission.userId))];

    const users = userIds.length
        ? await User.findAll({
            where: {
                id: { [Op.in]: userIds },
                company_id: user.companyId,
                role: { [Op.ne]: 'owner' },
                is_active: true,
            },
            attributes: ['id'],
            raw: true,
        })
        : [];

    const validUserIds = new Set(users.map((item) => Number(item.id)));
    const rows = normalized
        .filter((permission) => validUserIds.has(permission.userId))
        .map((permission) => ({
            company_id: user.companyId,
            user_id: permission.userId,
            connection_id: Number(storeId),
            can_view: true,
            can_edit: permission.canEdit,
        }));

    await sequelize.transaction(async (transaction) => {
        await UserStorePermission.destroy({
            where: { company_id: user.companyId, connection_id: storeId },
            transaction,
        });
        if (rows.length) {
            await UserStorePermission.bulkCreate(rows, { transaction });
        }
    });

    await redis.flushByPattern(`company:${user.companyId}:cache:users*`);
    return getStorePermissions(user, storeId);
};

// ─── Delete / Unlink Store ────────────────────────────────────────────────────
const deletePlatformStore = async (user, storeId) => {
    const { PlatformStore, PlatformSkuMapping, PlatformProduct, UserStorePermission } = require('../../models');

    await sequelize.transaction(async (transaction) => {
        const store = await PlatformStore.findOne({
            where: { id: storeId, company_id: user.companyId, deleted_at: null },
            transaction,
        });
        if (!store) {
            const err = new Error('Platform store not found');
            err.statusCode = 404;
            throw err;
        }
        await assertStorePermission(user, storeId, { canEdit: true });

        await UserStorePermission.destroy({
            where: { company_id: user.companyId, connection_id: storeId },
            transaction,
        });

        await PlatformSkuMapping.update(
            { is_active: false },
            { where: { company_id: user.companyId, platform_store_id: storeId }, transaction }
        );
        await PlatformSkuMapping.destroy({
            where: { company_id: user.companyId, platform_store_id: storeId },
            transaction,
        });

        await PlatformProduct.destroy({
            where: { company_id: user.companyId, platform_store_id: storeId },
            transaction,
        });

        await store.destroy({ transaction });
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

module.exports = {
    getPlatformStores,
    getPlatformStoreById,
    getPlatformStoreByPlatformAndShopId,
    getPublicPlatformStoreByPlatformAndShopId,
    createPlatformStore,
    updatePlatformStore,
    updateStoreTokens,
    getStorePermissions,
    updateStorePermissions,
    deletePlatformStore,
};

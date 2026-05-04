// 'use strict';

// const { Op } = require('sequelize');
// const { sequelize } = require('../../config/database');
// const redis = require('../../config/redis');

// const cacheKey = (companyId, suffix = '') =>
//     `company:${companyId}:cache:platform_stores${suffix ? ':' + suffix : ''}`;

// // ─── List Platform Stores ──────────────────────────────────────────────────────
// const getPlatformStores = async (user, filters = {}) => {
//     const { PlatformStore, Warehouse } = require('../../models');

//     const { platform, isActive, page = 1, limit = 20 } = filters;

//     const where = { company_id: user.companyId, deleted_at: null };
//     if (platform && platform !== 'all') where.platform = platform;
//     if (isActive !== undefined) where.is_active = isActive === 'true' || isActive === true;

//     const offset = (parseInt(page) - 1) * parseInt(limit);

//     const { count, rows } = await PlatformStore.findAndCountAll({
//         where,
//         attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] }, // never expose tokens in list
//         include: [{
//             model: Warehouse,
//             as: 'defaultWarehouse',
//             attributes: ['id', 'name', 'code'],
//             required: false,
//         }],
//         order: [['platform', 'ASC'], ['store_name', 'ASC']],
//         limit: parseInt(limit),
//         offset,
//     });

//     return {
//         data: rows,
//         pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
//     };
// };

// // ─── Get Single ────────────────────────────────────────────────────────────────
// const getPlatformStoreById = async (user, storeId) => {
//     const { PlatformStore, Warehouse } = require('../../models');

//     const store = await PlatformStore.findOne({
//         where: { id: storeId, company_id: user.companyId, deleted_at: null },
//         attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
//         include: [{ model: Warehouse, as: 'defaultWarehouse', attributes: ['id', 'name', 'code'], required: false }],
//     });
//     if (!store) {
//         const err = new Error('Platform store not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     return store;
// };

// // ─── Create ────────────────────────────────────────────────────────────────────
// const createPlatformStore = async (user, data) => {
//     const { PlatformStore, Warehouse } = require('../../models');

//     const { platform, storeName, externalStoreId, region, defaultWarehouseId, webhookSecret } = data;

//     // Unique check
//     const existing = await PlatformStore.findOne({
//         where: { company_id: user.companyId, platform, external_store_id: externalStoreId },
//     });
//     if (existing) {
//         const err = new Error(`A ${platform} store with this external store ID is already connected`);
//         err.statusCode = 409;
//         throw err;
//     }

//     if (defaultWarehouseId) {
//         const wh = await Warehouse.findOne({ where: { id: defaultWarehouseId, company_id: user.companyId } });
//         if (!wh) {
//             const err = new Error('Invalid default warehouse');
//             err.statusCode = 400;
//             throw err;
//         }
//     }

//     const store = await PlatformStore.create({
//         company_id: user.companyId,
//         platform,
//         store_name: storeName,
//         external_store_id: externalStoreId,
//         external_store_name: data.externalStoreName || null,
//         region: region || null,
//         webhook_secret: webhookSecret || null,
//         default_warehouse_id: defaultWarehouseId || null,
//         is_active: true,
//         created_by: user.userId,
//     });

//     await redis.flushByPattern(cacheKey(user.companyId, '*'));
//     return getPlatformStoreById(user, store.id);
// };

// // ─── Update ────────────────────────────────────────────────────────────────────
// const updatePlatformStore = async (user, storeId, data) => {
//     const { PlatformStore } = require('../../models');

//     const store = await PlatformStore.findOne({
//         where: { id: storeId, company_id: user.companyId, deleted_at: null },
//     });
//     if (!store) {
//         const err = new Error('Platform store not found');
//         err.statusCode = 404;
//         throw err;
//     }

//     const updates = {};
//     if (data.storeName !== undefined) updates.store_name = data.storeName;
//     if (data.externalStoreName !== undefined) updates.external_store_name = data.externalStoreName;
//     if (data.region !== undefined) updates.region = data.region;
//     if (data.defaultWarehouseId !== undefined) updates.default_warehouse_id = data.defaultWarehouseId;
//     if (data.isActive !== undefined) updates.is_active = data.isActive;
//     if (data.webhookSecret !== undefined) updates.webhook_secret = data.webhookSecret;

//     await store.update(updates);
//     await redis.flushByPattern(cacheKey(user.companyId, '*'));
//     return getPlatformStoreById(user, storeId);
// };

// // ─── Update tokens (called by Java after OAuth refresh) ───────────────────────
// const updateStoreTokens = async (user, storeId, { accessToken, refreshToken, tokenExpiresAt }) => {
//     const { PlatformStore } = require('../../models');

//     const store = await PlatformStore.findOne({
//         where: { id: storeId, company_id: user.companyId, deleted_at: null },
//     });
//     if (!store) {
//         const err = new Error('Platform store not found');
//         err.statusCode = 404;
//         throw err;
//     }

//     await store.update({
//         access_token: accessToken || store.access_token,
//         refresh_token: refreshToken || store.refresh_token,
//         token_expires_at: tokenExpiresAt ? new Date(tokenExpiresAt) : store.token_expires_at,
//     });

//     return { id: store.id, token_expires_at: store.token_expires_at };
// };

// // ─── Delete (soft) ─────────────────────────────────────────────────────────────
// const deletePlatformStore = async (user, storeId) => {
//     const { PlatformStore, PlatformSkuMapping } = require('../../models');

//     const store = await PlatformStore.findOne({
//         where: { id: storeId, company_id: user.companyId, deleted_at: null },
//     });
//     if (!store) {
//         const err = new Error('Platform store not found');
//         err.statusCode = 404;
//         throw err;
//     }

//     // Warn if active mappings exist
//     const activeMappings = await PlatformSkuMapping.count({
//         where: { platform_store_id: storeId, is_active: true, deleted_at: null },
//     });
//     if (activeMappings > 0) {
//         const err = new Error(`Cannot delete — ${activeMappings} active SKU mapping(s) exist. Deactivate them first.`);
//         err.statusCode = 400;
//         throw err;
//     }

//     await store.destroy();
//     await redis.flushByPattern(cacheKey(user.companyId, '*'));
// };

// module.exports = {
//     getPlatformStores,
//     getPlatformStoreById,
//     createPlatformStore,
//     updatePlatformStore,
//     updateStoreTokens,
//     deletePlatformStore,
// };


'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:platform_stores${suffix ? ':' + suffix : ''}`;

// ─── List Platform Stores ──────────────────────────────────────────────────────
const getPlatformStores = async (user, filters = {}) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const { platform, isActive, page = 1, limit = 20 } = filters;

    const where = { company_id: user.companyId, deleted_at: null };
    if (platform && platform !== 'all') where.platform = platform;
    if (isActive !== undefined) where.is_active = isActive === 'true' || isActive === true;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PlatformStore.findAndCountAll({
        where,
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] }, // never expose tokens in list
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
const getPlatformStoreById = async (user, storeId) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const store = await PlatformStore.findOne({
        where: { id: storeId, company_id: user.companyId, deleted_at: null },
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        include: [{ model: Warehouse, as: 'defaultWarehouse', attributes: ['id', 'name', 'code'], required: false }],
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
        storeShopId, storeOpenId, storeCipher,      // new optional fields
    } = data;

    // Unique check
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

    const updates = {};
    if (data.storeName !== undefined) updates.store_name = data.storeName;
    if (data.externalStoreName !== undefined) updates.external_store_name = data.externalStoreName;
    if (data.storeShopId !== undefined) updates.store_shop_id = data.storeShopId;
    if (data.storeOpenId !== undefined) updates.store_open_id = data.storeOpenId;
    if (data.storeCipher !== undefined) updates.store_cipher = data.storeCipher;
    if (data.region !== undefined) updates.region = data.region;
    if (data.defaultWarehouseId !== undefined) updates.default_warehouse_id = data.defaultWarehouseId;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
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

// ─── Delete (soft) ─────────────────────────────────────────────────────────────
const deletePlatformStore = async (user, storeId) => {
    const { PlatformStore, PlatformSkuMapping } = require('../../models');

    const store = await PlatformStore.findOne({
        where: { id: storeId, company_id: user.companyId, deleted_at: null },
    });
    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }

    // Warn if active mappings exist
    const activeMappings = await PlatformSkuMapping.count({
        where: { platform_store_id: storeId, is_active: true, deleted_at: null },
    });
    if (activeMappings > 0) {
        const err = new Error(`Cannot delete — ${activeMappings} active SKU mapping(s) exist. Deactivate them first.`);
        err.statusCode = 400;
        throw err;
    }

    await store.destroy();
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

module.exports = {
    getPlatformStores,
    getPlatformStoreById,
    createPlatformStore,
    updatePlatformStore,
    updateStoreTokens,
    deletePlatformStore,
};
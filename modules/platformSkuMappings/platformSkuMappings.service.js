'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:platform_sku_mappings${suffix ? ':' + suffix : ''}`;

// ─── List mappings ─────────────────────────────────────────────────────────────
const getPlatformSkuMappings = async (user, filters = {}) => {
    const { PlatformSkuMapping, PlatformStore, MerchantSku, CombineSku, Warehouse } = require('../../models');

    const { platformStoreId, merchantSkuId, combineSkuId, syncStatus, isActive, page = 1, limit = 20 } = filters;

    const where = { company_id: user.companyId, deleted_at: null };
    if (platformStoreId) where.platform_store_id = platformStoreId;
    if (merchantSkuId) where.merchant_sku_id = merchantSkuId;
    if (combineSkuId) where.combine_sku_id = combineSkuId;
    if (syncStatus) where.sync_status = syncStatus;
    if (isActive !== undefined) where.is_active = isActive === 'true' || isActive === true;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PlatformSkuMapping.findAndCountAll({
        where,
        include: [
            {
                model: PlatformStore, as: 'platformStore',
                attributes: ['id', 'platform', 'store_name', 'external_store_id', 'region'],
                required: false,
            },
            {
                model: MerchantSku, as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'status'],
                required: false,
            },
            {
                model: CombineSku, as: 'combineSku',
                attributes: ['id', 'combine_name', 'combine_sku_code', 'computed_quantity', 'status'],
                required: false,
            },
            {
                model: Warehouse, as: 'fulfillmentWarehouse',
                attributes: ['id', 'name', 'code'],
                required: false,
            },
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    return {
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    };
};

// ─── Get single mapping ────────────────────────────────────────────────────────
const getPlatformSkuMappingById = async (user, mappingId) => {
    const { PlatformSkuMapping, PlatformStore, MerchantSku, CombineSku, Warehouse } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId, deleted_at: null },
        include: [
            { model: PlatformStore, as: 'platformStore', attributes: ['id', 'platform', 'store_name', 'external_store_id', 'region'] },
            { model: MerchantSku, as: 'merchantSku', attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price', 'status'] },
            { model: CombineSku, as: 'combineSku', attributes: ['id', 'combine_name', 'combine_sku_code', 'computed_quantity', 'status'] },
            { model: Warehouse, as: 'fulfillmentWarehouse', attributes: ['id', 'name', 'code'], required: false },
        ],
    });
    if (!mapping) {
        const err = new Error('Platform SKU mapping not found');
        err.statusCode = 404;
        throw err;
    }
    return mapping;
};

// ─── Create mapping ────────────────────────────────────────────────────────────
const createPlatformSkuMapping = async (user, data) => {
    const { PlatformSkuMapping, PlatformStore, MerchantSku, CombineSku, Warehouse } = require('../../models');

    const { platformStoreId, merchantSkuId, combineSkuId, fulfillmentWarehouseId } = data;

    // Exactly one of merchant/combine must be provided
    if ((!merchantSkuId && !combineSkuId) || (merchantSkuId && combineSkuId)) {
        const err = new Error('Exactly one of merchantSkuId or combineSkuId must be provided');
        err.statusCode = 400;
        throw err;
    }

    // Validate platform store belongs to company
    const store = await PlatformStore.findOne({
        where: { id: platformStoreId, company_id: user.companyId, deleted_at: null, is_active: true },
    });
    if (!store) {
        const err = new Error('Platform store not found or inactive');
        err.statusCode = 400;
        throw err;
    }

    // Validate internal SKU
    if (merchantSkuId) {
        const sku = await MerchantSku.findOne({
            where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
        });
        if (!sku) { const err = new Error('Merchant SKU not found'); err.statusCode = 400; throw err; }
    }
    if (combineSkuId) {
        const sku = await CombineSku.findOne({
            where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
        });
        if (!sku) { const err = new Error('Combine SKU not found'); err.statusCode = 400; throw err; }
    }

    // Check for duplicate mapping
    const dupWhere = { platform_store_id: platformStoreId };
    if (merchantSkuId) dupWhere.merchant_sku_id = merchantSkuId;
    if (combineSkuId) dupWhere.combine_sku_id = combineSkuId;
    const dup = await PlatformSkuMapping.findOne({ where: dupWhere });
    if (dup) {
        const err = new Error('This SKU is already mapped to this platform store');
        err.statusCode = 409;
        throw err;
    }

    // Validate fulfillment warehouse
    if (fulfillmentWarehouseId) {
        const wh = await Warehouse.findOne({ where: { id: fulfillmentWarehouseId, company_id: user.companyId } });
        if (!wh) { const err = new Error('Invalid fulfillment warehouse'); err.statusCode = 400; throw err; }
    }

    const mapping = await PlatformSkuMapping.create({
        company_id: user.companyId,
        platform_store_id: platformStoreId,
        merchant_sku_id: merchantSkuId || null,
        combine_sku_id: combineSkuId || null,
        fulfillment_warehouse_id: fulfillmentWarehouseId || store.default_warehouse_id || null,
        is_active: true,
        sync_status: 'pending',
        created_by: user.userId,
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getPlatformSkuMappingById(user, mapping.id);
};

// ─── Update mapping (internal fields) ─────────────────────────────────────────
const updatePlatformSkuMapping = async (user, mappingId, data) => {
    const { PlatformSkuMapping } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId, deleted_at: null },
    });
    if (!mapping) {
        const err = new Error('Platform SKU mapping not found');
        err.statusCode = 404;
        throw err;
    }

    const updates = {};
    if (data.fulfillmentWarehouseId !== undefined) updates.fulfillment_warehouse_id = data.fulfillmentWarehouseId;
    if (data.isActive !== undefined) updates.is_active = data.isActive;

    if (Object.keys(updates).length) await mapping.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getPlatformSkuMappingById(user, mappingId);
};

// ─── Sync callback: Java writes back platform listing IDs after product push ──
// This is the critical handshake — Java calls this PUT endpoint after successfully
// pushing the product to Shopee/TikTok/Lazada, writing back the platform-side IDs
const syncCallback = async (user, mappingId, data) => {
    const { PlatformSkuMapping } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId, deleted_at: null },
    });
    if (!mapping) {
        const err = new Error('Platform SKU mapping not found');
        err.statusCode = 404;
        throw err;
    }

    const updates = {
        sync_status: data.success ? 'synced' : 'failed',
        last_synced_at: new Date(),
        sync_error: data.errorMessage || null,
    };
    if (data.platformSkuId) updates.platform_sku_id = data.platformSkuId;
    if (data.platformListingId) updates.platform_listing_id = data.platformListingId;
    if (data.platformModelId) updates.platform_model_id = data.platformModelId;

    await mapping.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getPlatformSkuMappingById(user, mappingId);
};

// ─── Mark out of sync (stock changed, Java needs to re-push) ─────────────────
const markOutOfSync = async (companyId, merchantSkuIds = [], combineSkuIds = []) => {
    const { PlatformSkuMapping } = require('../../models');

    const where = { company_id: companyId, is_active: true, deleted_at: null };
    if (merchantSkuIds.length && combineSkuIds.length) {
        where[Op.or] = [
            { merchant_sku_id: { [Op.in]: merchantSkuIds } },
            { combine_sku_id: { [Op.in]: combineSkuIds } },
        ];
    } else if (merchantSkuIds.length) {
        where.merchant_sku_id = { [Op.in]: merchantSkuIds };
    } else if (combineSkuIds.length) {
        where.combine_sku_id = { [Op.in]: combineSkuIds };
    } else {
        return 0;
    }

    const [updated] = await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync' },
        { where }
    );
    return updated;
};

// ─── Delete mapping (soft) ─────────────────────────────────────────────────────
const deletePlatformSkuMapping = async (user, mappingId) => {
    const { PlatformSkuMapping } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId, deleted_at: null },
    });
    if (!mapping) {
        const err = new Error('Platform SKU mapping not found');
        err.statusCode = 404;
        throw err;
    }

    await mapping.destroy();
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

// ─── Get pending sync mappings (Java polls this to know what to push) ─────────
const getPendingSyncMappings = async (user, { platform } = {}) => {
    const { PlatformSkuMapping, PlatformStore, MerchantSku, CombineSku } = require('../../models');

    const storeWhere = { company_id: user.companyId, is_active: true, deleted_at: null };
    if (platform) storeWhere.platform = platform;

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: user.companyId,
            sync_status: { [Op.in]: ['pending', 'out_of_sync', 'failed'] },
            is_active: true,
            deleted_at: null,
        },
        include: [
            {
                model: PlatformStore, as: 'platformStore',
                where: storeWhere,
                attributes: ['id', 'platform', 'store_name', 'external_store_id', 'region'],
                required: true,
            },
            {
                model: MerchantSku, as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'gtin', 'price', 'weight', 'length', 'width', 'height'],
                required: false,
            },
            {
                model: CombineSku, as: 'combineSku',
                attributes: ['id', 'combine_name', 'combine_sku_code', 'selling_price', 'weight', 'length', 'width', 'height', 'computed_quantity'],
                required: false,
            },
        ],
        order: [['created_at', 'ASC']],
        limit: 100, // Java processes in batches
    });

    return mappings;
};

module.exports = {
    getPlatformSkuMappings,
    getPlatformSkuMappingById,
    createPlatformSkuMapping,
    updatePlatformSkuMapping,
    syncCallback,
    markOutOfSync,
    deletePlatformSkuMapping,
    getPendingSyncMappings,
};
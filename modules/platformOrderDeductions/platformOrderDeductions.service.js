'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const stockService = require('../stock/stock.service');

const SHOPEE_STOCK_UPDATE_BASE_URL = process.env.SHOPEE_STOCK_UPDATE_BASE_URL || 'http://192.168.1.222:8080';
const TIKTOK_STOCK_UPDATE_BASE_URL = process.env.TIKTOK_STOCK_UPDATE_BASE_URL || 'http://192.168.1.222:8080';

const normalizeString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const addEqualsFilter = (filters, field, value) => {
    const normalized = normalizeString(value);
    if (normalized) filters.push({ [field]: normalized });
};

const buildStoreWhere = (data) => {
    const storeFilters = [];

    addEqualsFilter(storeFilters, 'external_store_id', data.externalStoreId);
    addEqualsFilter(storeFilters, 'store_shop_id', data.shopId);
    if (data.platform === 'shopee') {
        addEqualsFilter(storeFilters, 'external_store_id', data.shopId);
    }
    addEqualsFilter(storeFilters, 'store_open_id', data.openId);
    addEqualsFilter(storeFilters, 'store_cipher', data.cipherId);

    const companyId = Number(data.companyId);

    return {
        ...(Number.isInteger(companyId) && companyId > 0 ? { company_id: companyId } : {}),
        platform: data.platform,
        is_active: true,
        ...(storeFilters.length ? { [Op.or]: storeFilters } : {}),
    };
};

const buildMappingWhere = (data, platformStoreId = null) => {
    const mappingFilters = [];
    const companyId = Number(data.companyId);

    if (data.platform === 'shopee') {
        const itemId = normalizeString(data.itemId);
        const modelId = normalizeString(data.modelId);

        if (itemId) {
            mappingFilters.push({
                [Op.or]: [
                    { platform_item_id: itemId },
                    { platform_product_id: itemId },
                    { platform_listing_id: itemId },
                ],
            });
        }

        if (modelId) {
            mappingFilters.push({
                [Op.or]: [
                    { platform_model_id: modelId },
                    { platform_sku_id: modelId },
                ],
            });
        }
    } else {
        addEqualsFilter(mappingFilters, 'platform_shop_id', data.shopId);
        addEqualsFilter(mappingFilters, 'platform_open_id', data.openId);
        addEqualsFilter(mappingFilters, 'platform_cipher_id', data.cipherId);
        addEqualsFilter(mappingFilters, 'platform_product_id', data.productId);
        addEqualsFilter(mappingFilters, 'platform_item_id', data.itemId);
        addEqualsFilter(mappingFilters, 'platform_sku_id', data.skuId);
        addEqualsFilter(mappingFilters, 'platform_model_id', data.modelId);
        addEqualsFilter(mappingFilters, 'platform_listing_id', data.listingId);
    }
    addEqualsFilter(mappingFilters, 'platform_warehouse_id', data.warehouseId);
    addEqualsFilter(mappingFilters, 'platform_location_id', data.locationId);

    return {
        ...(Number.isInteger(companyId) && companyId > 0 ? { company_id: companyId } : {}),
        is_active: true,
        ...(platformStoreId ? { platform_store_id: platformStoreId } : {}),
        ...(mappingFilters.length ? { [Op.and]: mappingFilters } : {}),
    };
};

const validatePlatformIdentifiers = (data) => {
    if (data.platformMappingId) return;

    const hasStoreIdentifier = Boolean(
        normalizeString(data.externalStoreId) ||
        normalizeString(data.shopId) ||
        normalizeString(data.openId) ||
        normalizeString(data.cipherId)
    );

    const hasSkuIdentifier = Boolean(
        normalizeString(data.skuId) ||
        normalizeString(data.modelId) ||
        normalizeString(data.productId) ||
        normalizeString(data.itemId) ||
        normalizeString(data.listingId)
    );

    if (!hasStoreIdentifier) {
        const err = new Error('At least one store identifier is required: externalStoreId, shopId, openId, or cipherId');
        err.statusCode = 400;
        throw err;
    }

    if (!hasSkuIdentifier) {
        const err = new Error('At least one product/SKU identifier is required: productId, itemId, skuId, modelId, or listingId');
        err.statusCode = 400;
        throw err;
    }

    if (data.platform === 'shopee' && !normalizeString(data.shopId) && !normalizeString(data.externalStoreId)) {
        const err = new Error('Shopee requires shopId or externalStoreId');
        err.statusCode = 400;
        throw err;
    }

    if (data.platform === 'tiktok' && !normalizeString(data.shopId) && !normalizeString(data.openId) && !normalizeString(data.cipherId) && !normalizeString(data.externalStoreId)) {
        const err = new Error('TikTok requires shopId, openId, cipherId, or externalStoreId');
        err.statusCode = 400;
        throw err;
    }
};

const resolvePlatformMapping = async (data) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');

    if (data.platformMappingId) {
        const mapping = await PlatformSkuMapping.findOne({
            where: {
                id: Number(data.platformMappingId),
                ...(data.companyId ? { company_id: Number(data.companyId) } : {}),
                is_active: true,
            },
            include: [{
                model: PlatformStore,
                as: 'platformStore',
                where: { platform: data.platform },
                attributes: ['id', 'platform'],
            }],
        });

        if (!mapping) {
            const err = new Error('Platform SKU mapping not found for this company/platform');
            err.statusCode = 404;
            throw err;
        }

        return mapping;
    }

    validatePlatformIdentifiers(data);

    const store = await PlatformStore.findOne({
        where: buildStoreWhere(data),
        attributes: ['id', 'platform'],
    });

    if (!store) {
        const err = new Error('Platform store not found for the supplied identifiers');
        err.statusCode = 404;
        throw err;
    }

    const mappings = await PlatformSkuMapping.findAll({
        where: buildMappingWhere(data, store.id),
        limit: 2,
    });

    if (!mappings.length) {
        const err = new Error('Platform SKU mapping not found for the supplied order item identifiers');
        err.statusCode = 404;
        throw err;
    }

    if (mappings.length > 1) {
        const err = new Error('Multiple platform SKU mappings matched. Send platformMappingId or more exact SKU identifiers.');
        err.statusCode = 409;
        throw err;
    }

    return mappings[0];
};

const collectConnectedSkuIds = async (companyId, startingSkuIds) => {
    const { MerchantSkuSyncGroup, MerchantSkuSyncMember } = require('../../models');
    const visited = new Set(startingSkuIds.filter(Boolean).map((id) => Number(id)));
    const queue = [...visited];

    while (queue.length) {
        const skuId = queue.shift();

        const primaryGroups = await MerchantSkuSyncGroup.findAll({
            where: { company_id: companyId, primary_sku_id: skuId, deleted_at: null },
            include: [{ model: MerchantSkuSyncMember, as: 'members', attributes: ['member_sku_id'] }],
        });

        for (const group of primaryGroups) {
            for (const member of group.members || []) {
                const nextId = Number(member.member_sku_id);
                if (nextId && !visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push(nextId);
                }
            }
        }

        const memberLinks = await MerchantSkuSyncMember.findAll({
            where: { company_id: companyId, member_sku_id: skuId },
            include: [{
                model: MerchantSkuSyncGroup,
                as: 'group',
                where: { company_id: companyId, deleted_at: null },
                include: [{ model: MerchantSkuSyncMember, as: 'members', attributes: ['member_sku_id'] }],
            }],
        });

        for (const link of memberLinks) {
            const ids = [
                link.group?.primary_sku_id,
                ...(link.group?.members || []).map((member) => member.member_sku_id),
            ].filter(Boolean);

            for (const nextId of ids) {
                const numericId = Number(nextId);
                if (!visited.has(numericId)) {
                    visited.add(numericId);
                    queue.push(numericId);
                }
            }
        }
    }

    return [...visited];
};

const markRelatedMappingsOutOfSync = async ({ companyId, merchantSkuIds, combineSkuId }) => {
    const { PlatformSkuMapping } = require('../../models');
    const skuIds = await collectConnectedSkuIds(companyId, merchantSkuIds);
    const conditions = [];

    if (skuIds.length) conditions.push({ merchant_sku_id: { [Op.in]: skuIds } });
    if (combineSkuId) conditions.push({ combine_sku_id: combineSkuId });
    if (!conditions.length) return { markedCount: 0, merchantSkuIds: skuIds };

    const [markedCount] = await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync', sync_error: null },
        {
            where: {
                company_id: companyId,
                is_active: true,
                [Op.or]: conditions,
            },
        }
    );

    return { markedCount, merchantSkuIds: skuIds };
};

const getMerchantSkuQtyForMapping = async (companyId, mapping) => {
    const { SkuWarehouseStock } = require('../../models');
    const where = {
        company_id: companyId,
        merchant_sku_id: mapping.merchant_sku_id,
    };

    if (mapping.fulfillment_warehouse_id) {
        where.warehouse_id = mapping.fulfillment_warehouse_id;
    }

    const rows = await SkuWarehouseStock.findAll({
        where,
        attributes: ['qty_on_hand'],
        raw: true,
    });

    return rows.reduce((sum, row) => sum + Number(row.qty_on_hand || 0), 0);
};

const getQtyForMapping = async (companyId, mapping) => {
    if (mapping.merchant_sku_id) {
        return getMerchantSkuQtyForMapping(companyId, mapping);
    }

    if (mapping.combine_sku_id) {
        return stockService.recomputeCombineSku(companyId, mapping.combine_sku_id);
    }

    return 0;
};

const getShopeeIds = (mapping) => {
    const platformStore = mapping.platformStore || {};

    return {
        shopId: normalizeString(mapping.platform_shop_id) ||
            normalizeString(platformStore.store_shop_id) ||
            normalizeString(platformStore.external_store_id),
        itemId: normalizeString(mapping.platform_item_id) ||
            normalizeString(mapping.platform_product_id) ||
            normalizeString(mapping.platform_listing_id),
        modelId: normalizeString(mapping.platform_model_id) ||
            normalizeString(mapping.platform_sku_id),
    };
};

const callShopeeUpdateStock = async (mapping, qty) => {
    const { shopId, itemId, modelId } = getShopeeIds(mapping);

    if (!shopId || !itemId || !modelId) {
        return {
            success: false,
            error: `Missing Shopee identifiers for mapping ${mapping.id}`,
        };
    }

    try {
        const response = await axios.post(
            `${SHOPEE_STOCK_UPDATE_BASE_URL}/shopee-open-shop/api/dev/product/update_stock/${shopId}`,
            {
                item_id: Number(itemId),
                model_id: Number(modelId),
                stock: qty,
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const failureList = response.data?.response?.failure_list ?? [];
        if (failureList.length > 0) {
            return {
                success: false,
                error: `Shopee failure: ${JSON.stringify(failureList)}`,
            };
        }

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message ?? err.message,
        };
    }
};

const callTikTokUpdateStock = async (mapping, qty) => {
    const productId = normalizeString(mapping.platform_product_id) || normalizeString(mapping.platform_listing_id);
    const skuId = normalizeString(mapping.platform_sku_id) || normalizeString(mapping.platform_model_id);
    const warehouseId = normalizeString(mapping.platform_warehouse_id);
    const openId = normalizeString(mapping.platform_open_id);
    const cipherId = normalizeString(mapping.platform_cipher_id);

    if (!productId || !skuId || !warehouseId || !openId || !cipherId) {
        return {
            success: false,
            error: `Missing TikTok identifiers for mapping ${mapping.id}`,
        };
    }

    try {
        const response = await axios.post(
            `${TIKTOK_STOCK_UPDATE_BASE_URL}/tiktokshop-partner/api/dev/products/updateStock`,
            {
                skus: [
                    {
                        id: skuId,
                        inventory: [
                            {
                                quantity: qty,
                                warehouseId,
                            },
                        ],
                    },
                ],
            },
            {
                params: {
                    productId,
                    openId,
                    cipher: cipherId,
                },
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (response.data?.code !== 0) {
            return {
                success: false,
                error: `TikTok error: ${response.data?.message ?? 'Unknown'}`,
            };
        }

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message ?? err.message,
        };
    }
};

const pushRelatedPlatformStock = async ({ companyId, merchantSkuIds, combineSkuId, platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const conditions = [];

    if (merchantSkuIds.length) conditions.push({ merchant_sku_id: { [Op.in]: merchantSkuIds } });
    if (combineSkuId) conditions.push({ combine_sku_id: combineSkuId });
    if (!conditions.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            is_active: true,
            [Op.or]: conditions,
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const results = await Promise.all(
        mappings.map(async (mapping) => {
            const qty = await getQtyForMapping(companyId, mapping);
            const result = platform === 'tiktok'
                ? await callTikTokUpdateStock(mapping, qty)
                : await callShopeeUpdateStock(mapping, qty);

            if (result.success) {
                await mapping.update({
                    sync_status: 'synced',
                    last_synced_at: new Date(),
                    sync_error: null,
                });
            } else {
                await mapping.update({
                    sync_status: 'failed',
                    sync_error: result.error,
                });
            }

            return {
                mappingId: mapping.id,
                merchantSkuId: mapping.merchant_sku_id,
                combineSkuId: mapping.combine_sku_id,
                stock: qty,
                success: result.success,
                error: result.error || null,
            };
        })
    );

    return {
        total: results.length,
        synced: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
    };
};

const deductFromOrderNotification = async (platform, payload) => {
    const data = { ...payload, platform };
    const mapping = await resolvePlatformMapping(data);
    const companyId = Number(mapping.company_id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('Matched platform SKU mapping does not have a valid company_id');
        err.statusCode = 500;
        throw err;
    }

    const user = {
        companyId,
        userId: null,
        role: 'webhook',
        isOwner: false,
        is_owner: false,
    };

    const deduction = await stockService.deductStock(user, {
        platformMappingId: mapping.id,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        quantitySold: Number(data.quantitySold),
    });

    const merchantSkuIds = [
        mapping.merchant_sku_id,
        ...(deduction.deductions || []).map((item) => item.merchantSkuId),
    ].filter(Boolean);

    const sync = deduction.alreadyDeducted
        ? { markedCount: 0, merchantSkuIds: [] }
        : await markRelatedMappingsOutOfSync({
            companyId,
            merchantSkuIds,
            combineSkuId: mapping.combine_sku_id || deduction.combineSkuId || null,
        });

    const platformStockSync = (!deduction.alreadyDeducted && ['shopee', 'tiktok'].includes(data.platform))
        ? await pushRelatedPlatformStock({
            companyId,
            merchantSkuIds: sync.merchantSkuIds,
            combineSkuId: mapping.combine_sku_id || deduction.combineSkuId || null,
            platform: data.platform,
        })
        : null;

    return {
        ...deduction,
        platform: data.platform,
        platformMappingId: mapping.id,
        syncMarkedOutOfSync: sync.markedCount,
        affectedMerchantSkuIds: sync.merchantSkuIds,
        platformStockSync,
    };
};

module.exports = {
    deductFromOrderNotification,
};

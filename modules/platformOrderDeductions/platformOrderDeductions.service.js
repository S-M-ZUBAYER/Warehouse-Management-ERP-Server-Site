'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const stockService = require('../stock/stock.service');

const SHOPEE_STOCK_UPDATE_BASE_URL = process.env.SHOPEE_STOCK_UPDATE_BASE_URL || 'https://grozziie.zjweiting.com:3091';
const TIKTOK_STOCK_UPDATE_BASE_URL = process.env.TIKTOK_STOCK_UPDATE_BASE_URL || 'https://grozziie.zjweiting.com:3091';

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
console.log(mappings,"mappings,.................");

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
        attributes: ['qty_on_hand', 'qty_reserved'],
        raw: true,
    });

    return rows.reduce((sum, row) => (
        sum + Math.max(0, Number(row.qty_on_hand || 0) - Number(row.qty_reserved || 0))
    ), 0);
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
            `${SHOPEE_STOCK_UPDATE_BASE_URL}/new-shopee-open-shop/api/dev/product/update_stock/${shopId}`,
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
            `${TIKTOK_STOCK_UPDATE_BASE_URL}/tiktokshop-partner-country/api/dev/products/updateStock`,
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

const callShopeeReduceStock = async (mapping, reduceQty) => {
    const { shopId, itemId, modelId } = getShopeeIds(mapping);
    const quantity = Number(reduceQty);

    if (!shopId || !itemId || !modelId) {
        return {
            success: false,
            error: `Missing Shopee identifiers for mapping ${mapping.id}`,
        };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { success: true, skipped: true, reason: 'No Shopee quantity to reduce' };
    }

    try {
        const response = await axios.post(
            `${SHOPEE_STOCK_UPDATE_BASE_URL}/new-shopee-open-shop/api/dev/product/reduce_stock/${shopId}`,
            {
                item_id: Number(itemId),
                model_id: Number(modelId),
                reduce_quantity: quantity,
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const shopeeResponse = response.data?.shopee_response ?? response.data;
        const failureList = shopeeResponse?.response?.failure_list ?? [];
        if (failureList.length > 0 || shopeeResponse?.error) {
            return {
                success: false,
                error: `Shopee reduce failure: ${JSON.stringify(failureList.length ? failureList : shopeeResponse?.error)}`,
            };
        }

        return {
            success: true,
            previousQuantity: response.data?.previous_stock ?? null,
            newQuantity: response.data?.updated_stock ?? null,
        };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message ?? err.message,
        };
    }
};

const callTikTokReduceStock = async (mapping, reduceQty) => {
    const productId = normalizeString(mapping.platform_product_id) || normalizeString(mapping.platform_listing_id);
    const skuId = normalizeString(mapping.platform_sku_id) || normalizeString(mapping.platform_model_id);
    const warehouseId = normalizeString(mapping.platform_warehouse_id);
    const openId = normalizeString(mapping.platform_open_id);
    const cipherId = normalizeString(mapping.platform_cipher_id);
    const quantity = Number(reduceQty);

    if (!productId || !skuId || !warehouseId || !openId || !cipherId) {
        return {
            success: false,
            error: `Missing TikTok identifiers for mapping ${mapping.id}`,
        };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { success: true, skipped: true, reason: 'No TikTok quantity to reduce' };
    }

    try {
        const response = await axios.post(
            `${TIKTOK_STOCK_UPDATE_BASE_URL}/tiktokshop-partner-country/api/dev/products/reduceStock`,
            {
                skuId,
                warehouseId,
                reduceQuantity: quantity,
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

        const updateResponse = response.data?.updateResponse ?? response.data;
        if (updateResponse?.code !== undefined && updateResponse.code !== 0) {
            return {
                success: false,
                error: `TikTok reduce error: ${updateResponse?.message ?? 'Unknown'}`,
            };
        }

        return {
            success: true,
            previousQuantity: response.data?.previousQuantity ?? null,
            newQuantity: response.data?.newQuantity ?? null,
        };
    } catch (err) {
        return {
            success: false,
            error: err?.response?.data?.message ?? err.message,
        };
    }
};

const callPlatformReduceStock = (mapping, platform, reduceQty) => (
    platform === 'tiktok'
        ? callTikTokReduceStock(mapping, reduceQty)
        : callShopeeReduceStock(mapping, reduceQty)
);

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

const pushRelatedPlatformStockReduction = async ({ companyId, deductions = [], combineSkuId = null, combineDeductQty = 0, platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const deductionByMerchantSku = new Map();

    for (const item of deductions) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const deductedQty = Number(item.deductedQty || item.quantity || item.deducted || 0);
        if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0 || !Number.isFinite(deductedQty) || deductedQty <= 0) continue;
        deductionByMerchantSku.set(merchantSkuId, (deductionByMerchantSku.get(merchantSkuId) || 0) + deductedQty);
    }

    const merchantSkuIds = [...deductionByMerchantSku.keys()];
    const conditions = [];
    if (merchantSkuIds.length) conditions.push({ merchant_sku_id: { [Op.in]: merchantSkuIds } });
    if (combineSkuId && Number(combineDeductQty) > 0) conditions.push({ combine_sku_id: combineSkuId });
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
            const reduceQty = mapping.merchant_sku_id
                ? deductionByMerchantSku.get(Number(mapping.merchant_sku_id)) || 0
                : Number(combineDeductQty || 0);
            const result = await callPlatformReduceStock(mapping, platform, reduceQty);

            if (result.success) {
                const updates = [
                    mapping.update({
                        sync_status: 'synced',
                        last_synced_at: new Date(),
                        sync_error: null,
                    }),
                ];

                if (result.newQuantity !== null && result.newQuantity !== undefined) {
                    const platformProduct = await findPlatformProductForMapping(mapping, platform);
                    if (platformProduct) {
                        updates.push(platformProduct.update({
                            platform_stock: Math.max(0, Number(result.newQuantity || 0)),
                            synced_at: new Date(),
                        }));
                    }
                }

                await Promise.all(updates);
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
                reduced: reduceQty,
                platformStockBefore: result.previousQuantity ?? null,
                platformStockAfter: result.newQuantity ?? null,
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

const findPlatformProductForMapping = async (mapping, platform) => {
    const { PlatformProduct } = require('../../models');
    const productId = normalizeString(mapping.platform_product_id) ||
        normalizeString(mapping.platform_item_id) ||
        normalizeString(mapping.platform_listing_id);
    const skuId = normalizeString(mapping.platform_sku_id) ||
        normalizeString(mapping.platform_model_id);
    const warehouseId = normalizeString(mapping.platform_warehouse_id);
    const filters = [];

    if (productId) filters.push({ platform_product_id: productId });
    if (skuId) {
        filters.push({
            [Op.or]: [
                { platform_sku_id: skuId },
                { platform_model_id: skuId },
            ],
        });
    }
    if (platform === 'tiktok' && warehouseId) {
        filters.push({ platform_warehouse_id: warehouseId });
    }

    if (!filters.length) return null;

    return PlatformProduct.findOne({
        where: {
            company_id: mapping.company_id,
            platform_store_id: mapping.platform_store_id,
            platform,
            row_type: 'child',
            [Op.and]: filters,
        },
        order: [['updated_at', 'DESC'], ['id', 'DESC']],
    });
};

const aggregateManualOrderDeductions = (items = []) => {
    const totals = new Map();

    for (const item of items) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const quantity = Number(item.quantity || item.qty || 0);
        if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0 || !Number.isFinite(quantity) || quantity <= 0) continue;
        totals.set(merchantSkuId, (totals.get(merchantSkuId) || 0) + quantity);
    }

    return totals;
};

const aggregateManualOrderAdjustments = (items = []) => {
    const totals = new Map();

    for (const item of items) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const quantityDelta = Number(item.quantityDelta || item.quantity_delta || 0);
        if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0 || !Number.isFinite(quantityDelta) || quantityDelta === 0) continue;
        totals.set(merchantSkuId, (totals.get(merchantSkuId) || 0) + quantityDelta);
    }

    return totals;
};

const pushManualOrderPlatformStockAdjustment = async ({ companyId, items = [], platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const adjustmentByMerchantSku = aggregateManualOrderAdjustments(items);
    const merchantSkuIds = [...adjustmentByMerchantSku.keys()];
    const warehouseIds = [...new Set(
        items
            .map((item) => Number(item.warehouseId || item.warehouse_id))
            .filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0)
    )];

    if (!merchantSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            is_active: true,
            merchant_sku_id: { [Op.in]: merchantSkuIds },
            ...(warehouseIds.length ? {
                [Op.or]: [
                    { fulfillment_warehouse_id: { [Op.in]: warehouseIds } },
                    { fulfillment_warehouse_id: null },
                ],
            } : {}),
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
            const quantityDelta = adjustmentByMerchantSku.get(Number(mapping.merchant_sku_id)) || 0;
            const platformProduct = await findPlatformProductForMapping(mapping, platform);

            if (!platformProduct) {
                const error = `Platform stock snapshot not found for mapping ${mapping.id}`;
                await mapping.update({ sync_status: 'failed', sync_error: error });
                return {
                    mappingId: mapping.id,
                    merchantSkuId: mapping.merchant_sku_id,
                    quantityDelta,
                    success: false,
                    error,
                };
            }

            const currentPlatformStock = Math.max(0, Number(platformProduct.platform_stock || 0));
            const nextPlatformStock = Math.max(0, currentPlatformStock + quantityDelta);
            const result = platform === 'tiktok'
                ? await callTikTokUpdateStock(mapping, nextPlatformStock)
                : await callShopeeUpdateStock(mapping, nextPlatformStock);

            if (result.success) {
                await Promise.all([
                    mapping.update({
                        sync_status: 'synced',
                        last_synced_at: new Date(),
                        sync_error: null,
                    }),
                    platformProduct.update({
                        platform_stock: nextPlatformStock,
                        synced_at: new Date(),
                    }),
                ]);
            } else {
                await mapping.update({
                    sync_status: 'failed',
                    sync_error: result.error,
                });
            }

            return {
                mappingId: mapping.id,
                merchantSkuId: mapping.merchant_sku_id,
                quantityDelta,
                platformStockBefore: currentPlatformStock,
                platformStockAfter: nextPlatformStock,
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

const pushManualOrderPlatformStockDeduction = async ({ companyId, items = [], platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const deductionByMerchantSku = aggregateManualOrderDeductions(items);
    const merchantSkuIds = [...deductionByMerchantSku.keys()];
    const warehouseIds = [...new Set(
        items
            .map((item) => Number(item.warehouseId || item.warehouse_id))
            .filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0)
    )];

    if (!merchantSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            is_active: true,
            merchant_sku_id: { [Op.in]: merchantSkuIds },
            ...(warehouseIds.length ? {
                [Op.or]: [
                    { fulfillment_warehouse_id: { [Op.in]: warehouseIds } },
                    { fulfillment_warehouse_id: null },
                ],
            } : {}),
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
            const deductQty = deductionByMerchantSku.get(Number(mapping.merchant_sku_id)) || 0;
            const result = await callPlatformReduceStock(mapping, platform, deductQty);

            if (result.success) {
                const updates = [
                    mapping.update({
                        sync_status: 'synced',
                        last_synced_at: new Date(),
                        sync_error: null,
                    }),
                ];

                if (result.newQuantity !== null && result.newQuantity !== undefined) {
                    const platformProduct = await findPlatformProductForMapping(mapping, platform);
                    if (platformProduct) {
                        updates.push(platformProduct.update({
                            platform_stock: Math.max(0, Number(result.newQuantity || 0)),
                            synced_at: new Date(),
                        }));
                    }
                }

                await Promise.all(updates);
            } else {
                await mapping.update({
                    sync_status: 'failed',
                    sync_error: result.error,
                });
            }

            return {
                mappingId: mapping.id,
                merchantSkuId: mapping.merchant_sku_id,
                deducted: deductQty,
                platformStockBefore: result.previousQuantity ?? null,
                platformStockAfter: result.newQuantity ?? null,
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

const buildWebhookUser = (companyId, actor = {}) => ({
    companyId,
    userId: actor.userId || actor.id || null,
    role: actor.role || 'webhook',
    isOwner: Boolean(actor.isOwner || actor.is_owner),
    is_owner: Boolean(actor.isOwner || actor.is_owner),
});

const afterStockChangeSync = async ({ data, mapping, companyId, stockResult, skipWhenAlready = false, useReduceApi = false }) => {
    const merchantSkuIds = [
        mapping.merchant_sku_id,
        ...(stockResult.deductions || []).map((item) => item.merchantSkuId),
    ].filter(Boolean);

    const noChange = skipWhenAlready && (stockResult.alreadyDeducted || stockResult.alreadyReserved || stockResult.alreadyPacked);

    const sync = noChange
        ? { markedCount: 0, merchantSkuIds: [] }
        : await markRelatedMappingsOutOfSync({
            companyId,
            merchantSkuIds,
            combineSkuId: mapping.combine_sku_id || stockResult.combineSkuId || null,
        });

    const platformStockSync = (!noChange && ['shopee', 'tiktok'].includes(data.platform))
        ? useReduceApi
            ? await pushRelatedPlatformStockReduction({
                companyId,
                deductions: stockResult.deductions || [],
                combineSkuId: mapping.combine_sku_id || stockResult.combineSkuId || null,
                combineDeductQty: Number(data.quantitySold || 0),
                platform: data.platform,
            })
            : await pushRelatedPlatformStock({
            companyId,
            merchantSkuIds: sync.merchantSkuIds,
            combineSkuId: mapping.combine_sku_id || stockResult.combineSkuId || null,
            platform: data.platform,
        })
        : null;

    return { sync, platformStockSync };
};

const deductFromOrderNotification = async (platform, payload, actor = {}) => {
    const data = { ...payload, platform };
    const mapping = await resolvePlatformMapping(data);
    const companyId = Number(mapping.company_id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('Matched platform SKU mapping does not have a valid company_id');
        err.statusCode = 500;
        throw err;
    }

    const user = buildWebhookUser(companyId, actor);

    const deduction = await stockService.deductStock(user, {
        platformMappingId: mapping.id,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        quantitySold: Number(data.quantitySold),
    });

    const { sync, platformStockSync } = await afterStockChangeSync({
        data,
        mapping,
        companyId,
        stockResult: deduction,
        skipWhenAlready: true,
    });

    return {
        ...deduction,
        platform: data.platform,
        platformMappingId: mapping.id,
        syncMarkedOutOfSync: sync.markedCount,
        affectedMerchantSkuIds: sync.merchantSkuIds,
        platformStockSync,
    };
};

const normalizeOrderItemPayload = (body, item = {}) => {
    const order = body.order || body;
    const context = body.context || order.context || {};
    const platformOrderId = normalizeString(
        order.orderId ||
        order.orderNo ||
        order.id ||
        body.platformOrderId ||
        body.orderId
    );

    return {
        platformMappingId: body.originalPlatformMappingId || body.platformMappingId || item.platformMappingId,
        externalStoreId: order.externalStoreId || context.platform_store_id || context.external_store_id || context.storeId || body.externalStoreId,
        shopId: order.shopId || context.shop_id || context.store_shop_id || context.external_store_id || body.shopId,
        openId: order.openId || context.platform_open_id || context.open_id || context.store_open_id || context.external_store_name || body.openId,
        cipherId: order.cipherId || context.cipher || context.store_cipher || context.external_store_id || body.cipherId,
        platformOrderId,
        platformOrderItemId: item.orderItemId || item.platformOrderItemId || item.id || body.platformOrderItemId || body.orderItemId || null,
        quantitySold: Number(item.quantity || item.quantitySold || body.quantity || body.quantitySold || 1),
        itemId: item.itemId || item.platformItemId || item.productId || body.itemId,
        productId: item.productId || item.platformItemId || item.itemId || body.productId,
        modelId: item.modelId || item.skuId || body.modelId,
        skuId: item.skuId || item.modelId || body.skuId,
        listingId: item.listingId || item.productId || body.listingId,
        warehouseId: item.warehouseId || order.warehouseId || body.warehouseId,
        locationId: item.locationId || order.locationId || body.locationId,
    };
};

const findActiveSkuOverride = async ({ data, mapping, companyId }) => {
    const { PlatformOrderItemSkuOverride } = require('../../models');
    const platformOrderItemId = normalizeString(data.platformOrderItemId);
    if (!platformOrderItemId) return null;

    return PlatformOrderItemSkuOverride.findOne({
        where: {
            company_id: companyId,
            platform: data.platform,
            platform_order_id: data.platformOrderId,
            platform_order_item_id: platformOrderItemId,
            original_platform_mapping_id: mapping.id,
            status: 'active',
        },
    });
};

const packFromOrderNotification = async (platform, payload, actor = {}) => {
    const data = { ...payload, platform };
    const mapping = await resolvePlatformMapping(data);
    const companyId = Number(mapping.company_id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('Matched platform SKU mapping does not have a valid company_id');
        err.statusCode = 500;
        throw err;
    }

    const user = buildWebhookUser(companyId, actor);
    const skuOverride = await findActiveSkuOverride({ data, mapping, companyId });

    const packed = await stockService.packReservedStock(user, {
        platformMappingId: mapping.id,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        quantitySold: Number(data.quantitySold),
        overrideMerchantSkuId: skuOverride?.replacement_merchant_sku_id || null,
        overrideWarehouseId: skuOverride?.replacement_warehouse_id || null,
    });

    if (skuOverride && (packed.alreadyPacked || packed.alreadyDeducted)) {
        await skuOverride.destroy();
    }

    const { sync, platformStockSync } = await afterStockChangeSync({
        data,
        mapping,
        companyId,
        stockResult: packed,
        skipWhenAlready: true,
        useReduceApi: true,
    });

    return {
        ...packed,
        platform: data.platform,
        platformMappingId: mapping.id,
        skuOverrideId: skuOverride?.id || null,
        overrideApplied: Boolean(skuOverride),
        replacementMerchantSkuId: skuOverride?.replacement_merchant_sku_id || null,
        replacementWarehouseId: skuOverride?.replacement_warehouse_id || null,
        syncMarkedOutOfSync: sync.markedCount,
        affectedMerchantSkuIds: sync.merchantSkuIds,
        platformStockSync,
    };
};

const finalizePackedOrderNotification = async (body, actor = {}) => {
    const platform = normalizeString(body.platform)?.toLowerCase();
    const order = body.order || body;
    const context = body.context || order.context || {};
    const items = Array.isArray(order.items) ? order.items : [];

    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    if (!items.length) {
        const err = new Error('order.items is required');
        err.statusCode = 400;
        throw err;
    }

    const platformOrderId = normalizeString(
        order.orderId ||
        order.orderNo ||
        order.id ||
        body.platformOrderId ||
        body.orderId
    );

    if (!platformOrderId) {
        const err = new Error('orderId is required');
        err.statusCode = 400;
        throw err;
    }

    const results = [];
    for (const item of items) {
        const payload = normalizeOrderItemPayload(body, item);
        payload.platformOrderId = platformOrderId;

        const result = await packFromOrderNotification(platform, payload, actor);
        results.push({ itemId: payload.platformOrderItemId || payload.itemId || payload.skuId, result });
    }

    return { count: results.length, results };
};

const savePlatformOrderItemSkuOverride = async (body) => {
    const { MerchantSku, PlatformOrderItemSkuOverride, SkuWarehouseStock, Warehouse } = require('../../models');
    const platform = normalizeString(body.platform)?.toLowerCase();
    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    const data = { ...normalizeOrderItemPayload(body), platform };
    if (!data.platformOrderId) {
        const err = new Error('orderId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!data.platformOrderItemId) {
        const err = new Error('platformOrderItemId is required for SKU override');
        err.statusCode = 400;
        throw err;
    }

    const replacementMerchantSkuId = Number(body.replacementMerchantSkuId || body.merchantSkuId);
    const replacementWarehouseId = Number(body.replacementWarehouseId || body.warehouseId);
    const quantity = Number(body.quantity || data.quantitySold || 1);

    if (!Number.isInteger(replacementMerchantSkuId) || replacementMerchantSkuId <= 0) {
        const err = new Error('replacementMerchantSkuId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isInteger(replacementWarehouseId) || replacementWarehouseId <= 0) {
        const err = new Error('replacementWarehouseId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        const err = new Error('quantity must be a positive integer');
        err.statusCode = 400;
        throw err;
    }

    const mapping = await resolvePlatformMapping(data);
    const companyId = Number(mapping.company_id);
    const replacementSku = await MerchantSku.findOne({
        where: { id: replacementMerchantSkuId, company_id: companyId, status: 'active', deleted_at: null },
    });
    if (!replacementSku) {
        const err = new Error('Replacement merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    const replacementWarehouse = await Warehouse.findOne({
        where: { id: replacementWarehouseId, company_id: companyId, status: 'active' },
    });
    if (!replacementWarehouse) {
        const err = new Error('Replacement warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    const stock = await SkuWarehouseStock.findOne({
        where: {
            company_id: companyId,
            merchant_sku_id: replacementMerchantSkuId,
            warehouse_id: replacementWarehouseId,
        },
    });
    const qtyOnHand = Number(stock?.qty_on_hand || 0);
    if (!stock || qtyOnHand < quantity) {
        const err = new Error(`Insufficient replacement stock: available ${qtyOnHand}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }

    const values = {
        company_id: companyId,
        platform,
        platform_order_id: data.platformOrderId,
        platform_order_item_id: data.platformOrderItemId,
        platform_store_id: mapping.platform_store_id || null,
        shop_id: data.shopId || null,
        open_id: data.openId || null,
        cipher_id: data.cipherId || null,
        original_platform_mapping_id: mapping.id,
        original_merchant_sku_id: mapping.merchant_sku_id || null,
        original_combine_sku_id: mapping.combine_sku_id || null,
        replacement_merchant_sku_id: replacementMerchantSkuId,
        replacement_warehouse_id: replacementWarehouseId,
        quantity,
        reason: normalizeString(body.reason) || 'out_of_stock',
        note: normalizeString(body.note),
        status: 'active',
        packed_at: null,
    };

    const existing = await PlatformOrderItemSkuOverride.findOne({
        where: {
            company_id: companyId,
            platform,
            platform_order_id: data.platformOrderId,
            platform_order_item_id: data.platformOrderItemId,
        },
    });

    const override = existing
        ? await existing.update(values)
        : await PlatformOrderItemSkuOverride.create(values);

    return {
        id: override.id,
        platform: override.platform,
        platformOrderId: override.platform_order_id,
        platformOrderItemId: override.platform_order_item_id,
        originalPlatformMappingId: override.original_platform_mapping_id,
        originalMerchantSkuId: override.original_merchant_sku_id,
        originalCombineSkuId: override.original_combine_sku_id,
        replacementMerchantSkuId: override.replacement_merchant_sku_id,
        replacementWarehouseId: override.replacement_warehouse_id,
        quantity: override.quantity,
        reason: override.reason,
        note: override.note,
        status: override.status,
    };
};

const deletePlatformOrderSkuOverrides = async (body) => {
    const { PlatformOrderItemSkuOverride } = require('../../models');
    const platform = normalizeString(body.platform)?.toLowerCase();
    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    const data = { ...normalizeOrderItemPayload(body), platform };
    if (!data.platformOrderId) {
        const err = new Error('orderId is required');
        err.statusCode = 400;
        throw err;
    }

    const storeFilters = [];
    addEqualsFilter(storeFilters, 'shop_id', data.shopId);
    addEqualsFilter(storeFilters, 'shop_id', data.externalStoreId);
    addEqualsFilter(storeFilters, 'open_id', data.openId);
    addEqualsFilter(storeFilters, 'cipher_id', data.cipherId);

    const where = {
        platform,
        platform_order_id: data.platformOrderId,
        ...(data.platformOrderItemId ? { platform_order_item_id: data.platformOrderItemId } : {}),
        ...(storeFilters.length ? { [Op.or]: storeFilters } : {}),
    };

    const deletedCount = await PlatformOrderItemSkuOverride.destroy({ where });

    return {
        platform,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        deletedCount,
    };
};

module.exports = {
    deductFromOrderNotification,
    packFromOrderNotification,
    finalizePackedOrderNotification,
    savePlatformOrderItemSkuOverride,
    deletePlatformOrderSkuOverrides,
    markRelatedMappingsOutOfSync,
    pushRelatedPlatformStock,
    pushManualOrderPlatformStockDeduction,
    pushManualOrderPlatformStockAdjustment,
};

'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const stockService = require('../stock/stock.service');
const activityLogService = require('../orderActivityLogs/orderActivityLogs.service');

const normalizeBaseUrl = (value) => String(value || '').replace(/\/+$/, '');
const JAVA_API_BASE_URL = normalizeBaseUrl(process.env.JAVA_API_URL || 'https://grozziie.zjweiting.com:3091');
const SHOPEE_STOCK_UPDATE_BASE_URL = JAVA_API_BASE_URL;
const TIKTOK_STOCK_UPDATE_BASE_URL = JAVA_API_BASE_URL;

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

const getActivityStoreId = (data = {}, mapping = {}) => (
    normalizeString(data.externalStoreId) ||
    normalizeString(data.shopId) ||
    normalizeString(data.openId) ||
    normalizeString(data.cipherId) ||
    normalizeString(mapping.platform_shop_id) ||
    normalizeString(mapping.platform_open_id) ||
    normalizeString(mapping.platform_cipher_id) ||
    null
);

const getActivitySourceEventId = (data = {}, mapping = {}, eventType = 'ORDER_ACTIVITY') => (
    normalizeString(data.sourceEventId) ||
    normalizeString(data.eventId) ||
    `${data.platform}:${eventType}:${mapping.id || 'mapping'}:${data.platformOrderId || 'order'}:${data.platformOrderItemId || 'item'}`
);

const logPlatformOrderActivity = async ({ data, mapping, companyId, eventType, title, message, oldStatus = null, newStatus = null, actor = {}, metadata = {} }) => {
    const actorType = actor.actorType || 'WEBHOOK';
    const fallbackActorName = actorType === 'USER' ? 'ERP User' : `${String(data.platform || '').toUpperCase()} Webhook`;

    return activityLogService.safeCreateActivityLog({
        companyId,
        platform: data.platform,
        platformStoreId: mapping.platform_store_id || null,
        storeId: getActivityStoreId(data, mapping),
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        packageNumber: data.packageNumber || data.packageId || null,
        trackingNumber: data.trackingNumber || data.awbNumber || null,
        eventType,
        title,
        message,
        oldStatus,
        newStatus,
        actorType,
        actorId: actor.userId || actor.actorId || null,
        actorName: actor.actorName || actor.name || fallbackActorName,
        source: actor.source || (actorType === 'USER' ? 'ERP_USER_ACTION' : `${String(data.platform || '').toUpperCase()}_WEBHOOK`),
        sourceEventId: actorType === 'USER' ? null : getActivitySourceEventId(data, mapping, eventType),
        metadata: {
            platformMappingId: mapping.id,
            quantitySold: Number(data.quantitySold || 0) || undefined,
            itemId: data.itemId || undefined,
            modelId: data.modelId || undefined,
            skuId: data.skuId || undefined,
            productId: data.productId || undefined,
            ...metadata,
        },
    }, {
        actorType,
        userId: actor.userId || actor.actorId || null,
        name: actor.actorName || actor.name || fallbackActorName,
    });
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
                attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
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
        attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
    });

    if (!store) {
        const err = new Error('Platform store not found for the supplied identifiers');
        err.statusCode = 404;
        throw err;
    }

    const mappings = await PlatformSkuMapping.findAll({
        where: buildMappingWhere(data, store.id),
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { id: store.id, platform: data.platform },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
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

const lockSkuWarehouseStock = async ({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, transaction }) => {
    const stock = await SkuWarehouseStock.findOne({
        where: { company_id: companyId, merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    if (!stock) {
        const err = new Error(`No stock record for merchant SKU ${merchantSkuId} in warehouse ${warehouseId}`);
        err.statusCode = 400;
        throw err;
    }

    return stock;
};

const reserveMerchantStock = async ({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, quantity, transaction }) => {
    const stock = await lockSkuWarehouseStock({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, transaction });
    const qtyOnHand = Number(stock.qty_on_hand || 0);
    const qtyReserved = Number(stock.qty_reserved || 0);
    const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);

    if (qtyAvailable < quantity) {
        const err = new Error(`Insufficient available stock for merchant SKU ${merchantSkuId}: available ${qtyAvailable}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }

    await stock.update({ qty_reserved: qtyReserved + quantity }, { transaction });
    return merchantSkuId;
};

const releaseMerchantStock = async ({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, quantity, transaction }) => {
    const stock = await SkuWarehouseStock.findOne({
        where: { company_id: companyId, merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    if (!stock) return null;
    await stock.update({ qty_reserved: Math.max(0, Number(stock.qty_reserved || 0) - quantity) }, { transaction });
    return merchantSkuId;
};

const reserveSkuSelection = async ({ SkuWarehouseStock, CombineSkuItem, companyId, merchantSkuId, combineSkuId, warehouseId, quantity, transaction }) => {
    const affectedSkuIds = [];
    if (merchantSkuId) {
        affectedSkuIds.push(await reserveMerchantStock({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, quantity, transaction }));
        return affectedSkuIds.filter(Boolean);
    }

    const items = await CombineSkuItem.findAll({
        where: { company_id: companyId, combine_sku_id: combineSkuId },
        attributes: ['merchant_sku_id', 'quantity'],
        transaction,
    });

    for (const item of items) {
        const reserveQty = Number(item.quantity || 0) * quantity;
        affectedSkuIds.push(await reserveMerchantStock({
            SkuWarehouseStock,
            companyId,
            merchantSkuId: item.merchant_sku_id,
            warehouseId,
            quantity: reserveQty,
            transaction,
        }));
    }

    return affectedSkuIds.filter(Boolean);
};

const releaseSkuSelection = async ({ SkuWarehouseStock, CombineSkuItem, companyId, merchantSkuId, combineSkuId, warehouseId, quantity, transaction }) => {
    const affectedSkuIds = [];
    if (merchantSkuId) {
        affectedSkuIds.push(await releaseMerchantStock({ SkuWarehouseStock, companyId, merchantSkuId, warehouseId, quantity, transaction }));
        return affectedSkuIds.filter(Boolean);
    }

    if (!combineSkuId) return [];
    const items = await CombineSkuItem.findAll({
        where: { company_id: companyId, combine_sku_id: combineSkuId },
        attributes: ['merchant_sku_id', 'quantity'],
        transaction,
    });

    for (const item of items) {
        const releaseQty = Number(item.quantity || 0) * quantity;
        affectedSkuIds.push(await releaseMerchantStock({
            SkuWarehouseStock,
            companyId,
            merchantSkuId: item.merchant_sku_id,
            warehouseId,
            quantity: releaseQty,
            transaction,
        }));
    }

    return affectedSkuIds.filter(Boolean);
};

const releaseOriginalReservation = async ({ SkuWarehouseStock, CombineSkuItem, companyId, mapping, quantity, transaction }) => (
    releaseSkuSelection({
        SkuWarehouseStock,
        CombineSkuItem,
        companyId,
        merchantSkuId: mapping.merchant_sku_id,
        combineSkuId: mapping.combine_sku_id,
        warehouseId: mapping.fulfillment_warehouse_id,
        quantity,
        transaction,
    })
);

const reserveAdjustmentSelection = async ({ SkuWarehouseStock, CombineSkuItem, companyId, values, transaction }) => (
    reserveSkuSelection({
        SkuWarehouseStock,
        CombineSkuItem,
        companyId,
        merchantSkuId: values.replacement_merchant_sku_id,
        combineSkuId: values.replacement_combine_sku_id,
        warehouseId: values.replacement_warehouse_id,
        quantity: Number(values.quantity || 1),
        transaction,
    })
);

const releaseAdjustmentReservation = async ({ SkuWarehouseStock, CombineSkuItem, companyId, adjustment, transaction }) => (
    releaseSkuSelection({
        SkuWarehouseStock,
        CombineSkuItem,
        companyId,
        merchantSkuId: adjustment.replacement_merchant_sku_id,
        combineSkuId: adjustment.replacement_combine_sku_id,
        warehouseId: adjustment.replacement_warehouse_id,
        quantity: Number(adjustment.quantity || 1),
        transaction,
    })
);

const recomputeAffectedCombineSkus = async ({ CombineSkuItem, companyId, merchantSkuIds = [], combineSkuId = null }) => {
    const combineIds = new Set();
    if (combineSkuId) combineIds.add(Number(combineSkuId));

    const skuIds = [...new Set(merchantSkuIds.filter(Boolean).map((id) => Number(id)).filter(Boolean))];
    if (skuIds.length) {
        const rows = await CombineSkuItem.findAll({
            where: { company_id: companyId, merchant_sku_id: { [Op.in]: skuIds } },
            attributes: ['combine_sku_id'],
            raw: true,
        });
        rows.forEach((row) => {
            if (row.combine_sku_id) combineIds.add(Number(row.combine_sku_id));
        });
    }

    for (const id of combineIds) {
        await stockService.recomputeCombineSku(companyId, id).catch(() => null);
    }
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

const callShopeeIncreaseStock = async (mapping, increaseQty) => {
    const { shopId, itemId, modelId } = getShopeeIds(mapping);
    const quantity = Number(increaseQty);

    if (!shopId || !itemId || !modelId) {
        return {
            success: false,
            error: `Missing Shopee identifiers for mapping ${mapping.id}`,
        };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { success: true, skipped: true, reason: 'No Shopee quantity to increase' };
    }

    try {
        const response = await axios.post(
            `${SHOPEE_STOCK_UPDATE_BASE_URL}/new-shopee-open-shop/api/dev/product/increase_stock/${shopId}`,
            {
                item_id: Number(itemId),
                model_id: Number(modelId),
                increase_quantity: quantity,
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const shopeeResponse = response.data?.shopee_response ?? response.data;
        const failureList = shopeeResponse?.response?.failure_list ?? [];
        if (failureList.length > 0 || shopeeResponse?.error) {
            return {
                success: false,
                error: `Shopee increase failure: ${JSON.stringify(failureList.length ? failureList : shopeeResponse?.error)}`,
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

const callTikTokIncreaseStock = async (mapping, increaseQty) => {
    const productId = normalizeString(mapping.platform_product_id) || normalizeString(mapping.platform_listing_id);
    const skuId = normalizeString(mapping.platform_sku_id) || normalizeString(mapping.platform_model_id);
    const warehouseId = normalizeString(mapping.platform_warehouse_id);
    const openId = normalizeString(mapping.platform_open_id);
    const cipherId = normalizeString(mapping.platform_cipher_id);
    const quantity = Number(increaseQty);

    if (!productId || !skuId || !warehouseId || !openId || !cipherId) {
        return {
            success: false,
            error: `Missing TikTok identifiers for mapping ${mapping.id}`,
        };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { success: true, skipped: true, reason: 'No TikTok quantity to increase' };
    }

    try {
        const response = await axios.post(
            `${TIKTOK_STOCK_UPDATE_BASE_URL}/tiktokshop-partner-country/api/dev/products/increaseStock`,
            {
                skuId,
                warehouseId,
                increaseQuantity: quantity,
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
                error: `TikTok increase error: ${updateResponse?.message ?? 'Unknown'}`,
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

const callPlatformIncreaseStock = (mapping, platform, increaseQty) => (
    platform === 'tiktok'
        ? callTikTokIncreaseStock(mapping, increaseQty)
        : callShopeeIncreaseStock(mapping, increaseQty)
);

const isWebhookNotificationActor = (actor = {}) => !(
    actor.userId ||
    actor.id ||
    actor.actorId ||
    actor.actorType === 'USER' ||
    actor.source
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

const pushMatchedPlatformStockReduction = async ({ mapping, platform, quantity }) => {
    const reduceQty = Number(quantity);
    const result = await callPlatformReduceStock(mapping, platform, reduceQty);

    if (result.success) {
        if (result.newQuantity !== null && result.newQuantity !== undefined) {
            const platformProduct = await findPlatformProductForMapping(mapping, platform);
            if (platformProduct) {
                await platformProduct.update({
                    platform_stock: Math.max(0, Number(result.newQuantity || 0)),
                    synced_at: new Date(),
                });
            }
        }
    }

    return {
        total: 1,
        synced: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        results: [{
            mappingId: mapping.id,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            reduced: reduceQty,
            platformStockBefore: result.previousQuantity ?? null,
            platformStockAfter: result.newQuantity ?? null,
            success: result.success,
            error: result.error || null,
            skipped: Boolean(result.skipped),
        }],
    };
};

const findSiblingPlatformSkuMappings = async (sourceMapping) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const companyId = Number(sourceMapping.company_id);
    const sourceMappingId = Number(sourceMapping.id);
    const warehouseId = Number(sourceMapping.fulfillment_warehouse_id);
    const merchantSkuId = Number(sourceMapping.merchant_sku_id);
    const combineSkuId = Number(sourceMapping.combine_sku_id);
    const skuCondition = Number.isInteger(merchantSkuId) && merchantSkuId > 0
        ? { merchant_sku_id: merchantSkuId }
        : Number.isInteger(combineSkuId) && combineSkuId > 0
            ? { combine_sku_id: combineSkuId }
            : null;

    if (
        !Number.isInteger(companyId) ||
        companyId <= 0 ||
        !Number.isInteger(sourceMappingId) ||
        sourceMappingId <= 0 ||
        !Number.isInteger(warehouseId) ||
        warehouseId <= 0 ||
        !skuCondition
    ) {
        return [];
    }

    return PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            id: { [Op.ne]: sourceMappingId },
            fulfillment_warehouse_id: warehouseId,
            is_active: true,
            ...skuCondition,
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: {
                platform: { [Op.in]: ['shopee', 'tiktok'] },
                is_active: true,
            },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });
};

const pushSiblingPlatformStockChange = async ({ sourceMapping, quantity, action }) => {
    const changeQty = Number(quantity);

    if (!Number.isFinite(changeQty) || changeQty <= 0) {
        return { total: 0, synced: 0, failed: 0, results: [] };
    }

    const mappings = await findSiblingPlatformSkuMappings(sourceMapping);
    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const results = await Promise.all(mappings.map(async (mapping) => {
        const platform = normalizeString(mapping.platformStore?.platform)?.toLowerCase();
        const result = action === 'increase'
            ? await callPlatformIncreaseStock(mapping, platform, changeQty)
            : await callPlatformReduceStock(mapping, platform, changeQty);

        if (result.success && result.newQuantity !== null && result.newQuantity !== undefined) {
            const platformProduct = await findPlatformProductForMapping(mapping, platform);
            if (platformProduct) {
                await platformProduct.update({
                    platform_stock: Math.max(0, Number(result.newQuantity || 0)),
                    synced_at: new Date(),
                });
            }
        }

        return {
            mappingId: mapping.id,
            sourceMappingId: sourceMapping.id,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            fulfillmentWarehouseId: mapping.fulfillment_warehouse_id,
            platform,
            [action === 'increase' ? 'increased' : 'reduced']: changeQty,
            platformStockBefore: result.previousQuantity ?? null,
            platformStockAfter: result.newQuantity ?? null,
            success: result.success,
            error: result.error || null,
            skipped: Boolean(result.skipped),
        };
    }));

    return {
        total: results.length,
        synced: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
    };
};

const aggregateManualOrderDeductions = (items = []) => {
    const merchantTotals = new Map();
    const combineTotals = new Map();

    for (const item of items) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const combineSkuId = Number(item.combineSkuId || item.combine_sku_id);
        const quantity = Number(item.quantity || item.qty || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        if (Number.isInteger(merchantSkuId) && merchantSkuId > 0) {
            merchantTotals.set(merchantSkuId, (merchantTotals.get(merchantSkuId) || 0) + quantity);
        } else if (Number.isInteger(combineSkuId) && combineSkuId > 0) {
            combineTotals.set(combineSkuId, (combineTotals.get(combineSkuId) || 0) + quantity);
        }
    }

    return { merchantTotals, combineTotals };
};

const aggregateManualOrderAdjustments = (items = []) => {
    const merchantTotals = new Map();
    const combineTotals = new Map();

    for (const item of items) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const combineSkuId = Number(item.combineSkuId || item.combine_sku_id);
        const quantityDelta = Number(item.quantityDelta || item.quantity_delta || 0);
        if (!Number.isFinite(quantityDelta) || quantityDelta === 0) continue;
        if (Number.isInteger(merchantSkuId) && merchantSkuId > 0) {
            merchantTotals.set(merchantSkuId, (merchantTotals.get(merchantSkuId) || 0) + quantityDelta);
        } else if (Number.isInteger(combineSkuId) && combineSkuId > 0) {
            combineTotals.set(combineSkuId, (combineTotals.get(combineSkuId) || 0) + quantityDelta);
        }
    }

    return { merchantTotals, combineTotals };
};

const getManualOrderMappingWhere = ({ companyId, merchantSkuIds = [], combineSkuIds = [], warehouseIds = [], platformStoreIds = [] }) => {
    const conditions = [];
    if (merchantSkuIds.length) conditions.push({ merchant_sku_id: { [Op.in]: merchantSkuIds } });
    if (combineSkuIds.length) conditions.push({ combine_sku_id: { [Op.in]: combineSkuIds } });
    return {
        company_id: companyId,
        is_active: true,
        [Op.or]: conditions,
        ...(platformStoreIds.length ? { platform_store_id: { [Op.in]: platformStoreIds } } : {}),
        ...(warehouseIds.length ? {
            [Op.and]: [{
                [Op.or]: [
                    { fulfillment_warehouse_id: { [Op.in]: warehouseIds } },
                    { fulfillment_warehouse_id: null },
                ],
            }],
        } : {}),
    };
};

const pushManualOrderPlatformStockAdjustment = async ({ companyId, items = [], platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const { merchantTotals, combineTotals } = aggregateManualOrderAdjustments(items);
    const merchantSkuIds = [...merchantTotals.keys()];
    const combineSkuIds = [...combineTotals.keys()];
    const warehouseIds = [...new Set(items.map((item) => Number(item.warehouseId || item.warehouse_id)).filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0))];
    const platformStoreIds = [...new Set(items.map((item) => Number(item.platformStoreId || item.platform_store_id)).filter((storeId) => Number.isInteger(storeId) && storeId > 0))];

    if (!merchantSkuIds.length && !combineSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: getManualOrderMappingWhere({ companyId, merchantSkuIds, combineSkuIds, warehouseIds, platformStoreIds }),
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const results = await Promise.all(mappings.map(async (mapping) => {
        const quantityDelta = mapping.merchant_sku_id
            ? merchantTotals.get(Number(mapping.merchant_sku_id)) || 0
            : combineTotals.get(Number(mapping.combine_sku_id)) || 0;
        const platformProduct = await findPlatformProductForMapping(mapping, platform);

        if (!platformProduct) {
            const error = `Platform stock snapshot not found for mapping ${mapping.id}`;
            await mapping.update({ sync_status: 'failed', sync_error: error });
            return { mappingId: mapping.id, merchantSkuId: mapping.merchant_sku_id, combineSkuId: mapping.combine_sku_id, quantityDelta, success: false, error };
        }

        const currentPlatformStock = Math.max(0, Number(platformProduct.platform_stock || 0));
        const nextPlatformStock = Math.max(0, currentPlatformStock + quantityDelta);
        const result = platform === 'tiktok'
            ? await callTikTokUpdateStock(mapping, nextPlatformStock)
            : await callShopeeUpdateStock(mapping, nextPlatformStock);

        if (result.success) {
            await Promise.all([
                mapping.update({ sync_status: 'synced', last_synced_at: new Date(), sync_error: null }),
                platformProduct.update({ platform_stock: nextPlatformStock, synced_at: new Date() }),
            ]);
        } else {
            await mapping.update({ sync_status: 'failed', sync_error: result.error });
        }

        return {
            mappingId: mapping.id,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            quantityDelta,
            platformStockBefore: currentPlatformStock,
            platformStockAfter: nextPlatformStock,
            success: result.success,
            error: result.error || null,
        };
    }));

    return { total: results.length, synced: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length, results };
};

const pushManualOrderPlatformStockDeduction = async ({ companyId, items = [], platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const { merchantTotals, combineTotals } = aggregateManualOrderDeductions(items);
    const merchantSkuIds = [...merchantTotals.keys()];
    const combineSkuIds = [...combineTotals.keys()];
    const warehouseIds = [...new Set(items.map((item) => Number(item.warehouseId || item.warehouse_id)).filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0))];
    const platformStoreIds = [...new Set(items.map((item) => Number(item.platformStoreId || item.platform_store_id)).filter((storeId) => Number.isInteger(storeId) && storeId > 0))];

    if (!merchantSkuIds.length && !combineSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: getManualOrderMappingWhere({ companyId, merchantSkuIds, combineSkuIds, warehouseIds, platformStoreIds }),
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const results = await Promise.all(mappings.map(async (mapping) => {
        const deductQty = mapping.merchant_sku_id
            ? merchantTotals.get(Number(mapping.merchant_sku_id)) || 0
            : combineTotals.get(Number(mapping.combine_sku_id)) || 0;
        const result = await callPlatformReduceStock(mapping, platform, deductQty);

        if (result.success) {
            const updates = [mapping.update({ sync_status: 'synced', last_synced_at: new Date(), sync_error: null })];
            if (result.newQuantity !== null && result.newQuantity !== undefined) {
                const platformProduct = await findPlatformProductForMapping(mapping, platform);
                if (platformProduct) updates.push(platformProduct.update({ platform_stock: Math.max(0, Number(result.newQuantity || 0)), synced_at: new Date() }));
            }
            await Promise.all(updates);
        } else {
            await mapping.update({ sync_status: 'failed', sync_error: result.error });
        }

        return {
            mappingId: mapping.id,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            deducted: deductQty,
            platformStockBefore: result.previousQuantity ?? null,
            platformStockAfter: result.newQuantity ?? null,
            success: result.success,
            error: result.error || null,
        };
    }));

    return { total: results.length, synced: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length, results };
};

const pushManualOrderPlatformStockIncrease = async ({ companyId, items = [], platform }) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const { merchantTotals, combineTotals } = aggregateManualOrderAdjustments(items);
    const merchantSkuIds = [...merchantTotals.keys()];
    const combineSkuIds = [...combineTotals.keys()];
    const warehouseIds = [...new Set(items.map((item) => Number(item.warehouseId || item.warehouse_id)).filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0))];
    const platformStoreIds = [...new Set(items.map((item) => Number(item.platformStoreId || item.platform_store_id)).filter((storeId) => Number.isInteger(storeId) && storeId > 0))];

    if (!merchantSkuIds.length && !combineSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const mappings = await PlatformSkuMapping.findAll({
        where: getManualOrderMappingWhere({ companyId, merchantSkuIds, combineSkuIds, warehouseIds, platformStoreIds }),
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const results = await Promise.all(mappings.map(async (mapping) => {
        const increaseQty = mapping.merchant_sku_id
            ? Math.max(0, merchantTotals.get(Number(mapping.merchant_sku_id)) || 0)
            : Math.max(0, combineTotals.get(Number(mapping.combine_sku_id)) || 0);

        if (!increaseQty) {
            return {
                mappingId: mapping.id,
                merchantSkuId: mapping.merchant_sku_id,
                combineSkuId: mapping.combine_sku_id,
                increased: 0,
                success: true,
                skipped: true,
            };
        }

        const result = await callPlatformIncreaseStock(mapping, platform, increaseQty);

        if (result.success) {
            const updates = [mapping.update({ sync_status: 'synced', last_synced_at: new Date(), sync_error: null })];
            if (result.newQuantity !== null && result.newQuantity !== undefined) {
                const platformProduct = await findPlatformProductForMapping(mapping, platform);
                if (platformProduct) updates.push(platformProduct.update({ platform_stock: Math.max(0, Number(result.newQuantity || 0)), synced_at: new Date() }));
            }
            await Promise.all(updates);
        } else {
            await mapping.update({ sync_status: 'failed', sync_error: result.error });
        }

        return {
            mappingId: mapping.id,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            increased: increaseQty,
            platformStockBefore: result.previousQuantity ?? null,
            platformStockAfter: result.newQuantity ?? null,
            success: result.success,
            error: result.error || null,
        };
    }));

    return { total: results.length, synced: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length, results };
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

    const noStockChange = deduction.alreadyDeducted || deduction.alreadyReserved;
    const affectedMerchantSkuIds = [
        mapping.merchant_sku_id,
        ...(deduction.deductions || []).map((item) => item.merchantSkuId),
    ].filter(Boolean);
    let sync = { markedCount: 0, merchantSkuIds: [] };
    let platformStockSync = null;

    if (!noStockChange) {
        sync = {
            markedCount: 0,
            merchantSkuIds: [...new Set(affectedMerchantSkuIds.map((id) => Number(id)).filter(Boolean))],
        };

        platformStockSync = ['shopee', 'tiktok'].includes(data.platform)
            ? isWebhookNotificationActor(actor)
                ? await pushSiblingPlatformStockChange({
                    sourceMapping: mapping,
                    quantity: Number(data.quantitySold),
                    action: 'reduce',
                })
                : await pushMatchedPlatformStockReduction({
                    mapping,
                    platform: data.platform,
                    quantity: Number(data.quantitySold),
                })
            : null;
    }

    await logPlatformOrderActivity({
        data,
        mapping,
        companyId,
        eventType: 'ORDER_STOCK_RESERVED',
        title: deduction.alreadyDeducted || deduction.alreadyReserved
            ? 'Order stock reservation already existed'
            : 'Order stock reserved',
        message: deduction.alreadyDeducted
            ? 'Order item was already packed, so no new reservation was created.'
            : deduction.alreadyReserved
                ? 'Order item reservation was already recorded.'
                : 'Platform order notification reserved ERP stock for this order item.',
        newStatus: deduction.alreadyDeducted ? 'PACKED' : 'RESERVED',
        actor,
        metadata: {
            alreadyDeducted: Boolean(deduction.alreadyDeducted),
            alreadyReserved: Boolean(deduction.alreadyReserved),
            syncMarkedOutOfSync: sync.markedCount,
            affectedMerchantSkuIds: sync.merchantSkuIds,
            platformStockSync,
        },
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

const cancelReservedOrderNotification = async (platform, payload, actor = {}) => {
    const data = { ...payload, platform };
    const mapping = await resolvePlatformMapping(data);
    const companyId = Number(mapping.company_id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('Matched platform SKU mapping does not have a valid company_id');
        err.statusCode = 500;
        throw err;
    }

    const { sequelize, CombineSkuItem, OrderSaleLine, PlatformOrderItemSkuOverride, SkuWarehouseStock } = require('../../models');
    const platformOrderItemId = data.platformOrderItemId || null;
    const saleLineWhereClause = {
        platform_sku_mapping_id: mapping.id,
        platform_order_id: data.platformOrderId,
        platform_order_item_id: platformOrderItemId,
    };
    const saleLine = await OrderSaleLine.findOne({ where: saleLineWhereClause });

    if (saleLine?.deducted) {
        await logPlatformOrderActivity({
            data,
            mapping,
            companyId,
            eventType: 'ORDER_CANCEL_IGNORED',
            title: 'Cancel notification ignored',
            message: 'Reserved stock could not be released because this order item was already packed.',
            newStatus: 'PACKED',
            actor,
            metadata: { alreadyDeducted: true },
        });

        return {
            alreadyDeducted: true,
            alreadyPacked: true,
            alreadyReleased: false,
            platform: data.platform,
            platformOrderId: data.platformOrderId,
            platformOrderItemId,
            platformMappingId: mapping.id,
            releasedReservations: [],
            platformStockIncrease: null,
        };
    }

    const activeAdjustments = await PlatformOrderItemSkuOverride.findAll({
        where: {
            company_id: companyId,
            platform: data.platform,
            platform_order_id: data.platformOrderId,
            original_platform_mapping_id: mapping.id,
            status: 'active',
            [Op.or]: [
                { adjustment_type: 'add' },
                { platform_order_item_id: platformOrderItemId },
            ],
        },
        order: [['id', 'ASC']],
    });
    const activeExchange = activeAdjustments.find((item) =>
        item.adjustment_type === 'exchange' &&
        normalizeString(item.platform_order_item_id) === normalizeString(platformOrderItemId)
    );

    if (!saleLine && !activeAdjustments.length) {
        await logPlatformOrderActivity({
            data,
            mapping,
            companyId,
            eventType: 'ORDER_CANCEL_ALREADY_RELEASED',
            title: 'Order reservation already released',
            message: 'Cancel notification was received, but no active reservation remained for this order item.',
            newStatus: 'CANCELLED',
            actor,
            metadata: { alreadyReleased: true },
        });

        return {
            alreadyReleased: true,
            alreadyDeducted: false,
            platform: data.platform,
            platformOrderId: data.platformOrderId,
            platformOrderItemId,
            platformMappingId: mapping.id,
            releasedReservations: [],
            platformStockIncrease: null,
        };
    }

    const increaseQty = Number(saleLine?.quantity_sold || data.quantitySold || 1);
    const platformStockIncrease = await pushSiblingPlatformStockChange({
        sourceMapping: mapping,
        quantity: increaseQty,
        action: 'increase',
    });
    if (platformStockIncrease.failed > 0) {
        const err = new Error('One or more sibling platform stock increases failed');
        err.statusCode = 502;
        err.details = platformStockIncrease;
        throw err;
    }

    const affectedSkuIds = [];
    const releasedReservations = [];

    await sequelize.transaction(async (transaction) => {
        const lockedSaleLine = saleLine
            ? await OrderSaleLine.findOne({
                where: saleLineWhereClause,
                lock: transaction.LOCK.UPDATE,
                transaction,
            })
            : null;

        if (lockedSaleLine?.deducted) {
            const err = new Error('Reserved stock cannot be released because this order item is already deducted');
            err.statusCode = 409;
            throw err;
        }

        const lockedAdjustments = await PlatformOrderItemSkuOverride.findAll({
            where: {
                company_id: companyId,
                platform: data.platform,
                platform_order_id: data.platformOrderId,
                original_platform_mapping_id: mapping.id,
                status: 'active',
                [Op.or]: [
                    { adjustment_type: 'add' },
                    { platform_order_item_id: platformOrderItemId },
                ],
            },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });
        const lockedExchange = lockedAdjustments.find((item) =>
            item.adjustment_type === 'exchange' &&
            normalizeString(item.platform_order_item_id) === normalizeString(platformOrderItemId)
        );

        for (const adjustment of lockedAdjustments) {
            affectedSkuIds.push(...await releaseAdjustmentReservation({
                SkuWarehouseStock,
                CombineSkuItem,
                companyId,
                adjustment,
                transaction,
            }));
            releasedReservations.push({
                type: adjustment.adjustment_type,
                adjustmentId: adjustment.id,
                quantity: Number(adjustment.quantity || 1),
            });
            await adjustment.update({ status: 'cancelled' }, { transaction });
        }

        if (lockedSaleLine && !lockedExchange) {
            const releaseQty = Number(lockedSaleLine.quantity_sold || data.quantitySold || 1);
            affectedSkuIds.push(...await releaseOriginalReservation({
                SkuWarehouseStock,
                CombineSkuItem,
                companyId,
                mapping,
                quantity: releaseQty,
                transaction,
            }));
            releasedReservations.push({
                type: 'original',
                saleLineId: lockedSaleLine.id,
                quantity: releaseQty,
            });
        }

        if (lockedSaleLine) {
            await lockedSaleLine.destroy({ transaction });
        }
    });

    await recomputeAffectedCombineSkus({
        CombineSkuItem,
        companyId,
        merchantSkuIds: affectedSkuIds,
        combineSkuId: mapping.combine_sku_id || null,
    });

    await logPlatformOrderActivity({
        data,
        mapping,
        companyId,
        eventType: 'ORDER_CANCELLED',
        title: 'Order cancelled',
        message: 'Platform cancel notification released reserved ERP stock for this order item.',
        oldStatus: 'RESERVED',
        newStatus: 'CANCELLED',
        actor,
        metadata: {
            releasedReservations,
            platformStockIncrease,
        },
    });

    return {
        alreadyReleased: false,
        alreadyDeducted: false,
        platform: data.platform,
        platformOrderId: data.platformOrderId,
        platformOrderItemId,
        platformMappingId: mapping.id,
        releasedReservations,
        platformStockIncrease,
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
            adjustment_type: 'exchange',
            status: 'active',
        },
    });
};

const findActiveAddSkuAdjustments = async ({ data, mapping, companyId }) => {
    const { PlatformOrderItemSkuOverride } = require('../../models');
    return PlatformOrderItemSkuOverride.findAll({
        where: {
            company_id: companyId,
            platform: data.platform,
            platform_order_id: data.platformOrderId,
            original_platform_mapping_id: mapping.id,
            adjustment_type: 'add',
            status: 'active',
        },
        order: [['id', 'ASC']],
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
    const addSkuAdjustments = await findActiveAddSkuAdjustments({ data, mapping, companyId });

    const packed = await stockService.packReservedStock(user, {
        platformMappingId: mapping.id,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        quantitySold: Number(skuOverride?.quantity || data.quantitySold),
        overrideMerchantSkuId: skuOverride?.replacement_merchant_sku_id || null,
        overrideCombineSkuId: skuOverride?.replacement_combine_sku_id || null,
        overrideWarehouseId: skuOverride?.replacement_warehouse_id || null,
    });

    const addSkuPackResults = [];
    for (const addAdjustment of addSkuAdjustments) {
        const addPacked = await stockService.packReservedStock(user, {
            platformMappingId: mapping.id,
            platformOrderId: data.platformOrderId,
            platformOrderItemId: addAdjustment.platform_order_item_id,
            quantitySold: Number(addAdjustment.quantity || 1),
            overrideMerchantSkuId: addAdjustment.replacement_merchant_sku_id || null,
            overrideCombineSkuId: addAdjustment.replacement_combine_sku_id || null,
            overrideWarehouseId: addAdjustment.replacement_warehouse_id || null,
        });

        if (addPacked.alreadyPacked || addPacked.alreadyDeducted) {
            await addAdjustment.update({ status: 'packed', packed_at: addAdjustment.packed_at || new Date() });
        }

        addSkuPackResults.push({
            adjustmentId: addAdjustment.id,
            ...addPacked,
        });
    }

    if (skuOverride && (packed.alreadyPacked || packed.alreadyDeducted)) {
        await skuOverride.update({ status: 'packed', packed_at: skuOverride.packed_at || new Date() });
    }

    const inventoryOnlyPack = actor.source === 'ERP_PACK_ACTION' || isWebhookNotificationActor(actor);
    const { sync, platformStockSync } = inventoryOnlyPack
        ? { sync: { markedCount: 0, merchantSkuIds: [] }, platformStockSync: null }
        : await afterStockChangeSync({
            data,
            mapping,
            companyId,
            stockResult: packed,
            skipWhenAlready: true,
            useReduceApi: true,
        });

    await logPlatformOrderActivity({
        data,
        mapping,
        companyId,
        eventType: 'ORDER_PACKED',
        title: packed.alreadyPacked || packed.alreadyDeducted ? 'Order already packed' : 'Order packed',
        message: packed.alreadyPacked || packed.alreadyDeducted
            ? 'Pack notification was received, but this order item was already packed.'
            : 'Reserved stock was finalized/deducted for this order item.',
        oldStatus: 'RESERVED',
        newStatus: 'PACKED',
        actor,
        metadata: {
            alreadyPacked: Boolean(packed.alreadyPacked),
            alreadyDeducted: Boolean(packed.alreadyDeducted),
            skuOverrideId: skuOverride?.id || null,
            overrideApplied: Boolean(skuOverride),
            addSkuAdjustmentsPacked: addSkuPackResults,
            syncMarkedOutOfSync: sync.markedCount,
            affectedMerchantSkuIds: sync.merchantSkuIds,
            platformStockSync,
        },
    });

    return {
        ...packed,
        platform: data.platform,
        platformMappingId: mapping.id,
        skuOverrideId: skuOverride?.id || null,
        overrideApplied: Boolean(skuOverride),
        replacementMerchantSkuId: skuOverride?.replacement_merchant_sku_id || null,
        replacementCombineSkuId: skuOverride?.replacement_combine_sku_id || null,
        replacementWarehouseId: skuOverride?.replacement_warehouse_id || null,
        addSkuAdjustmentsPacked: addSkuPackResults,
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

const savePlatformOrderItemSkuOverride = async (body, actor = {}) => {
    const { sequelize, CombineSku, CombineSkuItem, MerchantSku, OrderSaleLine, PlatformOrderItemSkuOverride, SkuWarehouseStock, Warehouse } = require('../../models');
    const platform = normalizeString(body.platform)?.toLowerCase();
    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    const adjustmentType = normalizeString(body.adjustmentType || body.adjustment_type || body.type) === 'add' ? 'add' : 'exchange';
    const mappingPayload = adjustmentType === 'add' && body.sourceItem
        ? { ...body, item: body.sourceItem }
        : body;
    const data = { ...normalizeOrderItemPayload(mappingPayload, mappingPayload.item || {}), platform };
    if (!data.platformOrderId) {
        const err = new Error('orderId is required');
        err.statusCode = 400;
        throw err;
    }
    if (adjustmentType === 'exchange' && !data.platformOrderItemId) {
        const err = new Error('platformOrderItemId is required for SKU override');
        err.statusCode = 400;
        throw err;
    }
    if (adjustmentType === 'add') {
        data.platformOrderItemId = normalizeString(body.platformOrderItemId || body.orderItemId || body.addLineId)
            || `ADD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    const replacementMerchantSkuId = Number(body.replacementMerchantSkuId || body.merchantSkuId);
    const replacementCombineSkuId = Number(body.replacementCombineSkuId || body.combineSkuId);
    const replacementWarehouseId = Number(body.replacementWarehouseId || body.warehouseId);
    const quantity = Number(body.quantity || data.quantitySold || 1);
    const hasMerchantSku = Number.isInteger(replacementMerchantSkuId) && replacementMerchantSkuId > 0;
    const hasCombineSku = Number.isInteger(replacementCombineSkuId) && replacementCombineSkuId > 0;

    if (hasMerchantSku === hasCombineSku) {
        const err = new Error('Exactly one replacement SKU is required');
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

    const replacementWarehouse = await Warehouse.findOne({
        where: { id: replacementWarehouseId, company_id: companyId, status: 'active' },
    });
    if (!replacementWarehouse) {
        const err = new Error('Replacement warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    if (hasMerchantSku) {
        const replacementSku = await MerchantSku.findOne({
            where: { id: replacementMerchantSkuId, company_id: companyId, status: 'active', deleted_at: null },
        });
        if (!replacementSku) {
            const err = new Error('Replacement merchant SKU not found');
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
        const qtyReserved = Number(stock?.qty_reserved || 0);
        const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);
        if (!stock || qtyAvailable < quantity) {
            const err = new Error(`Insufficient replacement stock: available ${qtyAvailable}, requested ${quantity}`);
            err.statusCode = 400;
            throw err;
        }
    } else {
        const replacementSku = await CombineSku.findOne({
            where: { id: replacementCombineSkuId, company_id: companyId, warehouse_id: replacementWarehouseId, status: 'active', deleted_at: null },
        });
        if (!replacementSku) {
            const err = new Error('Replacement combine SKU not found in this warehouse');
            err.statusCode = 404;
            throw err;
        }

        const items = await CombineSkuItem.findAll({
            where: { company_id: companyId, combine_sku_id: replacementCombineSkuId },
            attributes: ['merchant_sku_id', 'quantity'],
        });
        if (!items.length) {
            const err = new Error('Replacement combine SKU has no child SKU items');
            err.statusCode = 400;
            throw err;
        }

        for (const item of items) {
            const requiredQty = Number(item.quantity || 0) * quantity;
            const stock = await SkuWarehouseStock.findOne({
                where: {
                    company_id: companyId,
                    merchant_sku_id: item.merchant_sku_id,
                    warehouse_id: replacementWarehouseId,
                },
            });
            const qtyOnHand = Number(stock?.qty_on_hand || 0);
            const qtyReserved = Number(stock?.qty_reserved || 0);
            const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);
            if (!stock || qtyAvailable < requiredQty) {
                const err = new Error(`Insufficient replacement stock: available ${qtyAvailable}, requested ${requiredQty}`);
                err.statusCode = 400;
                throw err;
            }
        }
    }

    const values = {
        company_id: companyId,
        platform,
        platform_order_id: data.platformOrderId,
        platform_order_item_id: data.platformOrderItemId,
        adjustment_type: adjustmentType,
        platform_store_id: mapping.platform_store_id || null,
        shop_id: data.shopId || null,
        open_id: data.openId || null,
        cipher_id: data.cipherId || null,
        original_platform_mapping_id: mapping.id,
        original_merchant_sku_id: mapping.merchant_sku_id || null,
        original_combine_sku_id: mapping.combine_sku_id || null,
        replacement_merchant_sku_id: hasMerchantSku ? replacementMerchantSkuId : null,
        replacement_combine_sku_id: hasCombineSku ? replacementCombineSkuId : null,
        replacement_warehouse_id: replacementWarehouseId,
        quantity,
        source_tab: normalizeString(body.sourceTab || body.source_tab),
        display_section: normalizeString(body.displaySection || body.display_section),
        reason: normalizeString(body.reason) || 'out_of_stock',
        note: normalizeString(body.note),
        status: 'active',
        packed_at: null,
    };

    let override;
    const affectedSkuIds = [];

    await sequelize.transaction(async (transaction) => {
        const existing = await PlatformOrderItemSkuOverride.findOne({
            where: {
                company_id: companyId,
                platform,
                platform_order_id: data.platformOrderId,
                platform_order_item_id: data.platformOrderItemId,
            },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        if (existing?.status === 'packed') {
            const err = new Error('Packed SKU adjustment cannot be changed');
            err.statusCode = 400;
            throw err;
        }

        if (existing) {
            affectedSkuIds.push(...await releaseAdjustmentReservation({
                SkuWarehouseStock,
                CombineSkuItem,
                companyId,
                adjustment: existing,
                transaction,
            }));
        } else if (adjustmentType === 'exchange') {
            const originalSaleLine = await OrderSaleLine.findOne({
                where: {
                    platform_sku_mapping_id: mapping.id,
                    platform_order_id: data.platformOrderId,
                    platform_order_item_id: data.platformOrderItemId || null,
                    deducted: false,
                },
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            const originalReleaseQty = Number(originalSaleLine?.quantity_sold || data.quantitySold || 1);

            if (originalReleaseQty > 0) {
                affectedSkuIds.push(...await releaseOriginalReservation({
                    SkuWarehouseStock,
                    CombineSkuItem,
                    companyId,
                    mapping,
                    quantity: originalReleaseQty,
                    transaction,
                }));
            }
        }

        affectedSkuIds.push(...await reserveAdjustmentSelection({
            SkuWarehouseStock,
            CombineSkuItem,
            companyId,
            values,
            transaction,
        }));

        override = existing
            ? await existing.update(values, { transaction })
            : await PlatformOrderItemSkuOverride.create(values, { transaction });

        await OrderSaleLine.findOrCreate({
            where: {
                platform_sku_mapping_id: mapping.id,
                platform_order_id: data.platformOrderId,
                platform_order_item_id: data.platformOrderItemId || null,
            },
            defaults: {
                company_id: companyId,
                platform_sku_mapping_id: mapping.id,
                platform_order_id: data.platformOrderId,
                platform_order_item_id: data.platformOrderItemId || null,
                quantity_sold: quantity,
                deducted: false,
                deducted_at: null,
                sold_at: new Date(),
            },
            transaction,
        });
    });

    await recomputeAffectedCombineSkus({
        CombineSkuItem,
        companyId,
        merchantSkuIds: affectedSkuIds,
        combineSkuId: hasCombineSku ? replacementCombineSkuId : null,
    });

    await logPlatformOrderActivity({
        data,
        mapping,
        companyId,
        eventType: adjustmentType === 'add' ? 'ORDER_SKU_ADDED' : 'ORDER_SKU_EXCHANGED',
        title: adjustmentType === 'add' ? 'Order SKU added' : 'Order SKU exchanged',
        message: adjustmentType === 'add'
            ? 'A user added an extra SKU line for this platform order.'
            : 'A user changed the SKU allocation for this platform order item.',
        newStatus: 'SKU_ADJUSTED',
        actor,
        metadata: {
            adjustmentId: override.id,
            adjustmentType: override.adjustment_type,
            replacementMerchantSkuId: override.replacement_merchant_sku_id,
            replacementCombineSkuId: override.replacement_combine_sku_id,
            replacementWarehouseId: override.replacement_warehouse_id,
            quantity: override.quantity,
            sourceTab: override.source_tab,
            displaySection: override.display_section,
            reason: override.reason,
        },
    });

    return {
        id: override.id,
        platform: override.platform,
        platformOrderId: override.platform_order_id,
        platformOrderItemId: override.platform_order_item_id,
        adjustmentType: override.adjustment_type,
        originalPlatformMappingId: override.original_platform_mapping_id,
        originalMerchantSkuId: override.original_merchant_sku_id,
        originalCombineSkuId: override.original_combine_sku_id,
        replacementMerchantSkuId: override.replacement_merchant_sku_id,
        replacementCombineSkuId: override.replacement_combine_sku_id,
        replacementWarehouseId: override.replacement_warehouse_id,
        quantity: override.quantity,
        sourceTab: override.source_tab,
        displaySection: override.display_section,
        reason: override.reason,
        note: override.note,
        status: override.status,
    };
};

const parseOrderIds = (value) => {
    if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean);
    const text = normalizeString(value);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map(normalizeString).filter(Boolean);
    } catch (_err) {
        // Fall back to comma-separated IDs.
    }
    return text.split(',').map(normalizeString).filter(Boolean);
};

const getSkuDisplay = (sku, fallbackId) => ({
    id: sku?.id || fallbackId || null,
    sku: sku?.sku_name || sku?.sku || sku?.combine_sku_code || null,
    name: sku?.sku_title || sku?.combine_name || sku?.name || sku?.sku_name || sku?.combine_sku_code || null,
    image: sku?.image_url || null,
});

const serializeSkuAdjustment = (row) => {
    const plain = row?.get ? row.get({ plain: true }) : row;
    const originalSku = plain.originalMerchantSku
        ? getSkuDisplay(plain.originalMerchantSku, plain.original_merchant_sku_id)
        : getSkuDisplay(plain.originalCombineSku, plain.original_combine_sku_id);
    const replacementSku = plain.replacementMerchantSku
        ? getSkuDisplay(plain.replacementMerchantSku, plain.replacement_merchant_sku_id)
        : getSkuDisplay(plain.replacementCombineSku, plain.replacement_combine_sku_id);

    return {
        id: plain.id,
        platform: plain.platform,
        platformOrderId: plain.platform_order_id,
        platformOrderItemId: plain.platform_order_item_id,
        adjustmentType: plain.adjustment_type || 'exchange',
        originalPlatformMappingId: plain.original_platform_mapping_id,
        originalMerchantSkuId: plain.original_merchant_sku_id,
        originalCombineSkuId: plain.original_combine_sku_id,
        replacementMerchantSkuId: plain.replacement_merchant_sku_id,
        replacementCombineSkuId: plain.replacement_combine_sku_id,
        replacementWarehouseId: plain.replacement_warehouse_id,
        replacementWarehouseName: plain.replacementWarehouse?.name || null,
        quantity: plain.quantity,
        sourceTab: plain.source_tab,
        displaySection: plain.display_section,
        reason: plain.reason,
        note: plain.note,
        status: plain.status,
        originalSku,
        replacementSku,
    };
};

const listPlatformOrderSkuAdjustments = async (query = {}) => {
    const { CombineSku, MerchantSku, PlatformOrderItemSkuOverride, Warehouse } = require('../../models');
    const platform = normalizeString(query.platform)?.toLowerCase();
    const orderIds = parseOrderIds(query.orderIds || query.orderId || query.platformOrderId);
    const summaryOnly = String(query.summary || query.summaryOnly || '').toLowerCase() === 'true';
    const platformStoreId = normalizeString(query.platformStoreId || query.platform_store_id);
    const excludeWithdraw = String(query.excludeWithdraw || '').toLowerCase() === 'true';

    if (platform && !['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }
    if (!orderIds.length && !summaryOnly) return [];

    const where = {
        ...(platform ? { platform } : {}),
        ...(orderIds.length ? { platform_order_id: { [Op.in]: orderIds } } : {}),
        ...(platformStoreId ? { platform_store_id: platformStoreId } : {}),
        ...(excludeWithdraw
            ? { [Op.or]: [{ source_tab: { [Op.ne]: 'Withdraw' } }, { source_tab: null }] }
            : {}),
        status: 'active',
    };

    if (summaryOnly) {
        const rows = await PlatformOrderItemSkuOverride.findAll({
            where,
            attributes: ['id', 'platform', 'platform_order_id', 'adjustment_type', 'source_tab', 'display_section'],
            order: [['platform_order_id', 'ASC'], ['id', 'ASC']],
            raw: true,
        });

        return rows.map((row) => ({
            id: row.id,
            platform: row.platform,
            platformOrderId: row.platform_order_id,
            adjustmentType: row.adjustment_type,
            sourceTab: row.source_tab,
            displaySection: row.display_section,
        }));
    }

    const rows = await PlatformOrderItemSkuOverride.findAll({
        where,
        include: [
            { model: MerchantSku, as: 'originalMerchantSku', attributes: ['id', 'sku_name', 'sku_title', 'image_url'], required: false },
            { model: CombineSku, as: 'originalCombineSku', attributes: ['id', 'combine_sku_code', 'combine_name', 'image_url'], required: false },
            { model: MerchantSku, as: 'replacementMerchantSku', attributes: ['id', 'sku_name', 'sku_title', 'image_url'], required: false },
            { model: CombineSku, as: 'replacementCombineSku', attributes: ['id', 'combine_sku_code', 'combine_name', 'image_url'], required: false },
            { model: Warehouse, as: 'replacementWarehouse', attributes: ['id', 'name', 'code'], required: false },
        ],
        order: [['platform_order_id', 'ASC'], ['adjustment_type', 'DESC'], ['id', 'ASC']],
    });

    return rows.map(serializeSkuAdjustment);
};

const deletePlatformOrderSkuOverrides = async (body, actor = {}) => {
    const { sequelize, CombineSkuItem, OrderSaleLine, PlatformOrderItemSkuOverride, PlatformSkuMapping, SkuWarehouseStock } = require('../../models');
    const platform = normalizeString(body.platform)?.toLowerCase();
    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    const data = { ...normalizeOrderItemPayload(body), platform };
    const adjustmentId = Number(body.adjustmentId || body.id || 0);
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
        ...(Number.isInteger(adjustmentId) && adjustmentId > 0 ? { id: adjustmentId } : {}),
        platform,
        platform_order_id: data.platformOrderId,
        ...(data.platformOrderItemId ? { platform_order_item_id: data.platformOrderItemId } : {}),
        ...(normalizeString(body.adjustmentType || body.adjustment_type) ? { adjustment_type: normalizeString(body.adjustmentType || body.adjustment_type) } : {}),
        ...(storeFilters.length ? { [Op.or]: storeFilters } : {}),
    };

    const affectedSkuIds = [];
    const affectedCompanyIds = new Set();
    const deletedLogs = [];
    let deletedCount = 0;

    await sequelize.transaction(async (transaction) => {
        const rows = await PlatformOrderItemSkuOverride.findAll({
            where,
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        for (const adjustment of rows) {
            if (adjustment.status === 'packed') {
                const err = new Error('Packed SKU adjustment cannot be deleted');
                err.statusCode = 400;
                throw err;
            }

            const companyId = Number(adjustment.company_id);
            affectedCompanyIds.add(companyId);
            affectedSkuIds.push(...await releaseAdjustmentReservation({
                SkuWarehouseStock,
                CombineSkuItem,
                companyId,
                adjustment,
                transaction,
            }));

            const mapping = await PlatformSkuMapping.findOne({
                where: { id: adjustment.original_platform_mapping_id, company_id: companyId },
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (adjustment.adjustment_type === 'exchange') {
                const saleLine = await OrderSaleLine.findOne({
                    where: {
                        platform_sku_mapping_id: adjustment.original_platform_mapping_id,
                        platform_order_id: adjustment.platform_order_id,
                        platform_order_item_id: adjustment.platform_order_item_id || null,
                        deducted: false,
                    },
                    lock: transaction.LOCK.UPDATE,
                    transaction,
                });

                if (mapping && saleLine) {
                    affectedSkuIds.push(...await reserveSkuSelection({
                        SkuWarehouseStock,
                        CombineSkuItem,
                        companyId,
                        merchantSkuId: mapping.merchant_sku_id,
                        combineSkuId: mapping.combine_sku_id,
                        warehouseId: mapping.fulfillment_warehouse_id,
                        quantity: Number(saleLine.quantity_sold || adjustment.quantity || 1),
                        transaction,
                    }));
                }
            } else if (adjustment.adjustment_type === 'add') {
                await OrderSaleLine.destroy({
                    where: {
                        platform_sku_mapping_id: adjustment.original_platform_mapping_id,
                        platform_order_id: adjustment.platform_order_id,
                        platform_order_item_id: adjustment.platform_order_item_id || null,
                        deducted: false,
                    },
                    transaction,
                });
            }

            await adjustment.destroy({ transaction });
            deletedLogs.push({
                companyId,
                data: {
                    ...data,
                    platformOrderItemId: adjustment.platform_order_item_id,
                },
                mapping: mapping || {
                    id: adjustment.original_platform_mapping_id,
                    platform_store_id: adjustment.platform_store_id,
                    platform_shop_id: adjustment.shop_id,
                    platform_open_id: adjustment.open_id,
                    platform_cipher_id: adjustment.cipher_id,
                },
                adjustment: {
                    id: adjustment.id,
                    adjustmentType: adjustment.adjustment_type,
                    replacementMerchantSkuId: adjustment.replacement_merchant_sku_id,
                    replacementCombineSkuId: adjustment.replacement_combine_sku_id,
                    replacementWarehouseId: adjustment.replacement_warehouse_id,
                    quantity: adjustment.quantity,
                    sourceTab: adjustment.source_tab,
                    displaySection: adjustment.display_section,
                },
            });
            deletedCount += 1;
        }
    });

    if (affectedSkuIds.length) {
        for (const companyId of affectedCompanyIds) {
            await recomputeAffectedCombineSkus({ CombineSkuItem, companyId, merchantSkuIds: affectedSkuIds }).catch(() => null);
        }
    }

    for (const deleted of deletedLogs) {
        await logPlatformOrderActivity({
            data: deleted.data,
            mapping: deleted.mapping,
            companyId: deleted.companyId,
            eventType: 'ORDER_SKU_ADJUSTMENT_DELETED',
            title: 'Order SKU adjustment deleted',
            message: 'A user deleted an active SKU adjustment for this platform order.',
            newStatus: 'SKU_ADJUSTMENT_DELETED',
            actor,
            metadata: deleted.adjustment,
        });
    }

    return {
        platform,
        platformOrderId: data.platformOrderId,
        platformOrderItemId: data.platformOrderItemId || null,
        adjustmentId: Number.isInteger(adjustmentId) && adjustmentId > 0 ? adjustmentId : null,
        deletedCount,
    };
};

module.exports = {
    deductFromOrderNotification,
    cancelReservedOrderNotification,
    packFromOrderNotification,
    finalizePackedOrderNotification,
    savePlatformOrderItemSkuOverride,
    listPlatformOrderSkuAdjustments,
    deletePlatformOrderSkuOverrides,
    markRelatedMappingsOutOfSync,
    pushRelatedPlatformStock,
    pushManualOrderPlatformStockDeduction,
    pushManualOrderPlatformStockAdjustment,
    pushManualOrderPlatformStockIncrease,
};

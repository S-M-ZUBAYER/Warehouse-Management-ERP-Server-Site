'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const SHOPEE_STOCK_UPDATE_BASE_URL = process.env.SHOPEE_STOCK_UPDATE_BASE_URL || 'https://grozziie.zjweiting.com:3091';
const TIKTOK_STOCK_UPDATE_BASE_URL = process.env.TIKTOK_STOCK_UPDATE_BASE_URL || 'https://grozziie.zjweiting.com:3091';

const normalizeString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const generateOutboundId = async (companyId, t) => {
    const { OutboundOrder } = require('../../models');
    const year = new Date().getFullYear();
    const prefix = `OB-${year}-`;
    const last = await OutboundOrder.findOne({
        where: {
            company_id: companyId,
            outbound_id: { [Op.like]: `${prefix}%` },
        },
        order: [['id', 'DESC']],
        lock: t.LOCK.UPDATE,
        transaction: t,
    });
    const seq = last ? parseInt(String(last.outbound_id).replace(prefix, ''), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(6, '0')}`;
};

const queueCombineRecompute = async (companyId, merchantSkuIds, warehouseId, recomputeNow = true) => {
    if (!merchantSkuIds.length || !warehouseId) return [];
    const { CombineSku, CombineSkuItem } = require('../../models');
    const items = await CombineSkuItem.findAll({
        where: { merchant_sku_id: { [Op.in]: merchantSkuIds }, company_id: companyId },
        attributes: ['combine_sku_id'],
        include: [{
            model: CombineSku,
            as: 'combineSku',
            attributes: [],
            required: true,
            where: { company_id: companyId, warehouse_id: warehouseId, deleted_at: null },
        }],
        group: ['combine_sku_id'],
        raw: true,
    });
    const ids = [...new Set(items.map((i) => i.combine_sku_id))];
    if (!ids.length) return [];

    if (recomputeNow) {
        const stockService = require('../stock/stock.service');
        await Promise.all(ids.map((id) => stockService.recomputeCombineSku(companyId, id)));
    }

    const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
    ids.forEach((id) => {
        const payload = JSON.stringify({ companyId, combineSkuId: id });
        if (pipeline.rPush) pipeline.rPush('queue:combine_sku_recompute', payload);
        else pipeline.rpush('queue:combine_sku_recompute', payload);
    });
    await pipeline.exec();
    return ids;
};

const getPlatformQtyForOutboundMapping = async (companyId, mapping) => {
    if (mapping.merchant_sku_id) {
        const { SkuWarehouseStock } = require('../../models');
        const where = {
            company_id: companyId,
            merchant_sku_id: mapping.merchant_sku_id,
        };
        if (mapping.fulfillment_warehouse_id) where.warehouse_id = mapping.fulfillment_warehouse_id;

        const rows = await SkuWarehouseStock.findAll({
            where,
            attributes: ['qty_on_hand', 'qty_reserved'],
            raw: true,
        });

        return rows.reduce((sum, row) => (
            sum + Math.max(0, Number(row.qty_on_hand || 0) - Number(row.qty_reserved || 0))
        ), 0);
    }

    if (mapping.combine_sku_id) {
        const stockService = require('../stock/stock.service');
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
        return { success: false, error: `Missing Shopee identifiers for mapping ${mapping.id}` };
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
            return { success: false, error: `Shopee failure: ${JSON.stringify(failureList)}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message ?? err.message };
    }
};

const callTikTokUpdateStock = async (mapping, qty) => {
    const productId = normalizeString(mapping.platform_product_id) || normalizeString(mapping.platform_listing_id);
    const skuId = normalizeString(mapping.platform_sku_id) || normalizeString(mapping.platform_model_id);
    const warehouseId = normalizeString(mapping.platform_warehouse_id);
    const openId = normalizeString(mapping.platform_open_id);
    const cipherId = normalizeString(mapping.platform_cipher_id);

    if (!productId || !skuId || !warehouseId || !openId || !cipherId) {
        return { success: false, error: `Missing TikTok identifiers for mapping ${mapping.id}` };
    }

    try {
        const response = await axios.post(
            `${TIKTOK_STOCK_UPDATE_BASE_URL}/tiktokshop-partner-country/api/dev/products/updateStock`,
            {
                skus: [{
                    id: skuId,
                    inventory: [{ quantity: qty, warehouseId }],
                }],
            },
            {
                params: { productId, openId, cipher: cipherId },
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (response.data?.code !== 0) {
            return { success: false, error: `TikTok error: ${response.data?.message ?? 'Unknown'}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message ?? err.message };
    }
};

const callShopeeReduceStock = async (mapping, reduceQty) => {
    const { shopId, itemId, modelId } = getShopeeIds(mapping);
    const quantity = Number(reduceQty);
    if (!shopId || !itemId || !modelId) {
        return { success: false, error: `Missing Shopee identifiers for mapping ${mapping.id}` };
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
            return { success: false, error: `Shopee reduce failure: ${JSON.stringify(failureList.length ? failureList : shopeeResponse?.error)}` };
        }
        return {
            success: true,
            previousQuantity: response.data?.previous_stock ?? null,
            newQuantity: response.data?.updated_stock ?? null,
        };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message ?? err.message };
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
        return { success: false, error: `Missing TikTok identifiers for mapping ${mapping.id}` };
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
                params: { productId, openId, cipher: cipherId },
                headers: { 'Content-Type': 'application/json' },
            }
        );

        const updateResponse = response.data?.updateResponse ?? response.data;
        if (updateResponse?.code !== undefined && updateResponse.code !== 0) {
            return { success: false, error: `TikTok reduce error: ${updateResponse?.message ?? 'Unknown'}` };
        }
        return {
            success: true,
            previousQuantity: response.data?.previousQuantity ?? null,
            newQuantity: response.data?.newQuantity ?? null,
        };
    } catch (err) {
        return { success: false, error: err?.response?.data?.message ?? err.message };
    }
};

const callPlatformReduceStock = (mapping, platform, reduceQty) => (
    platform === 'tiktok'
        ? callTikTokReduceStock(mapping, reduceQty)
        : callShopeeReduceStock(mapping, reduceQty)
);

const syncOutboundMappedPlatformStock = async ({ companyId, merchantSkuIds = [], combineSkuIds = [] }) => {
    const uniqueMerchantSkuIds = [...new Set(merchantSkuIds.filter(Boolean).map((id) => Number(id)))];
    const uniqueCombineSkuIds = [...new Set(combineSkuIds.filter(Boolean).map((id) => Number(id)))];
    const conditions = [];

    if (uniqueMerchantSkuIds.length) conditions.push({ merchant_sku_id: { [Op.in]: uniqueMerchantSkuIds } });
    if (uniqueCombineSkuIds.length) conditions.push({ combine_sku_id: { [Op.in]: uniqueCombineSkuIds } });
    if (!conditions.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            is_active: true,
            deleted_at: null,
            [Op.or]: conditions,
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform: { [Op.in]: ['shopee', 'tiktok'] }, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync', sync_error: null },
        {
            where: {
                id: { [Op.in]: mappings.map((mapping) => mapping.id) },
                company_id: companyId,
            },
        }
    );

    const results = await Promise.all(mappings.map(async (mapping) => {
        const platform = mapping.platformStore?.platform;
        const stock = await getPlatformQtyForOutboundMapping(companyId, mapping);
        const result = platform === 'tiktok'
            ? await callTikTokUpdateStock(mapping, stock)
            : await callShopeeUpdateStock(mapping, stock);

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
            platform,
            merchantSkuId: mapping.merchant_sku_id,
            combineSkuId: mapping.combine_sku_id,
            stock,
            success: result.success,
            error: result.error || null,
        };
    }));

    return {
        total: results.length,
        synced: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
    };
};

const reduceOutboundMappedPlatformStock = async ({ companyId, items = [] }) => {
    const deductionByMerchantSku = new Map();
    for (const item of items) {
        const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id);
        const quantity = Number(item.quantity || item.qty || item.qty_expected || 0);
        if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0 || !Number.isFinite(quantity) || quantity <= 0) continue;
        deductionByMerchantSku.set(merchantSkuId, (deductionByMerchantSku.get(merchantSkuId) || 0) + quantity);
    }

    const merchantSkuIds = [...deductionByMerchantSku.keys()];
    if (!merchantSkuIds.length) return { total: 0, synced: 0, failed: 0, results: [] };

    const { PlatformSkuMapping, PlatformStore, PlatformProduct } = require('../../models');
    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            is_active: true,
            deleted_at: null,
            merchant_sku_id: { [Op.in]: merchantSkuIds },
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            where: { platform: { [Op.in]: ['shopee', 'tiktok'] }, is_active: true },
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id'],
            required: true,
        }],
    });

    if (!mappings.length) return { total: 0, synced: 0, failed: 0, results: [] };

    await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync', sync_error: null },
        {
            where: {
                id: { [Op.in]: mappings.map((mapping) => mapping.id) },
                company_id: companyId,
            },
        }
    );

    const results = await Promise.all(mappings.map(async (mapping) => {
        const platform = mapping.platformStore?.platform;
        const reduceQty = deductionByMerchantSku.get(Number(mapping.merchant_sku_id)) || 0;
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
                const productId = normalizeString(mapping.platform_product_id) ||
                    normalizeString(mapping.platform_item_id) ||
                    normalizeString(mapping.platform_listing_id);
                const skuId = normalizeString(mapping.platform_sku_id) ||
                    normalizeString(mapping.platform_model_id);
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

                if (filters.length) {
                    updates.push(PlatformProduct.update(
                        {
                            platform_stock: Math.max(0, Number(result.newQuantity || 0)),
                            synced_at: new Date(),
                        },
                        {
                            where: {
                                company_id: companyId,
                                platform_store_id: mapping.platform_store_id,
                                platform,
                                row_type: 'child',
                                [Op.and]: filters,
                            },
                        }
                    ));
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
            platform,
            merchantSkuId: mapping.merchant_sku_id,
            reduced: reduceQty,
            platformStockBefore: result.previousQuantity ?? null,
            platformStockAfter: result.newQuantity ?? null,
            success: result.success,
            error: result.error || null,
        };
    }));

    return {
        total: results.length,
        synced: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
    };
};

const hydrateOutboundStockAvailability = async (companyId, orders) => {
    const orderList = Array.isArray(orders) ? orders : [orders].filter(Boolean);
    const pairs = [];

    orderList.forEach((order) => {
        const warehouseId = Number(order?.warehouse_id);
        (order?.lines || []).forEach((line) => {
            const merchantSkuId = Number(line?.merchant_sku_id);
            if (warehouseId && merchantSkuId) pairs.push({ warehouseId, merchantSkuId });
        });
    });

    const uniqueMerchantSkuIds = [...new Set(pairs.map((pair) => pair.merchantSkuId))];
    const uniqueWarehouseIds = [...new Set(pairs.map((pair) => pair.warehouseId))];
    if (!uniqueMerchantSkuIds.length || !uniqueWarehouseIds.length) return orders;

    const { SkuWarehouseStock } = require('../../models');
    const stocks = await SkuWarehouseStock.findAll({
        where: {
            company_id: companyId,
            merchant_sku_id: { [Op.in]: uniqueMerchantSkuIds },
            warehouse_id: { [Op.in]: uniqueWarehouseIds },
        },
        attributes: ['merchant_sku_id', 'warehouse_id', 'qty_on_hand', 'qty_reserved'],
        raw: true,
    });

    const stockMap = new Map(stocks.map((stock) => [
        `${Number(stock.merchant_sku_id)}:${Number(stock.warehouse_id)}`,
        stock,
    ]));

    orderList.forEach((order) => {
        const warehouseId = Number(order?.warehouse_id);
        (order?.lines || []).forEach((line) => {
            const merchantSku = line?.merchantSku;
            if (!merchantSku) return;
            const stock = stockMap.get(`${Number(line.merchant_sku_id)}:${warehouseId}`);
            const qtyOnHand = Number(stock?.qty_on_hand || 0);
            const qtyReserved = Number(stock?.qty_reserved || 0);
            const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);

            merchantSku.setDataValue('qty_on_hand', qtyOnHand);
            merchantSku.setDataValue('qty_reserved', qtyReserved);
            merchantSku.setDataValue('qty_available', qtyAvailable);
            merchantSku.setDataValue('available_for_platform', qtyAvailable);
        });
    });

    return orders;
};

const getOutboundOrders = async (user, filters = {}) => {
    const { OutboundOrder, OutboundOrderLine, MerchantSku, Warehouse } = require('../../models');
    const {
        page = 1,
        limit = 20,
        search,
        warehouseId,
        status,
        dateFrom,
        dateTo,
        sortBy = 'created_at',
        sortOrder = 'DESC',
    } = filters;

    const where = { company_id: user.companyId, deleted_at: null };
    if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;
    if (status && status !== 'all') where.status = status;
    if (search) {
        where[Op.or] = [
            { outbound_id: { [Op.like]: `%${search}%` } },
            { tracking_number: { [Op.like]: `%${search}%` } },
            { notes: { [Op.like]: `%${search}%` } },
        ];
    }
    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) where.created_at[Op.lte] = new Date(`${dateTo} 23:59:59`);
    }

    const validSort = {
        created_at: 'created_at',
        updated_at: 'updated_at',
        estimated_arrival: 'estimated_arrival',
        outbound_id: 'outbound_id',
    };
    const orderField = validSort[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const pageNumber = parseInt(page, 10) || 1;
    const pageLimit = parseInt(limit, 10) || 20;
    const offset = (pageNumber - 1) * pageLimit;

    const { count, rows } = await OutboundOrder.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code', 'location', 'city', 'country'], required: false },
            {
                model: OutboundOrderLine,
                as: 'lines',
                include: [{
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
                }],
            },
        ],
        order: [[orderField, orderDir]],
        limit: pageLimit,
        offset,
        distinct: true,
    });

    await hydrateOutboundStockAvailability(user.companyId, rows);

    return {
        data: rows,
        pagination: {
            total: count,
            page: pageNumber,
            limit: pageLimit,
            totalPages: Math.ceil(count / pageLimit),
        },
    };
};

const getOutboundOrderById = async (user, outboundOrderId) => {
    const { OutboundOrder, OutboundOrderLine, MerchantSku, Warehouse } = require('../../models');
    const order = await OutboundOrder.findOne({
        where: { id: outboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code', 'location', 'city', 'country'], required: false },
            {
                model: OutboundOrderLine,
                as: 'lines',
                include: [{
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price'],
                }],
            },
        ],
    });

    if (!order) {
        const err = new Error('Outbound order not found');
        err.statusCode = 404;
        throw err;
    }
    await hydrateOutboundStockAvailability(user.companyId, order);
    return order;
};

const validateOutboundLines = async (user, warehouseId, lines) => {
    if (!Array.isArray(lines) || !lines.length) {
        const err = new Error('At least one SKU line is required');
        err.statusCode = 400;
        throw err;
    }

    const { MerchantSku, SkuWarehouseStock } = require('../../models');
    const merchantSkuIds = lines.map((line) => Number(line.merchantSkuId));
    if (new Set(merchantSkuIds).size !== merchantSkuIds.length) {
        const err = new Error('Duplicate merchant SKUs in lines - each SKU may appear only once per outbound');
        err.statusCode = 400;
        throw err;
    }

    const validSkus = await MerchantSku.findAll({
        where: {
            id: { [Op.in]: merchantSkuIds },
            company_id: user.companyId,
            warehouse_id: warehouseId,
            status: 'active',
            deleted_at: null,
        },
        attributes: ['id'],
        raw: true,
    });
    if (validSkus.length !== merchantSkuIds.length) {
        const err = new Error('One or more merchant SKUs are invalid or do not belong to the selected warehouse');
        err.statusCode = 400;
        throw err;
    }

    const stocks = await SkuWarehouseStock.findAll({
        where: {
            company_id: user.companyId,
            warehouse_id: warehouseId,
            merchant_sku_id: { [Op.in]: merchantSkuIds },
        },
        attributes: ['merchant_sku_id', 'qty_on_hand', 'qty_reserved'],
        raw: true,
    });
    const stockMap = new Map(stocks.map((stock) => [Number(stock.merchant_sku_id), stock]));

    for (const line of lines) {
        const merchantSkuId = Number(line.merchantSkuId);
        const requested = Number(line.qtyExpected);
        const stock = stockMap.get(merchantSkuId);
        const available = Math.max(0, Number(stock?.qty_on_hand || 0) - Number(stock?.qty_reserved || 0));
        if (!Number.isInteger(requested) || requested < 1) {
            const err = new Error(`Quantity for merchant SKU ${merchantSkuId} must be at least 1`);
            err.statusCode = 400;
            throw err;
        }
        if (requested > available) {
            const err = new Error(`Insufficient available stock for merchant SKU ${merchantSkuId}: available ${available}, requested ${requested}`);
            err.statusCode = 400;
            throw err;
        }
    }
};

const createOutboundOrder = async (user, data) => {
    const { OutboundOrder, OutboundOrderLine, Warehouse } = require('../../models');
    const { warehouseId, supplierName, supplierReference, receivingWarehouseName, receivingWarehouseAddress, notes, lines } = data;

    const warehouse = await Warehouse.findOne({ where: { id: warehouseId, company_id: user.companyId } });
    if (!warehouse) {
        const err = new Error('Invalid warehouse');
        err.statusCode = 400;
        throw err;
    }
    await validateOutboundLines(user, Number(warehouseId), lines);

    const result = await sequelize.transaction(async (t) => {
        const outboundId = await generateOutboundId(user.companyId, t);
        const order = await OutboundOrder.create({
            company_id: user.companyId,
            warehouse_id: warehouseId,
            outbound_id: outboundId,
            status: 'draft',
            supplier_name: supplierName || null,
            supplier_reference: supplierReference || null,
            receiving_warehouse_name: receivingWarehouseName || warehouse.name || null,
            receiving_warehouse_address: receivingWarehouseAddress || warehouse.location || null,
            notes: notes || null,
            created_by: user.userId,
        }, { transaction: t });

        await OutboundOrderLine.bulkCreate(lines.map((line) => ({
            company_id: user.companyId,
            outbound_order_id: order.id,
            merchant_sku_id: line.merchantSkuId,
            qty_expected: line.qtyExpected,
            qty_received: 0,
            unit_cost: line.unitCost || null,
            currency: line.currency || null,
        })), { transaction: t });

        return order;
    });

    return getOutboundOrderById(user, result.id);
};

const updateDraftOutbound = async (user, outboundOrderId, data) => {
    const { OutboundOrder, OutboundOrderLine } = require('../../models');
    const order = await OutboundOrder.findOne({
        where: { id: outboundOrderId, company_id: user.companyId, deleted_at: null },
    });
    if (!order) {
        const err = new Error('Outbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'draft') {
        const err = new Error(`Cannot edit - outbound is already "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }

    if (data.warehouseId !== undefined && Number(data.warehouseId) !== Number(order.warehouse_id)) {
        const err = new Error('Warehouse cannot be changed for a draft outbound');
        err.statusCode = 400;
        throw err;
    }
    if (data.lines) await validateOutboundLines(user, Number(order.warehouse_id), data.lines);

    await sequelize.transaction(async (t) => {
        const updates = {};
        if (data.supplierName !== undefined) updates.supplier_name = data.supplierName;
        if (data.supplierReference !== undefined) updates.supplier_reference = data.supplierReference;
        if (data.receivingWarehouseName !== undefined) updates.receiving_warehouse_name = data.receivingWarehouseName;
        if (data.receivingWarehouseAddress !== undefined) updates.receiving_warehouse_address = data.receivingWarehouseAddress;
        if (data.notes !== undefined) updates.notes = data.notes;
        if (Object.keys(updates).length) await order.update(updates, { transaction: t });

        if (data.lines && data.lines.length > 0) {
            await OutboundOrderLine.destroy({
                where: { outbound_order_id: outboundOrderId, company_id: user.companyId },
                transaction: t,
            });
            await OutboundOrderLine.bulkCreate(data.lines.map((line) => ({
                company_id: user.companyId,
                outbound_order_id: outboundOrderId,
                merchant_sku_id: line.merchantSkuId,
                qty_expected: line.qtyExpected,
                qty_received: 0,
                unit_cost: line.unitCost || null,
                currency: line.currency || null,
            })), { transaction: t });
        }
    });

    return getOutboundOrderById(user, outboundOrderId);
};

const deleteDraftOutbound = async (user, outboundOrderId) => {
    const { OutboundOrder } = require('../../models');
    const order = await OutboundOrder.findOne({
        where: { id: outboundOrderId, company_id: user.companyId, deleted_at: null },
    });
    if (!order) {
        const err = new Error('Outbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'draft') {
        const err = new Error(`Cannot delete - outbound status is "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }
    await order.destroy();
    return { id: Number(outboundOrderId) };
};

const shipOutboundOrder = async (user, outboundOrderId, data) => {
    const { OutboundOrder, OutboundOrderLine, SkuWarehouseStock, StockLedgerEntry } = require('../../models');
    const order = await OutboundOrder.findOne({
        where: { id: outboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [{ model: OutboundOrderLine, as: 'lines' }],
    });
    if (!order) {
        const err = new Error('Outbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'draft') {
        const err = new Error(`Cannot ship - outbound status is "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }
    if (!order.lines || order.lines.length === 0) {
        const err = new Error('Cannot ship - outbound has no lines');
        err.statusCode = 400;
        throw err;
    }

    const affectedSkuIds = [];
    const platformDeductionItems = [];
    await sequelize.transaction(async (t) => {
        for (const line of order.lines) {
            const stockRecord = await SkuWarehouseStock.findOne({
                where: {
                    company_id: user.companyId,
                    merchant_sku_id: line.merchant_sku_id,
                    warehouse_id: order.warehouse_id,
                },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            const available = Math.max(0, Number(stockRecord?.qty_on_hand || 0) - Number(stockRecord?.qty_reserved || 0));
            if (!stockRecord || Number(line.qty_expected) > available) {
                const err = new Error(`Insufficient available stock for merchant SKU ${line.merchant_sku_id}: available ${available}, requested ${line.qty_expected}`);
                err.statusCode = 400;
                throw err;
            }

            const newQtyOnHand = Number(stockRecord.qty_on_hand || 0) - Number(line.qty_expected);
            await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction: t });
            await StockLedgerEntry.create({
                company_id: user.companyId,
                merchant_sku_id: line.merchant_sku_id,
                warehouse_id: order.warehouse_id,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: 'transfer_out',
                quantity_delta: -Number(line.qty_expected),
                qty_on_hand_after: newQtyOnHand,
                reference_type: 'outbound_order',
                reference_id: String(order.id),
                notes: data.trackingNumber ? `Outbound shipped - tracking: ${data.trackingNumber}` : 'Outbound shipped',
                created_by: user.userId,
            }, { transaction: t });
            affectedSkuIds.push(line.merchant_sku_id);
            platformDeductionItems.push({
                merchantSkuId: line.merchant_sku_id,
                quantity: Number(line.qty_expected),
            });
        }

        await order.update({
            status: 'on_the_way',
            tracking_number: data.trackingNumber,
            purchase_currency: data.purchaseCurrency,
            exchange_rate: data.exchangeRate || null,
            estimated_arrival: data.estimatedArrival,
            shipping_cost: data.shippingCost || null,
            notes: data.notes || order.notes,
            shipped_at: new Date(),
        }, { transaction: t });
    });

    let affectedCombineSkuIds = [];
    if (affectedSkuIds.length > 0) {
        affectedCombineSkuIds = await queueCombineRecompute(user.companyId, affectedSkuIds, order.warehouse_id).catch((err) => {
            console.error('[queueCombineRecompute] Failed to enqueue:', err.message)
            return [];
        });

        await reduceOutboundMappedPlatformStock({
            companyId: user.companyId,
            items: platformDeductionItems,
        }).catch((err) =>
            console.error('[reduceOutboundMappedPlatformStock] Failed to reduce outbound mapped platform stock:', err.message)
        );

        if (affectedCombineSkuIds.length > 0) {
            await syncOutboundMappedPlatformStock({
                companyId: user.companyId,
                merchantSkuIds: [],
                combineSkuIds: affectedCombineSkuIds,
            }).catch((err) =>
                console.error('[syncOutboundMappedPlatformStock] Failed to sync outbound combine mapped platform stock:', err.message)
            );
        }
    }

    return getOutboundOrderById(user, outboundOrderId);
};

const receiveOutboundOrder = async (user, outboundOrderId, data) => {
    const { OutboundOrder, OutboundOrderLine } = require('../../models');
    const order = await OutboundOrder.findOne({
        where: { id: outboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [{ model: OutboundOrderLine, as: 'lines' }],
    });
    if (!order) {
        const err = new Error('Outbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'on_the_way') {
        const err = new Error(`Cannot receive - outbound status is "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }

    const receiveMap = new Map((data.lines || []).map((line) => [Number(line.lineId), line]));
    const orderLineIds = new Set(order.lines.map((line) => Number(line.id)));
    for (const [lineId] of receiveMap) {
        if (!orderLineIds.has(Number(lineId))) {
            const err = new Error(`Line ID ${lineId} does not belong to this outbound order`);
            err.statusCode = 400;
            throw err;
        }
    }

    await sequelize.transaction(async (t) => {
        for (const line of order.lines) {
            const receiveData = receiveMap.get(Number(line.id));
            const qtyReceived = receiveData ? Number(receiveData.qtyReceived) : 0;
            const hasDiscrepancy = qtyReceived !== Number(line.qty_expected);
            await line.update({
                qty_received: qtyReceived,
                has_discrepancy: hasDiscrepancy,
                discrepancy_notes: receiveData?.discrepancyNotes || (hasDiscrepancy ? `Expected ${line.qty_expected}, received ${qtyReceived}` : null),
            }, { transaction: t });
        }

        await order.update({
            status: 'completed',
            arrived_at: new Date(),
            notes: data.notes || order.notes,
        }, { transaction: t });
    });

    return getOutboundOrderById(user, outboundOrderId);
};

const getOutboundDropdowns = async (user) => {
    const { Warehouse } = require('../../models');
    const warehouses = await Warehouse.findAll({
        where: { company_id: user.companyId, status: 'active' },
        attributes: ['id', 'name', 'code', 'location', 'city', 'country', 'is_default'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });
    return { warehouses, currencies: ['USD', 'MYR', 'SGD', 'THB', 'IDR', 'PHP', 'VND', 'CNY'].map((code) => ({ code, name: code })) };
};

const getSkusForOutboundPicker = async (user, { warehouseId, search, page = 1, limit = 20 }) => {
    const { MerchantSku, SkuWarehouseStock } = require('../../models');
    const where = { company_id: user.companyId, status: 'active', deleted_at: null };
    if (warehouseId) where.warehouse_id = warehouseId;
    if (search) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageLimit = parseInt(limit, 10) || 20;
    const offset = (pageNumber - 1) * pageLimit;
    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price', 'warehouse_id'],
        include: [{
            model: SkuWarehouseStock,
            as: 'stock',
            attributes: ['qty_on_hand', 'qty_inbound', 'qty_reserved'],
            required: false,
            where: warehouseId ? { warehouse_id: warehouseId } : undefined,
        }],
        order: [['sku_name', 'ASC']],
        limit: pageLimit,
        offset,
    });

    return {
        data: rows.map((sku) => {
            const stock = Array.isArray(sku.stock) ? sku.stock[0] : sku.stock;
            const qtyOnHand = Number(stock?.qty_on_hand || 0);
            const qtyReserved = Number(stock?.qty_reserved || 0);
            return {
                ...sku.toJSON(),
                qty_on_hand: qtyOnHand,
                total_available: qtyOnHand,
                qty_inbound: Number(stock?.qty_inbound || 0),
                qty_reserved: qtyReserved,
                lock_quantity: qtyReserved,
                qty_available: Math.max(0, qtyOnHand - qtyReserved),
                available_for_platform: Math.max(0, qtyOnHand - qtyReserved),
            };
        }),
        pagination: {
            total: count,
            page: pageNumber,
            limit: pageLimit,
            totalPages: Math.ceil(count / pageLimit),
        },
    };
};

module.exports = {
    getOutboundOrders,
    getOutboundOrderById,
    createOutboundOrder,
    updateDraftOutbound,
    deleteDraftOutbound,
    shipOutboundOrder,
    receiveOutboundOrder,
    getOutboundDropdowns,
    getSkusForOutboundPicker,
};

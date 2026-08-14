'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const { getPermittedStoreIds } = require('../../utils/permissions');

const DEFAULT_DAYS = '0,1,2,3,4,5,6';
const SECONDS_IN_DAY = 24 * 60 * 60;
const MAX_ORDERS_PER_STORE = Math.max(1, Number(process.env.AUTO_ORDER_ACCEPT_MAX_ORDERS_PER_STORE || 25));
const PLATFORM_TIMEOUT_MS = Math.max(5000, Number(process.env.AUTO_ORDER_ACCEPT_PLATFORM_TIMEOUT_MS || 30000));

const normalizeBaseUrl = (value) => String(value || '').replace(/\/+$/, '');
const JAVA_API_BASE_URL = normalizeBaseUrl(
    process.env.JAVA_API_URL ||
    process.env.ORDER_PLATFORM_BASE_URL ||
    process.env.PLATFORM_API_BASE_URL ||
    'https://grozziie.zjweiting.com:3091'
);

const javaApi = axios.create({
    baseURL: JAVA_API_BASE_URL,
    timeout: PLATFORM_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const runningStoreKeys = new Set();

const normalizeString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const normalizePlatform = (value) => {
    const platform = String(value || '').toLowerCase();
    if (platform.includes('shopee')) return 'shopee';
    if (platform.includes('tik')) return 'tiktok';
    return platform;
};

const normalizeDays = (value) => {
    const raw = Array.isArray(value)
        ? value
        : String(value || DEFAULT_DAYS)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    const days = [...new Set(raw.map((item) => Number(item)))]
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((a, b) => a - b);
    return days.length ? days : [0, 1, 2, 3, 4, 5, 6];
};

const isTodayAllowed = (store, now = new Date()) =>
    normalizeDays(store.auto_order_accept_days).includes(now.getDay());

const getUnixDateRange = (days = 7) => {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - days * SECONDS_IN_DAY, end };
};

const chunk = (rows, size) => {
    const batches = [];
    for (let index = 0; index < rows.length; index += size) {
        batches.push(rows.slice(index, index + size));
    }
    return batches;
};

const requestJava = async (path, { method = 'GET', params, data } = {}) => {
    const response = await javaApi.request({ url: path, method, params, data });
    return response.data;
};

const getStoreShopId = (store) =>
    normalizeString(store.store_shop_id) || normalizeString(store.external_store_id);

const getStoreOpenId = (store) =>
    normalizeString(store.store_open_id);

const getStoreCipher = (store) =>
    normalizeString(store.store_cipher);

const getOrderId = (platform, order = {}) =>
    platform === 'shopee'
        ? normalizeString(order.order_sn || order.orderSn || order.id)
        : normalizeString(order.id || order.order_id || order.orderId);

const getShopeeOrderItems = (order = {}) => Array.isArray(order.item_list) ? order.item_list : [];
const getTikTokOrderItems = (order = {}) => Array.isArray(order.lineItems)
    ? order.lineItems
    : Array.isArray(order.line_items)
        ? order.line_items
        : [];

const getOrderItems = (platform, order = {}) =>
    platform === 'shopee' ? getShopeeOrderItems(order) : getTikTokOrderItems(order);

const getItemQuantity = (platform, item = {}) => {
    const value = platform === 'shopee'
        ? item.model_quantity_purchased || item.quantity
        : item.quantity || item.skuQuantity || item.sku_quantity;
    const qty = Number(value || 1);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const getOrderItemId = (platform, item = {}, index = 0) => {
    if (platform === 'shopee') {
        return normalizeString(item.order_item_id || item.orderItemId || item.item_id || item.model_id || index);
    }
    return normalizeString(item.id || item.lineItemId || item.line_item_id || item.skuId || item.sku_id || index);
};

const addMappingFilter = (filters, field, value) => {
    const normalized = normalizeString(value);
    if (normalized) filters.push({ [field]: normalized });
};

const buildMappingFilters = (platform, item = {}) => {
    const filters = [];

    if (platform === 'shopee') {
        const itemId = normalizeString(item.item_id || item.itemId || item.product_id || item.productId);
        const modelId = normalizeString(item.model_id || item.modelId);
        const sellerSku = normalizeString(item.model_sku || item.item_sku || item.sellerSku || item.seller_sku);

        if (itemId) {
            filters.push({
                [Op.or]: [
                    { platform_item_id: itemId },
                    { platform_product_id: itemId },
                    { platform_listing_id: itemId },
                ],
            });
        }
        if (modelId) {
            filters.push({
                [Op.or]: [
                    { platform_model_id: modelId },
                    { platform_sku_id: modelId },
                ],
            });
        } else if (sellerSku) {
            addMappingFilter(filters, 'platform_sku_id', sellerSku);
        }
    } else {
        const productId = normalizeString(item.productId || item.product_id || item.platformItemId);
        const skuId = normalizeString(item.skuId || item.sku_id || item.modelId || item.model_id);
        const sellerSku = normalizeString(item.sellerSku || item.seller_sku);
        const warehouseId = normalizeString(item.warehouseId || item.warehouse_id);

        if (productId) {
            filters.push({
                [Op.or]: [
                    { platform_product_id: productId },
                    { platform_item_id: productId },
                    { platform_listing_id: productId },
                ],
            });
        }
        if (skuId) {
            filters.push({
                [Op.or]: [
                    { platform_model_id: skuId },
                    { platform_sku_id: skuId },
                ],
            });
        } else if (sellerSku) {
            addMappingFilter(filters, 'platform_sku_id', sellerSku);
        }
        addMappingFilter(filters, 'platform_warehouse_id', warehouseId);
    }

    return filters;
};

const findPlatformMapping = async ({ store, platform, item }) => {
    const { PlatformSkuMapping } = require('../../models');
    const filters = buildMappingFilters(platform, item);
    if (!filters.length) return { mapping: null, reason: 'Platform item identifiers are missing' };

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: store.company_id,
            platform_store_id: store.id,
            is_active: true,
            deleted_at: null,
            [Op.and]: filters,
        },
        limit: 2,
    });

    if (!mappings.length) return { mapping: null, reason: 'Platform SKU mapping not found' };
    if (mappings.length > 1) return { mapping: null, reason: 'Multiple platform SKU mappings matched' };
    return { mapping: mappings[0], reason: null };
};

const getMerchantStockTotals = async ({ companyId, merchantSkuId, warehouseId }) => {
    const { SkuWarehouseStock } = require('../../models');
    const where = {
        company_id: companyId,
        merchant_sku_id: merchantSkuId,
    };
    if (warehouseId) where.warehouse_id = warehouseId;

    const rows = await SkuWarehouseStock.findAll({ where, raw: true });
    return rows.reduce((acc, row) => {
        const qtyOnHand = Number(row.qty_on_hand || 0);
        const qtyReserved = Number(row.qty_reserved || 0);
        return {
            qtyOnHand: acc.qtyOnHand + qtyOnHand,
            qtyReserved: acc.qtyReserved + qtyReserved,
            qtyAvailable: acc.qtyAvailable + Math.max(0, qtyOnHand - qtyReserved),
        };
    }, { qtyOnHand: 0, qtyReserved: 0, qtyAvailable: 0 });
};

const hasEnoughMerchantStock = async ({ companyId, merchantSkuId, warehouseId, quantity }) => {
    if (!merchantSkuId || quantity <= 0) return false;
    const totals = await getMerchantStockTotals({ companyId, merchantSkuId, warehouseId });
    return totals.qtyAvailable >= quantity || totals.qtyReserved >= quantity;
};

const hasEnoughCombineStock = async ({ companyId, combineSkuId, warehouseId, quantity }) => {
    const { CombineSku, CombineSkuItem } = require('../../models');
    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: companyId, deleted_at: null, status: 'active' },
        attributes: ['id', 'warehouse_id'],
        raw: true,
    });
    if (!combineSku) return false;

    const items = await CombineSkuItem.findAll({
        where: { company_id: companyId, combine_sku_id: combineSkuId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
    });
    if (!items.length) return false;

    const stockWarehouseId = warehouseId || combineSku.warehouse_id || null;
    for (const item of items) {
        const requiredQty = quantity * Math.max(1, Number(item.quantity || 1));
        const hasStock = await hasEnoughMerchantStock({
            companyId,
            merchantSkuId: item.merchant_sku_id,
            warehouseId: stockWarehouseId,
            quantity: requiredQty,
        });
        if (!hasStock) return false;
    }

    return true;
};

const hasEnoughSkuSelectionStock = async ({ companyId, merchantSkuId, combineSkuId, warehouseId, quantity }) => {
    if (merchantSkuId) {
        return hasEnoughMerchantStock({ companyId, merchantSkuId, warehouseId, quantity });
    }
    if (combineSkuId) {
        return hasEnoughCombineStock({ companyId, combineSkuId, warehouseId, quantity });
    }
    return false;
};

const findActiveAdjustments = async ({ companyId, platform, orderId, orderItemId, mappingId }) => {
    const { PlatformOrderItemSkuOverride } = require('../../models');
    const where = {
        company_id: companyId,
        platform,
        platform_order_id: orderId,
        original_platform_mapping_id: mappingId,
        status: 'active',
        [Op.or]: [
            { adjustment_type: 'add' },
            {
                adjustment_type: 'exchange',
                platform_order_item_id: orderItemId,
            },
        ],
    };

    return PlatformOrderItemSkuOverride.findAll({ where, order: [['id', 'ASC']] });
};

const checkOrderEligibility = async ({ store, platform, order }) => {
    const companyId = Number(store.company_id);
    const orderId = getOrderId(platform, order);
    const items = getOrderItems(platform, order);
    const checkedAddAdjustments = new Set();

    if (!orderId) return { eligible: false, reason: 'Order ID is missing' };
    if (!items.length) return { eligible: false, reason: 'Order items are missing' };

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const itemQty = getItemQuantity(platform, item);
        const orderItemId = getOrderItemId(platform, item, index);
        const { mapping, reason } = await findPlatformMapping({ store, platform, item });
        if (!mapping) return { eligible: false, reason };

        const adjustments = await findActiveAdjustments({
            companyId,
            platform,
            orderId,
            orderItemId,
            mappingId: mapping.id,
        });
        const exchangeAdjustment = adjustments.find((row) =>
            row.adjustment_type === 'exchange' &&
            normalizeString(row.platform_order_item_id) === normalizeString(orderItemId)
        );

        const mainHasStock = await hasEnoughSkuSelectionStock({
            companyId,
            merchantSkuId: exchangeAdjustment?.replacement_merchant_sku_id || mapping.merchant_sku_id,
            combineSkuId: exchangeAdjustment?.replacement_combine_sku_id || mapping.combine_sku_id,
            warehouseId: exchangeAdjustment?.replacement_warehouse_id || mapping.fulfillment_warehouse_id,
            quantity: Number(exchangeAdjustment?.quantity || itemQty),
        });
        if (!mainHasStock) return { eligible: false, reason: 'Mapped SKU does not have enough stock' };

        for (const adjustment of adjustments.filter((row) => row.adjustment_type === 'add')) {
            if (checkedAddAdjustments.has(String(adjustment.id))) continue;
            checkedAddAdjustments.add(String(adjustment.id));
            const addHasStock = await hasEnoughSkuSelectionStock({
                companyId,
                merchantSkuId: adjustment.replacement_merchant_sku_id,
                combineSkuId: adjustment.replacement_combine_sku_id,
                warehouseId: adjustment.replacement_warehouse_id,
                quantity: Number(adjustment.quantity || 1),
            });
            if (!addHasStock) return { eligible: false, reason: 'Added SKU adjustment does not have enough stock' };
        }
    }

    return { eligible: true, reason: null };
};

const getPreferredShopeePickup = (shippingParamData) => {
    const pickupList = shippingParamData?.body?.response?.pickup?.address_list || [];

    for (const address of pickupList) {
        const recommendedSlot = address?.time_slot_list?.find((slot) =>
            Array.isArray(slot?.flags) && slot.flags.includes('recommended')
        );

        if (recommendedSlot) {
            return {
                addressId: address.address_id || null,
                pickupTimeId: recommendedSlot.pickup_time_id || '',
            };
        }
    }

    return {
        addressId: pickupList[0]?.address_id || null,
        pickupTimeId: pickupList[0]?.time_slot_list?.[0]?.pickup_time_id || '',
    };
};

const shipShopeeOrder = async (store, order) => {
    const shopId = getStoreShopId(store);
    const orderSn = getOrderId('shopee', order);
    if (!shopId) throw new Error('Shopee shop ID is missing');
    if (!orderSn) throw new Error('Shopee order ID is missing');

    const shippingParamData = await requestJava('/new-shopee-open-shop/api/dev/logistics/get-shipping-parameter', {
        params: { shopId, orderSn },
    });

    if (shippingParamData?.body?.error) {
        throw new Error(shippingParamData?.body?.message || shippingParamData?.body?.error);
    }

    const deliveryType = String(process.env.AUTO_ORDER_ACCEPT_SHOPEE_DELIVERY_TYPE || 'pickup').toLowerCase();
    let requestBody;

    if (deliveryType === 'dropoff') {
        requestBody = {
            order_sn: orderSn,
            package_number: '',
            dropoff: shippingParamData?.body?.response?.dropoff,
        };
    } else {
        const { addressId, pickupTimeId } = getPreferredShopeePickup(shippingParamData);
        if (!addressId) throw new Error('Missing Shopee pickup address_id');
        requestBody = {
            order_sn: orderSn,
            package_number: '',
            pickup: {
                address_id: addressId,
                pickup_time_id: pickupTimeId || '',
                tracking_number: '',
            },
        };
    }

    const shipData = await requestJava('/new-shopee-open-shop/api/dev/logistics/ship-order', {
        method: 'POST',
        params: { shopId },
        data: requestBody,
    });

    if (shipData?.body?.error) {
        throw new Error(shipData?.body?.message || shipData?.body?.error || 'Shopee ship order failed');
    }

    return shipData;
};

const getTikTokOrderPackageId = (order = {}) =>
    normalizeString(order.lineItems?.[0]?.packageId) ||
    normalizeString(order.line_items?.[0]?.package_id) ||
    normalizeString(order.packageId) ||
    normalizeString(order.package_id);

const getTikTokShippingProviderId = (order = {}) =>
    normalizeString(order.shippingProviderId) ||
    normalizeString(order.shipping_provider_id) ||
    normalizeString(order.shippingProvider?.id) ||
    normalizeString(order.shipping_provider?.id) ||
    '';

const isTikTokShipSuccess = (result) => {
    const code = result?.code ?? result?.data?.code ?? result?.body?.code;
    const error = result?.error ?? result?.data?.error ?? result?.body?.error;
    const message = String(result?.message || result?.data?.message || result?.body?.message || '').toLowerCase();

    if (error) return false;
    if (code !== undefined && ![0, '0', 'success', 'SUCCESS', 'OK'].includes(code)) return false;
    if (message.includes('error') || message.includes('fail')) return false;
    return true;
};

const shipTikTokOrder = async (store, order) => {
    const openId = getStoreOpenId(store);
    const cipher = getStoreCipher(store);
    const packageId = getTikTokOrderPackageId(order);
    if (!openId) throw new Error('TikTok open ID is missing');
    if (!cipher) throw new Error('TikTok cipher is missing');
    if (!packageId) throw new Error('Missing packageId');

    const deliveryType = String(process.env.AUTO_ORDER_ACCEPT_TIKTOK_DELIVERY_TYPE || 'pickup').toLowerCase();
    const result = await requestJava('/tiktokshop-partner-country/api/dev/package/ship-package-new', {
        method: 'POST',
        params: { cipher, openId },
        data: {
            packageId,
            trackingNumber: `AUTO-${Date.now()}`,
            shippingProviderId: getTikTokShippingProviderId(order),
            pickupStartTime: 0,
            pickupEndTime: 0,
            handoverMethod: deliveryType === 'dropoff' ? 'DROP_OFF' : 'PICKUP',
        },
    });

    if (!isTikTokShipSuccess(result)) {
        throw new Error(result?.message || result?.error || result?.body?.message || 'TikTok package API failed');
    }

    return result;
};

const fetchShopeeReadyOrders = async (store) => {
    const shopId = getStoreShopId(store);
    if (!shopId) return [];

    const range = getUnixDateRange(7);
    let cursor = '';
    const list = [];

    do {
        const pageSize = Math.min(50, MAX_ORDERS_PER_STORE - list.length);
        if (pageSize <= 0) break;

        const res = await requestJava('/new-shopee-open-shop/api/dev/order/get-order-list', {
            params: {
                shopId,
                timeFrom: range.start,
                timeTo: range.end,
                pageSize,
                response_optional_fields: 'order_status',
                orderStatus: 'READY_TO_SHIP',
                cursor,
            },
        });

        const pageOrders = res?.response?.order_list || [];
        list.push(...pageOrders);
        cursor = res?.response?.more === true ? (res?.response?.next_cursor || '') : '';
    } while (cursor && list.length < MAX_ORDERS_PER_STORE);

    const orderSnList = list.map((order) => order.order_sn).filter(Boolean);
    const details = [];

    for (const batch of chunk(orderSnList, 30)) {
        const detailRes = await requestJava('/new-shopee-open-shop/api/dev/order/get-order-details', {
            params: {
                shopId,
                orderSnList: batch.join(','),
                request_order_status_pending: true,
                response_optional_fields:
                    'buyer_user_id,buyer_username,currency,total_amount,recipient_address,item_list,payment_method,cod,estimated_shipping_fee,buyer_paid_shipping_fee,shipping_carrier,package_list,message_to_seller,note,pay_time,create_time,update_time,order_status',
            },
        });
        details.push(...(detailRes?.response?.order_list || []));
    }

    if (!details.length) return list;
    const detailMap = new Map(details.map((order) => [order.order_sn, order]));
    return list.map((order) => detailMap.get(order.order_sn) || order);
};

const fetchTikTokReadyOrders = async (store) => {
    const openId = getStoreOpenId(store);
    const cipher = getStoreCipher(store);
    if (!openId || !cipher) return [];

    const range = getUnixDateRange(7);
    let pageToken = '';
    const orders = [];

    do {
        const pageSize = Math.min(50, MAX_ORDERS_PER_STORE - orders.length);
        if (pageSize <= 0) break;

        const res = await requestJava('/tiktokshop-partner-country/api/dev/order/list/filter', {
            method: 'POST',
            params: {
                pageSize,
                cipher,
                openId,
                createTimeGe: range.start,
                createTimeLt: range.end,
                updateTimeGe: range.start,
                updateTimeLt: range.end,
                orderStatus: 'AWAITING_SHIPMENT',
                isBuyerRequestCancel: false,
                shippingType: 'TIKTOK',
                sortField: 'create_time',
                sortOrder: 'DESC',
                pageToken,
            },
        });

        const payload = res?.data || res?.body?.data || res;
        const pageOrders = payload?.orders || [];
        orders.push(...pageOrders);
        pageToken = payload?.nextPageToken || payload?.next_page_token || '';
    } while (pageToken && orders.length < MAX_ORDERS_PER_STORE);

    return orders;
};

const fetchReadyOrders = async (store) =>
    normalizePlatform(store.platform) === 'shopee'
        ? fetchShopeeReadyOrders(store)
        : fetchTikTokReadyOrders(store);

const deleteFailedPackOrders = async ({ companyId, platform, storeId, orderIds }) => {
    if (!orderIds.length) return 0;
    const { PackFailedOrder } = require('../../models');
    return PackFailedOrder.destroy({
        where: {
            company_id: companyId,
            platform,
            store_id: String(storeId),
            order_id: { [Op.in]: orderIds.map(String) },
        },
    });
};

const upsertFailedPackOrders = async ({ companyId, platform, storeId, failedOrders }) => {
    if (!failedOrders.length) return 0;
    const { PackFailedOrder } = require('../../models');
    const now = new Date();
    const rows = failedOrders.map((order) => ({
        company_id: companyId,
        platform,
        store_id: String(storeId),
        order_id: String(order.orderId),
        reason: String(order.reason || 'Auto Order Accept failed').slice(0, 500),
        created_at: now,
        updated_at: now,
    }));

    await PackFailedOrder.bulkCreate(rows, {
        updateOnDuplicate: ['reason', 'created_at', 'updated_at'],
    });
    return rows.length;
};

const getFailedPackOrderIds = async ({ companyId, platform, storeId }) => {
    const { PackFailedOrder } = require('../../models');
    const rows = await PackFailedOrder.findAll({
        where: {
            company_id: companyId,
            platform,
            store_id: String(storeId),
        },
        attributes: ['order_id'],
        raw: true,
    });
    return new Set(rows.map((row) => String(row.order_id)));
};

const shipOrder = async (store, platform, order) =>
    platform === 'shopee' ? shipShopeeOrder(store, order) : shipTikTokOrder(store, order);

const processStore = async (store, { now = new Date() } = {}) => {
    const platform = normalizePlatform(store.platform);
    const storeId = store.id;
    const companyId = Number(store.company_id);
    const result = {
        storeId,
        storeName: store.store_name,
        platform,
        dayAllowed: isTodayAllowed(store, now),
        checked: 0,
        packed: 0,
        failed: 0,
        skipped: 0,
        successfulIds: [],
        failedOrders: [],
        skippedOrders: [],
    };

    if (!result.dayAllowed) {
        result.skipped = 1;
        result.skippedOrders.push({ orderId: null, reason: 'Today is not enabled for Auto Order Accept' });
        return result;
    }

    const runningKey = `${companyId}:${platform}:${storeId}`;
    if (runningStoreKeys.has(runningKey)) {
        result.skipped = 1;
        result.skippedOrders.push({ orderId: null, reason: 'Auto Order Accept is already running for this store' });
        return result;
    }

    runningStoreKeys.add(runningKey);
    try {
        const failedIds = await getFailedPackOrderIds({ companyId, platform, storeId });
        const orders = await fetchReadyOrders(store);

        for (const order of orders) {
            const orderId = getOrderId(platform, order);
            if (!orderId) {
                result.skipped += 1;
                result.skippedOrders.push({ orderId: null, reason: 'Order ID is missing' });
                continue;
            }
            if (failedIds.has(String(orderId))) {
                result.skipped += 1;
                result.skippedOrders.push({ orderId, reason: 'Order is already in Pack Failed' });
                continue;
            }

            result.checked += 1;
            const eligibility = await checkOrderEligibility({ store, platform, order });
            if (!eligibility.eligible) {
                result.skipped += 1;
                result.skippedOrders.push({ orderId, reason: eligibility.reason || 'Order is not eligible' });
                continue;
            }

            try {
                await shipOrder(store, platform, order);
                result.packed += 1;
                result.successfulIds.push(orderId);
            } catch (error) {
                result.failed += 1;
                result.failedOrders.push({ orderId, reason: error?.message || 'Auto Order Accept failed' });
            }
        }

        await Promise.all([
            deleteFailedPackOrders({ companyId, platform, storeId, orderIds: result.successfulIds }),
            upsertFailedPackOrders({ companyId, platform, storeId, failedOrders: result.failedOrders }),
        ]);

        return result;
    } finally {
        runningStoreKeys.delete(runningKey);
    }
};

const buildStoreWhere = async ({ user, filters = {} }) => {
    const platform = normalizePlatform(filters.platform);
    const storeId = normalizeString(filters.storeId);
    const where = {
        auto_order_accept: true,
        is_active: true,
        platform: { [Op.in]: ['shopee', 'tiktok'] },
    };

    if (user?.companyId) where.company_id = user.companyId;
    if (platform && platform !== 'all') where.platform = platform;
    if (storeId && storeId.toLowerCase() !== 'all') where.id = Number(storeId);

    if (user) {
        const permittedStoreIds = await getPermittedStoreIds(user);
        if (Array.isArray(permittedStoreIds)) {
            if (!permittedStoreIds.length) {
                where.id = { [Op.in]: [] };
            } else if (where.id) {
                where.id = permittedStoreIds.includes(Number(where.id)) ? where.id : { [Op.in]: [] };
            } else {
                where.id = { [Op.in]: permittedStoreIds };
            }
        }
    }

    return where;
};

const runAutoOrderAccept = async ({ user = null, source = 'api', filters = {}, now = new Date() } = {}) => {
    const { PlatformStore } = require('../../models');
    const startedAt = new Date();
    const where = await buildStoreWhere({ user, filters });
    const stores = await PlatformStore.findAll({
        where,
        order: [['platform', 'ASC'], ['store_name', 'ASC']],
    });

    const results = [];
    for (const store of stores) {
        try {
            results.push(await processStore(store, { now }));
        } catch (error) {
            results.push({
                storeId: store.id,
                storeName: store.store_name,
                platform: normalizePlatform(store.platform),
                dayAllowed: isTodayAllowed(store, now),
                checked: 0,
                packed: 0,
                failed: 1,
                skipped: 0,
                successfulIds: [],
                failedOrders: [{ orderId: null, reason: error?.message || 'Auto Order Accept failed' }],
                skippedOrders: [],
            });
        }
    }

    const totals = results.reduce((acc, row) => ({
        checked: acc.checked + row.checked,
        packed: acc.packed + row.packed,
        failed: acc.failed + row.failed,
        skipped: acc.skipped + row.skipped,
    }), { checked: 0, packed: 0, failed: 0, skipped: 0 });

    return {
        source,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        storesChecked: results.length,
        totals,
        results,
    };
};

module.exports = {
    runAutoOrderAccept,
    normalizeDays,
};

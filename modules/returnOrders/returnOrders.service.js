'use strict';

const axios = require('axios');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');
const {
    applyWarehouseScope,
    assertWarehousePermission,
    getPermittedStoreIds,
} = require('../../utils/permissions');
const platformOrderDeductionsService = require('../platformOrderDeductions/platformOrderDeductions.service');

const JAVA_API_BASE_URL = process.env.JAVA_API_URL 
    .replace(/\/+$/, '');
const SHOPEE_RETURN_LIST_PATH = process.env.SHOPEE_RETURN_LIST_PATH || '/new-shopee-open-shop/api/dev/return/get-return-list';
const TIKTOK_RETURN_SEARCH_PATH = process.env.TIKTOK_RETURN_SEARCH_PATH || '/tiktokshop-partner-country/api/dev/returns/search';
const SHOPEE_ORDER_DETAIL_PATH = process.env.SHOPEE_ORDER_DETAIL_PATH || '/new-shopee-open-shop/api/dev/order/get-order-details';
const TIKTOK_ORDER_DETAIL_PATH = process.env.TIKTOK_ORDER_DETAIL_PATH || '/tiktokshop-partner-country/api/dev/order/details';
const SECONDS_IN_DAY = 24 * 60 * 60;
const SHOPEE_RETURN_SYNC_MAX_PAGES = Math.max(
    1,
    Number.parseInt(process.env.SHOPEE_RETURN_SYNC_MAX_PAGES || '500', 10) || 500
);
const SHOPEE_RETURN_SYNC_OVERLAP_PAGES = Math.max(
    0,
    Number.parseInt(process.env.SHOPEE_RETURN_SYNC_OVERLAP_PAGES || '3', 10) || 3
);
const RETURN_ORDER_ACTIVE_SYNC_DAYS = Math.max(
    1,
    Number.parseInt(process.env.RETURN_ORDER_ACTIVE_SYNC_DAYS || '20', 10) || 20
);
const SHOPEE_RETURN_FIRST_SYNC_DAYS = Math.max(
    1,
    Number.parseInt(process.env.SHOPEE_RETURN_FIRST_SYNC_DAYS || String(RETURN_ORDER_ACTIVE_SYNC_DAYS), 10) || RETURN_ORDER_ACTIVE_SYNC_DAYS
);
const TIKTOK_RETURN_SYNC_MAX_PAGES = Math.max(
    1,
    Number.parseInt(process.env.TIKTOK_RETURN_SYNC_MAX_PAGES || '500', 10) || 500
);
const TIKTOK_RETURN_FIRST_SYNC_DAYS = Math.max(
    1,
    Number.parseInt(process.env.TIKTOK_RETURN_FIRST_SYNC_DAYS || String(RETURN_ORDER_ACTIVE_SYNC_DAYS), 10) || RETURN_ORDER_ACTIVE_SYNC_DAYS
);
const TIKTOK_RETURN_RECENT_SYNC_DAYS = Math.max(
    1,
    Number.parseInt(process.env.TIKTOK_RETURN_RECENT_SYNC_DAYS || String(RETURN_ORDER_ACTIVE_SYNC_DAYS), 10) || RETURN_ORDER_ACTIVE_SYNC_DAYS
);
const RETURN_ORDER_RETENTION_DAYS = Math.max(
    1,
    Number.parseInt(process.env.RETURN_ORDER_RETENTION_DAYS || '183', 10) || 183
);
const SHOPEE_RETURN_BACKGROUND_INTERVAL_MS = Math.max(
    5 * 60 * 1000,
    Number.parseInt(process.env.SHOPEE_RETURN_BACKGROUND_INTERVAL_MS || String(2 * 60 * 60 * 1000), 10) || 2 * 60 * 60 * 1000
);

const shopeeReturnSyncJobs = new Map();
const tiktokReturnSyncJobs = new Map();

const TIKTOK_RETURN_STATUSES = [
    'RETURN_OR_REFUND_REQUEST_PENDING',
    'REFUND_OR_RETURN_REQUEST_REJECT',
    'AWAITING_BUYER_SHIP',
    'BUYER_SHIPPED_ITEM',
    'REJECT_RECEIVE_PACKAGE',
    'RETURN_OR_REFUND_REQUEST_SUCCESS',
    'RETURN_OR_REFUND_REQUEST_CANCEL',
    'RETURN_OR_REFUND_REQUEST_COMPLETE',
    'AWAITING_BUYER_RESPONSE',
];

const ERP_RETURN_STATUSES = new Set(['need_to_check', 'defect_found', 'pending_inspection', 'resalable_item']);
const RETURN_TYPES = new Set(['by_logistic', 'by_buyer_use_logistic', 'by_buyer_direct_give', 'without_logistic']);
const TRACKING_REQUIRED_TYPES = new Set(['by_logistic', 'by_buyer_use_logistic']);

const STATUS_LABELS = {
    RETURN_OR_REFUND_REQUEST_PENDING: 'Need To Check',
    REFUND_OR_RETURN_REQUEST_REJECT: 'Seller Rejected',
    AWAITING_BUYER_SHIP: 'Awaiting Buyer Ship',
    BUYER_SHIPPED_ITEM: 'On The Way',
    REJECT_RECEIVE_PACKAGE: 'Package Rejected',
    RETURN_OR_REFUND_REQUEST_SUCCESS: 'Refund Processing',
    RETURN_OR_REFUND_REQUEST_CANCEL: 'Cancelled',
    RETURN_OR_REFUND_REQUEST_COMPLETE: 'Refund Done',
    AWAITING_BUYER_RESPONSE: 'Awaiting Buyer Response',
    REQUESTED: 'Need To Check',
    ACCEPTED: 'Seller Accepted',
    SELLER_DISPUTE: 'Seller Dispute',
    PROCESSING: 'Refund Processing',
    REFUND_PAID: 'Refund Done',
    CANCELLED: 'Cancelled',
    CLOSED: 'Closed',
};

const clean = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const getErrorMessage = (err) => {
    if (err?.response?.data?.message) return clean(err.response.data.message);
    if (err?.response?.data?.error) return clean(err.response.data.error);
    if (err?.response?.status) return `HTTP ${err.response.status}${err.response.statusText ? ` ${err.response.statusText}` : ''}`;
    if (err?.code) return clean(`${err.code}${err.message ? `: ${err.message}` : ''}`);
    return clean(err?.message) || 'Unknown error';
};

const getResponsePreview = (data) => {
    try {
        return JSON.stringify(data).slice(0, 2000);
    } catch (err) {
        return `[unserializable response: ${err.message}]`;
    }
};

const getTopLevelKeys = (value) => {
    if (!value || typeof value !== 'object') return [];
    return Object.keys(value).slice(0, 30);
};

const getSearchTerms = (search, searchType) => {
    const query = clean(search);
    if (!query) return [];
    if (clean(searchType).toLowerCase() !== 'batch search') return [query];
    return query
        .split(/[\s,]+/)
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 100);
};

const normalizeSearchField = (value) => {
    const key = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (['sku', 'sku_name', 'merchant_sku'].includes(key)) return 'sku';
    if (['order_number', 'order_no', 'order'].includes(key)) return 'order_number';
    if (['tracking_number', 'tracking_no', 'return_tracking_number'].includes(key)) return 'tracking_number';
    if (['return_id', 'return_number', 'platform_return_id'].includes(key)) return 'return_id';
    if (['return_status', 'erp_return_status'].includes(key)) return 'return_status';
    if (['platform_status', 'platform_return_status'].includes(key)) return 'platform_status';
    return 'sku';
};

const likeConditions = (fields, terms) =>
    terms.flatMap((term) => fields.map((field) => ({ [field]: { [Op.like]: `%${term}%` } })));

const getStatusSearchTerms = (terms) => [...new Set(
    terms.flatMap((term) => {
        const normalized = clean(term).toLowerCase().replace(/[\s-]+/g, '_');
        return [term, normalized].filter(Boolean);
    })
)];

const findReturnOrderIdsByLineSearch = async (companyId, terms) => {
    if (!terms.length) return [];
    const { ReturnOrderLine, MerchantSku } = require('../../models');
    const rows = await ReturnOrderLine.findAll({
        attributes: ['return_order_id'],
        where: {
            company_id: companyId,
            [Op.or]: [
                ...likeConditions(['seller_sku', 'sku_name', 'platform_sku_id', 'product_name'], terms),
                ...terms.map((term) => ({ '$merchantSku.sku_name$': { [Op.like]: `%${term}%` } })),
                ...terms.map((term) => ({ '$merchantSku.sku_title$': { [Op.like]: `%${term}%` } })),
            ],
        },
        include: [{
            model: MerchantSku,
            as: 'merchantSku',
            attributes: [],
            required: false,
        }],
        group: ['return_order_id'],
        raw: true,
    });
    return rows.map((row) => Number(row.return_order_id)).filter(Boolean);
};

const buildSearchCondition = async (companyId, filters = {}) => {
    const terms = getSearchTerms(filters.search, filters.searchType);
    if (!terms.length) return null;

    const field = normalizeSearchField(filters.skuType);
    if (field === 'sku') {
        const matchingOrderIds = await findReturnOrderIdsByLineSearch(companyId, terms);
        return { id: { [Op.in]: matchingOrderIds.length ? matchingOrderIds : [-1] } };
    }

    if (field === 'order_number') {
        return {
            [Op.or]: likeConditions(['order_number', 'platform_order_id', 'warehouse_package_no'], terms),
        };
    }

    if (field === 'tracking_number') {
        return {
            [Op.or]: likeConditions(['return_tracking_number', 'local_return_tracking_number'], terms),
        };
    }

    if (field === 'return_status') {
        const statusTerms = getStatusSearchTerms(terms);
        return {
            [Op.or]: likeConditions(['erp_return_status'], statusTerms),
        };
    }

    if (field === 'platform_status') {
        const statusTerms = getStatusSearchTerms(terms);
        return {
            [Op.or]: likeConditions(['platform_return_status', 'platform_status_label'], statusTerms),
        };
    }

    return {
        [Op.or]: likeConditions(['platform_return_id'], terms),
    };
};

const toPositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        const err = new Error(`${fieldName} must be a positive integer`);
        err.statusCode = 400;
        throw err;
    }
    return parsed;
};

const getUserCompanyId = (user) => {
    const companyId = Number(user?.companyId || user?.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('companyId is required');
        err.statusCode = 400;
        throw err;
    }
    return companyId;
};

const normalizeStatus = (value) => {
    const key = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
        need_to_check: 'need_to_check',
        needtocheck: 'need_to_check',
        defect_found: 'defect_found',
        defectfound: 'defect_found',
        pending_inspection: 'pending_inspection',
        pendinginspection: 'pending_inspection',
        resalable_item: 'resalable_item',
        resaleable_item: 'resalable_item',
        resalable: 'resalable_item',
        resaleable: 'resalable_item',
    };
    const normalized = aliases[key] || key;
    if (!ERP_RETURN_STATUSES.has(normalized)) {
        const err = new Error('Invalid return status');
        err.statusCode = 400;
        throw err;
    }
    return normalized;
};

const normalizeNullableStatus = (value) => {
    if (!value || value === 'all') return null;
    return normalizeStatus(value);
};

const normalizeReturnType = (value) => {
    const key = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
        by_logistic: 'by_logistic',
        by_buyer_use_logistic: 'by_buyer_use_logistic',
        by_buyer: 'by_buyer_use_logistic',
        by_buyer_direct_give: 'by_buyer_direct_give',
        buyer_direct: 'by_buyer_direct_give',
        without_logistic: 'without_logistic',
        no_logistic: 'without_logistic',
    };
    const normalized = aliases[key] || key;
    if (!RETURN_TYPES.has(normalized)) {
        const err = new Error('Invalid return type');
        err.statusCode = 400;
        throw err;
    }
    return normalized;
};

const getNested = (source, paths = []) => {
    for (const path of paths) {
        const parts = path.split('.');
        let cursor = source;
        for (const part of parts) {
            if (cursor === undefined || cursor === null) break;
            cursor = cursor[part];
        }
        if (cursor !== undefined && cursor !== null && cursor !== '') return cursor;
    }
    return null;
};

const toArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const epochSeconds = (date) => Math.floor(date.getTime() / 1000);

const getUnixDateRange = (days = 7) => {
    const safeDays = Math.max(1, Number(days) || 7);
    const end = Math.floor(Date.now() / 1000);
    return { start: end - safeDays * SECONDS_IN_DAY, end };
};

const toUnixSecond = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toDateFromPlatformTime = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        return new Date((numeric > 9999999999 ? numeric : numeric * 1000));
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
};

const normalizeImageList = (value) => {
    const source = Array.isArray(value) ? value : toArray(value);
    return source
        .map((item) => {
            if (typeof item === 'string') return clean(item);
            return clean(getNested(item, ['url', 'imageUrl', 'image_url', 'src']));
        })
        .filter(Boolean);
};

const getOptionDateRange = (options = {}, fallbackDays = 7) => {
    const start = toUnixSecond(options.startDate ?? options.dateStart ?? options.start);
    const end = toUnixSecond(options.endDate ?? options.dateEnd ?? options.end);
    if (start && end && start <= end) return { start, end };
    if (start && !end) return { start, end: Math.floor(Date.now() / 1000) };
    if (!start && end) return { start: end - Math.max(1, Number(options.days) || fallbackDays) * SECONDS_IN_DAY, end };
    return getUnixDateRange(options.days || fallbackDays);
};

const getListDateCondition = (filters = {}) => {
    const start = toUnixSecond(filters.startDate ?? filters.dateStart ?? filters.start);
    const end = toUnixSecond(filters.endDate ?? filters.dateEnd ?? filters.end);
    if (!start && !end) return null;
    if (start && end) return { [Op.between]: [new Date(start * 1000), new Date(end * 1000)] };
    if (start) return { [Op.gte]: new Date(start * 1000) };
    return { [Op.lte]: new Date(end * 1000) };
};

const formatCurrencyAmount = (value) => {
    if (!value) return { currency: null, amount: null };
    if (typeof value === 'number' || typeof value === 'string') {
        const numeric = Number(value);
        return { currency: null, amount: Number.isFinite(numeric) ? numeric : null };
    }
    const amount = getNested(value, ['amount', 'value', 'centAmount', 'totalAmount', 'refundTotal', 'refund_total']);
    const currency = getNested(value, ['currency', 'currencyCode', 'currency_code']);
    const numeric = Number(amount);
    return {
        currency: currency ? clean(currency) : null,
        amount: Number.isFinite(numeric) ? numeric : null,
    };
};

const parseJsonValue = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const queueCombineRecompute = async (companyId, merchantSkuIds, warehouseId) => {
    const skuIds = [...new Set((merchantSkuIds || []).map(Number).filter(Boolean))];
    if (!skuIds.length || !warehouseId) return [];
    const { CombineSku, CombineSkuItem } = require('../../models');
    const stockService = require('../stock/stock.service');

    const rows = await CombineSkuItem.findAll({
        where: { company_id: companyId, merchant_sku_id: { [Op.in]: skuIds } },
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

    const combineSkuIds = [...new Set(rows.map((row) => Number(row.combine_sku_id)).filter(Boolean))];
    if (!combineSkuIds.length) return [];

    await Promise.all(combineSkuIds.map((id) => stockService.recomputeCombineSku(companyId, id).catch(() => null)));

    if (redis?.client) {
        const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
        combineSkuIds.forEach((combineSkuId) => {
            const payload = JSON.stringify({ companyId, combineSkuId });
            if (pipeline.rPush) pipeline.rPush('queue:combine_sku_recompute', payload);
            else pipeline.rpush('queue:combine_sku_recompute', payload);
        });
        await pipeline.exec().catch(() => null);
    }

    return combineSkuIds;
};

const pruneOldReturnOrdersForStore = async ({ companyId, platform, storeId }) => {
    if (!companyId || !platform || !storeId) return 0;
    const { ReturnOrder } = require('../../models');
    const cutoff = new Date(Date.now() - RETURN_ORDER_RETENTION_DAYS * SECONDS_IN_DAY * 1000);
    const deleted = await ReturnOrder.destroy({
        where: {
            company_id: companyId,
            platform,
            platform_store_id: storeId,
            deleted_at: null,
            [Op.or]: [
                { platform_created_at: { [Op.lt]: cutoff } },
                { platform_created_at: null, created_at: { [Op.lt]: cutoff } },
            ],
        },
    });
    return deleted;
};

const generateInboundId = async (companyId, transaction) => {
    const { InboundOrder } = require('../../models');
    const year = new Date().getFullYear();
    const prefix = `IB-${year}-`;
    const last = await InboundOrder.findOne({
        where: {
            company_id: companyId,
            inbound_id: { [Op.like]: `${prefix}%` },
        },
        order: [['id', 'DESC']],
        lock: transaction.LOCK.UPDATE,
        transaction,
    });
    const next = last ? Number.parseInt(String(last.inbound_id).replace(prefix, ''), 10) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(6, '0')}`;
};

const statusLabel = (status) => STATUS_LABELS[clean(status)] || clean(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const getStoreDisplayName = (store) => clean(store?.store_name || store?.storeName || store?.external_store_id || store?.store_shop_id);

const assertReturnOrderAccess = async (user, order, options = {}) => {
    if (!order) {
        const err = new Error('Return order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.platform_store_id) {
        const permittedStoreIds = await getPermittedStoreIds(user, { canEdit: Boolean(options.canEdit) });
        if (Array.isArray(permittedStoreIds) && !permittedStoreIds.includes(Number(order.platform_store_id))) {
            const err = new Error('You do not have access to this return order store');
            err.statusCode = 403;
            throw err;
        }
    }
    if (order.warehouse_id) {
        await assertWarehousePermission(user, order.warehouse_id, { canEdit: Boolean(options.canEdit) });
    }
};

const getRefundSummary = (raw = {}) => {
    const candidates = [
        raw.refundAmount,
        raw.refund_amount,
        raw.refundTotal,
        raw.refund_total,
        raw.returnRefundAmount,
        raw.return_refund_amount,
        raw.totalRefundAmount,
        raw.total_refund_amount,
        getNested(raw, ['refund.refundAmount', 'refund.refund_amount', 'refund.totalAmount']),
    ];
    for (const candidate of candidates) {
        const summary = formatCurrencyAmount(candidate);
        if (summary.amount !== null || summary.currency) return summary;
    }
    return { currency: null, amount: null };
};

const normalizeTikTokLine = async ({ companyId, platformStoreId, line, transaction }) => {
    const { MerchantSku, PlatformSkuMapping } = require('../../models');
    const platformSkuId = clean(getNested(line, [
        'skuId',
        'sku_id',
        'sku.id',
        'productSkuId',
        'product_sku_id',
        'orderLineItem.skuId',
        'order_line_item.sku_id',
    ]));
    const sellerSku = clean(getNested(line, [
        'sellerSku',
        'seller_sku',
        'skuName',
        'sku_name',
        'sellerSKU',
        'product.sellerSku',
        'product.seller_sku',
    ]));
    const quantity = Number.parseInt(getNested(line, ['quantity', 'returnQuantity', 'return_quantity', 'skuQuantity', 'sku_quantity']) || 1, 10);
    const productName = clean(getNested(line, [
        'productName',
        'product_name',
        'name',
        'skuName',
        'sku_name',
        'product.name',
    ]));
    const productImageUrl = clean(getNested(line, [
        'productImageUrl',
        'product_image_url',
        'image',
        'imageUrl',
        'image_url',
        'product.image',
        'product.imageUrl',
        'productImage.url',
        'product_image.url',
    ]));
    const refund = getRefundSummary(line);

    let merchantSkuId = null;
    if (platformSkuId) {
        const mappingWhere = {
            company_id: companyId,
            platform_store_id: platformStoreId,
            is_active: true,
        };
        const skuConditions = [];
        if (platformSkuId) {
            skuConditions.push(
                { platform_sku_id: platformSkuId },
                { platform_model_id: platformSkuId }
            );
        }
        if (skuConditions.length) mappingWhere[Op.or] = skuConditions;

        const mapping = await PlatformSkuMapping.findOne({
            where: mappingWhere,
            order: [['id', 'DESC']],
            transaction,
        });
        merchantSkuId = mapping?.merchant_sku_id ? Number(mapping.merchant_sku_id) : null;
    }

    if (!merchantSkuId && sellerSku) {
        const sku = await MerchantSku.findOne({
            where: { company_id: companyId, sku_name: sellerSku, deleted_at: null },
            attributes: ['id'],
            transaction,
        });
        merchantSkuId = sku?.id ? Number(sku.id) : null;
    }

    return {
        merchant_sku_id: merchantSkuId,
        order_line_item_id: clean(getNested(line, ['orderLineItemId', 'order_line_item_id', 'lineItemId', 'line_item_id'])) || null,
        return_line_item_id: clean(getNested(line, ['returnLineItemId', 'return_line_item_id', 'id', 'lineId', 'line_id'])) || `${platformSkuId || sellerSku || 'line'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        platform_sku_id: platformSkuId || null,
        seller_sku: sellerSku || null,
        sku_name: sellerSku || platformSkuId || null,
        product_name: productName || sellerSku || platformSkuId || 'Return product',
        product_image_url: productImageUrl || null,
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
        refund_currency: refund.currency,
        refund_total: refund.amount,
        raw_json: line,
    };
};

const normalizeTikTokReturnOrder = async ({ companyId, store, raw, transaction }) => {
    const data = raw || {};
    const platformReturnId = clean(getNested(data, [
        'returnId',
        'return_id',
        'returnOrderId',
        'return_order_id',
        'id',
    ]));
    const platformOrderId = clean(getNested(data, [
        'orderId',
        'order_id',
        'mainOrderId',
        'main_order_id',
    ]));
    const orderNumber = clean(getNested(data, [
        'orderSn',
        'order_sn',
        'orderNumber',
        'order_number',
        'orderId',
        'order_id',
    ]));
    const trackingNo = clean(getNested(data, [
        'returnTrackingNumber',
        'return_tracking_number',
        'trackingNumber',
        'tracking_number',
        'logisticsTrackingNumber',
        'logistics_tracking_number',
        'shipment.trackingNumber',
    ]));
    const providerName = clean(getNested(data, [
        'returnProviderName',
        'return_provider_name',
        'logisticsProviderName',
        'logistics_provider_name',
        'shipment.providerName',
    ]));
    const platformStatus = clean(getNested(data, ['returnStatus', 'return_status', 'status']));
    const refund = getRefundSummary(data);
    const platformCreatedAt = toDateFromPlatformTime(getNested(data, ['createTime', 'create_time', 'createdTime', 'created_time']));
    const platformUpdatedAt = toDateFromPlatformTime(getNested(data, ['updateTime', 'update_time', 'updatedTime', 'updated_time']));
    const buyer = getNested(data, ['user', 'buyer', 'customer']) || {};
    const directReturnImages = normalizeImageList(getNested(data, [
        'images',
        'image',
        'returnImages',
        'return_images',
    ]));
    const returnWarehouseAddress = getNested(data, ['returnWarehouseAddress.fullAddress', 'return_warehouse_address.full_address'])
        || getNested(data, ['returnWarehouseAddress', 'return_warehouse_address', 'warehouseAddress.fullAddress', 'warehouse_address.full_address', 'warehouseAddress', 'warehouse_address']);
    const lineSources = [
        data.returnLineItems,
        data.return_line_items,
        data.items,
        data.lineItems,
        data.orderLineItems,
        data.order_line_items,
        data.skus,
    ];
    const rawLines = lineSources.find((value) => Array.isArray(value)) || [];
    const lineReturnImages = rawLines.flatMap((line) => normalizeImageList(getNested(line, [
        'productImage',
        'product_image',
        'images',
        'image',
    ])));
    const returnImages = [...new Set([...directReturnImages, ...lineReturnImages])];
    const lines = [];
    for (const line of rawLines) {
        lines.push(await normalizeTikTokLine({
            companyId,
            platformStoreId: store.id,
            line,
            transaction,
        }));
    }

    if (!lines.length) {
        lines.push(await normalizeTikTokLine({
            companyId,
            platformStoreId: store.id,
            line: data,
            transaction,
        }));
    }

    return {
        order: {
            company_id: companyId,
            platform: 'tiktok',
            platform_store_id: store.id,
            store_name: getStoreDisplayName(store),
            platform_return_id: platformReturnId || `${platformOrderId || orderNumber}-${Date.now()}`,
            platform_order_id: platformOrderId || null,
            order_number: orderNumber || platformOrderId || platformReturnId || null,
            platform_created_at: platformCreatedAt,
            platform_updated_at: platformUpdatedAt,
            buyer_username: clean(getNested(buyer, ['username', 'name', 'buyerName', 'buyer_name'])) || clean(getNested(data, ['buyerUsername', 'buyer_username', 'userName', 'user_name'])) || null,
            buyer_email: clean(getNested(buyer, ['email'])) || clean(getNested(data, ['buyerEmail', 'buyer_email', 'email'])) || null,
            buyer_portrait_url: clean(getNested(buyer, ['portrait', 'avatar', 'avatarUrl', 'avatar_url'])) || clean(getNested(data, ['buyerPortraitUrl', 'buyer_portrait_url'])) || null,
            return_images_json: returnImages.length ? returnImages : null,
            warehouse_package_no: clean(getNested(data, ['warehousePackageNo', 'warehouse_package_no', 'packageId', 'package_id'])) || null,
            platform_return_status: platformStatus || null,
            platform_status_label: statusLabel(platformStatus),
            return_reason: clean(getNested(data, ['returnReason', 'return_reason', 'reason'])) || null,
            return_reason_text: clean(getNested(data, ['returnReasonText', 'return_reason_text', 'reasonText', 'reason_text', 'buyerRemark', 'buyer_remark'])) || null,
            return_type: clean(getNested(data, ['returnType', 'return_type'])) || null,
            return_method: clean(getNested(data, ['returnMethod', 'return_method'])) || null,
            shipment_type: clean(getNested(data, ['shipmentType', 'shipment_type'])) || null,
            handover_method: clean(getNested(data, ['handoverMethod', 'handover_method'])) || null,
            return_tracking_number: trackingNo || null,
            return_provider_id: clean(getNested(data, ['returnProviderId', 'return_provider_id', 'logisticsProviderId', 'logistics_provider_id'])) || null,
            return_provider_name: providerName || null,
            logistic_name: providerName || null,
            return_warehouse_address: typeof returnWarehouseAddress === 'object' ? JSON.stringify(returnWarehouseAddress) : clean(returnWarehouseAddress) || null,
            refund_currency: refund.currency,
            refund_total: refund.amount,
            seller_next_action_json: getNested(data, ['sellerNextAction', 'seller_next_action', 'sellerNextActionResponse', 'seller_next_action_response']) || null,
            discount_amount_json: getNested(data, ['discountAmount', 'discount_amount']) || null,
            shipping_fee_amount_json: getNested(data, ['shippingFeeAmount', 'shipping_fee_amount']) || null,
            raw_json: data,
            is_manual: false,
        },
        lines,
    };
};

const upsertTikTokReturnOrder = async ({ companyId, store, raw, transaction }) => {
    const { ReturnOrder, ReturnOrderLine } = require('../../models');
    const data = raw || {};
    const rawPlatformReturnId = clean(getNested(data, [
        'returnId',
        'return_id',
        'returnOrderId',
        'return_order_id',
        'id',
    ]));
    const rawPlatformUpdatedAt = toDateFromPlatformTime(getNested(data, ['updateTime', 'update_time', 'updatedTime', 'updated_time']));
    if (rawPlatformReturnId && rawPlatformUpdatedAt) {
        const unchanged = await ReturnOrder.findOne({
            where: {
                company_id: companyId,
                platform: 'tiktok',
                platform_return_id: rawPlatformReturnId,
                deleted_at: null,
            },
            attributes: ['id', 'platform_updated_at'],
            paranoid: false,
            transaction,
        });
        const existingPlatformUpdatedAt = unchanged?.platform_updated_at ? new Date(unchanged.platform_updated_at).getTime() : null;
        const nextPlatformUpdatedAt = new Date(rawPlatformUpdatedAt).getTime();
        if (existingPlatformUpdatedAt && nextPlatformUpdatedAt && existingPlatformUpdatedAt === nextPlatformUpdatedAt) {
            return { order: unchanged, created: false, skipped: true };
        }
    }

    const normalized = await normalizeTikTokReturnOrder({ companyId, store, raw, transaction });
    const existing = await ReturnOrder.findOne({
        where: {
            company_id: companyId,
            platform: 'tiktok',
            platform_return_id: normalized.order.platform_return_id,
        },
        paranoid: false,
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    let order;
    if (existing) {
        const updateData = { ...normalized.order, deleted_at: null };
        order = existing;
        await order.update(updateData, { transaction });
    } else {
        order = await ReturnOrder.create({
            ...normalized.order,
            erp_return_status: 'need_to_check',
        }, { transaction });
    }

    for (const line of normalized.lines) {
        const found = await ReturnOrderLine.findOne({
            where: {
                return_order_id: order.id,
                return_line_item_id: line.return_line_item_id,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (found) {
            await found.update({
                ...line,
                company_id: companyId,
                return_order_id: order.id,
            }, { transaction });
        } else {
            await ReturnOrderLine.create({
                ...line,
                company_id: companyId,
                return_order_id: order.id,
            }, { transaction });
        }
    }

    return { order, created: !existing };
};

const firstArrayValue = (value) => {
    if (Array.isArray(value)) return value.find((item) => clean(item)) || null;
    return value || null;
};

const normalizeShopeeLine = async ({ companyId, platformStoreId, line, parentReturnId, index = 0, transaction }) => {
    const { MerchantSku, PlatformSkuMapping } = require('../../models');
    const itemId = clean(getNested(line, ['item_id', 'itemId', 'item.id']));
    const modelId = clean(getNested(line, ['model_id', 'modelId', 'model.id']));
    const sellerSku = clean(getNested(line, [
        'variation_sku',
        'variationSku',
        'model_sku',
        'modelSku',
        'seller_sku',
        'sellerSku',
        'item_sku',
        'itemSku',
    ]));
    const quantity = Number.parseInt(getNested(line, ['amount', 'quantity', 'returnQuantity', 'return_quantity']) || 1, 10);
    const productName = clean(getNested(line, ['name', 'item_name', 'itemName', 'productName', 'product_name']));
    const productImageUrl = clean(firstArrayValue(getNested(line, ['images', 'image'])) || getNested(line, ['image_url', 'imageUrl']));
    const refund = getRefundSummary(line);

    let merchantSkuId = null;
    const andConditions = [];
    if (itemId) {
        andConditions.push({
            [Op.or]: [
                { platform_item_id: itemId },
                { platform_listing_id: itemId },
                { platform_product_id: itemId },
            ],
        });
    }
    if (modelId) {
        andConditions.push({
            [Op.or]: [
                { platform_model_id: modelId },
                { platform_sku_id: modelId },
            ],
        });
    }

    if (andConditions.length) {
        const mapping = await PlatformSkuMapping.findOne({
            where: {
                company_id: companyId,
                platform_store_id: platformStoreId,
                is_active: true,
                [Op.and]: andConditions,
            },
            order: [['id', 'DESC']],
            transaction,
        });
        merchantSkuId = mapping?.merchant_sku_id ? Number(mapping.merchant_sku_id) : null;
    }

    if (!merchantSkuId && modelId) {
        const mapping = await PlatformSkuMapping.findOne({
            where: {
                company_id: companyId,
                platform_store_id: platformStoreId,
                is_active: true,
                [Op.or]: [
                    { platform_model_id: modelId },
                    { platform_sku_id: modelId },
                ],
            },
            order: [['id', 'DESC']],
            transaction,
        });
        merchantSkuId = mapping?.merchant_sku_id ? Number(mapping.merchant_sku_id) : null;
    }

    if (!merchantSkuId && sellerSku) {
        const sku = await MerchantSku.findOne({
            where: { company_id: companyId, sku_name: sellerSku, deleted_at: null },
            attributes: ['id'],
            transaction,
        });
        merchantSkuId = sku?.id ? Number(sku.id) : null;
    }

    const returnLineItemId = clean(getNested(line, ['return_line_item_id', 'returnLineItemId', 'id', 'line_id', 'lineId']))
        || [parentReturnId, itemId, modelId, index + 1].filter(Boolean).join('-');

    return {
        merchant_sku_id: merchantSkuId,
        order_line_item_id: [itemId, modelId].filter(Boolean).join('-') || null,
        return_line_item_id: returnLineItemId || `shopee-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        platform_sku_id: modelId || itemId || null,
        seller_sku: sellerSku || null,
        sku_name: sellerSku || modelId || itemId || null,
        product_name: productName || sellerSku || modelId || itemId || 'Shopee return product',
        product_image_url: productImageUrl || null,
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
        refund_currency: refund.currency,
        refund_total: refund.amount,
        raw_json: line,
    };
};

const normalizeShopeeReturnOrder = async ({ companyId, store, raw, transaction }) => {
    const data = raw || {};
    const platformReturnId = clean(getNested(data, ['return_sn', 'returnSn', 'return_id', 'returnId', 'id']));
    const platformOrderId = clean(getNested(data, ['order_sn', 'orderSn', 'order_id', 'orderId']));
    const trackingNo = clean(getNested(data, ['tracking_number', 'trackingNumber', 'return_tracking_number', 'returnTrackingNumber']));
    const platformStatus = clean(getNested(data, ['status', 'return_status', 'returnStatus']));
    const refund = getRefundSummary(data);
    const platformCreatedAt = toDateFromPlatformTime(getNested(data, ['create_time', 'createTime', 'created_time', 'createdTime']));
    const platformUpdatedAt = toDateFromPlatformTime(getNested(data, ['update_time', 'updateTime', 'updated_time', 'updatedTime']));
    const buyer = getNested(data, ['user', 'buyer', 'customer']) || {};
    const returnImages = normalizeImageList(getNested(data, ['image', 'images', 'return_images', 'returnImages']));
    const rawLines = Array.isArray(data.item) ? data.item : toArray(data.items || data.item_list || data.itemList);
    const lines = [];

    for (let index = 0; index < rawLines.length; index += 1) {
        lines.push(await normalizeShopeeLine({
            companyId,
            platformStoreId: store.id,
            line: rawLines[index],
            parentReturnId: platformReturnId || platformOrderId,
            index,
            transaction,
        }));
    }

    if (!lines.length) {
        lines.push(await normalizeShopeeLine({
            companyId,
            platformStoreId: store.id,
            line: data,
            parentReturnId: platformReturnId || platformOrderId,
            transaction,
        }));
    }

    return {
        order: {
            company_id: companyId,
            platform: 'shopee',
            platform_store_id: store.id,
            store_name: getStoreDisplayName(store),
            platform_return_id: platformReturnId || `${platformOrderId || 'shopee-return'}-${Date.now()}`,
            platform_order_id: platformOrderId || null,
            order_number: platformOrderId || platformReturnId || null,
            platform_created_at: platformCreatedAt,
            platform_updated_at: platformUpdatedAt,
            buyer_username: clean(getNested(buyer, ['username', 'name', 'buyerName', 'buyer_name'])) || clean(getNested(data, ['buyer_username', 'buyerUsername', 'username'])) || null,
            buyer_email: clean(getNested(buyer, ['email'])) || clean(getNested(data, ['buyer_email', 'buyerEmail', 'email'])) || null,
            buyer_portrait_url: clean(getNested(buyer, ['portrait', 'avatar', 'avatar_url', 'avatarUrl'])) || clean(getNested(data, ['buyer_portrait_url', 'buyerPortraitUrl'])) || null,
            return_images_json: returnImages.length ? returnImages : null,
            warehouse_package_no: clean(getNested(data, ['package_number', 'packageNumber', 'package_id', 'packageId'])) || null,
            platform_return_status: platformStatus || null,
            platform_status_label: statusLabel(platformStatus),
            return_reason: clean(getNested(data, ['reason', 'return_reason', 'returnReason'])) || null,
            return_reason_text: clean(getNested(data, ['text_reason', 'textReason', 'reason_text', 'reasonText'])) || null,
            return_type: clean(getNested(data, ['return_refund_type', 'returnRefundType', 'return_type', 'returnType'])) || null,
            return_method: clean(getNested(data, ['validation_type', 'validationType', 'return_method', 'returnMethod'])) || null,
            shipment_type: data.needs_logistics === false ? 'without_logistic' : data.needs_logistics === true ? 'logistic' : null,
            handover_method: data.is_seller_arrange === true ? 'seller_arrange' : null,
            return_tracking_number: trackingNo || null,
            return_provider_id: clean(getNested(data, ['logistics_provider_id', 'logisticsProviderId'])) || null,
            return_provider_name: clean(getNested(data, ['logistics_provider_name', 'logisticsProviderName', 'logistic_name', 'logisticName'])) || null,
            logistic_name: clean(getNested(data, ['logistics_provider_name', 'logisticsProviderName', 'logistic_name', 'logisticName'])) || null,
            refund_currency: refund.currency || clean(data.currency) || null,
            refund_total: refund.amount,
            seller_next_action_json: data.follow_up_action_list || data.negotiation || null,
            discount_amount_json: getNested(data, ['discount_amount', 'discountAmount']) || null,
            shipping_fee_amount_json: getNested(data, ['shipping_fee', 'shippingFee', 'return_shipping_fee', 'returnShippingFee']) || null,
            raw_json: data,
            is_manual: false,
        },
        lines,
    };
};

const upsertShopeeReturnOrder = async ({ companyId, store, raw, transaction }) => {
    const { ReturnOrder, ReturnOrderLine } = require('../../models');
    const data = raw || {};
    const rawPlatformReturnId = clean(getNested(data, ['return_sn', 'returnSn', 'return_id', 'returnId', 'id']));
    const rawPlatformUpdatedAt = toDateFromPlatformTime(getNested(data, ['update_time', 'updateTime', 'updated_time', 'updatedTime']));
    if (rawPlatformReturnId && rawPlatformUpdatedAt) {
        const unchanged = await ReturnOrder.findOne({
            where: {
                company_id: companyId,
                platform: 'shopee',
                platform_return_id: rawPlatformReturnId,
                deleted_at: null,
            },
            attributes: ['id', 'platform_updated_at'],
            paranoid: false,
            transaction,
        });
        const existingPlatformUpdatedAt = unchanged?.platform_updated_at ? new Date(unchanged.platform_updated_at).getTime() : null;
        const nextPlatformUpdatedAt = new Date(rawPlatformUpdatedAt).getTime();
        if (existingPlatformUpdatedAt && nextPlatformUpdatedAt && existingPlatformUpdatedAt === nextPlatformUpdatedAt) {
            return { order: unchanged, created: false, skipped: true };
        }
    }

    const normalized = await normalizeShopeeReturnOrder({ companyId, store, raw, transaction });
    const existing = await ReturnOrder.findOne({
        where: {
            company_id: companyId,
            platform: 'shopee',
            platform_return_id: normalized.order.platform_return_id,
        },
        paranoid: false,
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    let order;
    if (existing) {
        order = existing;
        await order.update({ ...normalized.order, deleted_at: null }, { transaction });
    } else {
        order = await ReturnOrder.create({
            ...normalized.order,
            erp_return_status: 'need_to_check',
        }, { transaction });
    }

    for (const line of normalized.lines) {
        const found = await ReturnOrderLine.findOne({
            where: {
                return_order_id: order.id,
                return_line_item_id: line.return_line_item_id,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (found) {
            await found.update({
                ...line,
                company_id: companyId,
                return_order_id: order.id,
            }, { transaction });
        } else {
            await ReturnOrderLine.create({
                ...line,
                company_id: companyId,
                return_order_id: order.id,
            }, { transaction });
        }
    }

    return { order, created: !existing };
};

const extractTikTokReturnRows = (responseData) => {
    const data = responseData?.data || responseData?.response || responseData || {};
    const rows = data.returnOrders || data.return_orders || data.returns || data.list || data.items || data.data || [];
    const nextPageToken = data.nextPageToken || data.next_page_token || responseData?.nextPageToken || responseData?.next_page_token || null;
    return { rows: toArray(rows), nextPageToken: clean(nextPageToken) || null };
};

const extractShopeeReturnRows = (responseData) => {
    const data = responseData?.response || responseData?.data?.response || responseData?.data || responseData || {};
    const rows = data.return || data.returns || data.return_list || data.returnList || data.list || data.items || [];
    const more = data.more === true || data.has_more === true || data.hasMore === true;
    return { rows: toArray(rows), more };
};

const getShopeeReturnCreateTime = (raw = {}) => {
    const value = getNested(raw, ['create_time', 'createTime', 'created_time', 'createdTime', 'create_date', 'createDate']);
    const number = Number(value);
    if (Number.isFinite(number)) return number > 9999999999 ? Math.floor(number / 1000) : number;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
};

const sortShopeeReturnsByCreateTimeAsc = (rows = []) =>
    [...rows].sort((left, right) => getShopeeReturnCreateTime(left) - getShopeeReturnCreateTime(right));

const toPlatformEpochSecond = (value) => {
    if (!value) return 0;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? Math.floor(time / 1000) : 0;
};

const isShopeeReturnWithinDays = (raw, days) => {
    const createTime = getShopeeReturnCreateTime(raw);
    if (!createTime) return true;
    return createTime >= Math.floor(Date.now() / 1000) - Math.max(1, Number(days) || SHOPEE_RETURN_FIRST_SYNC_DAYS) * SECONDS_IN_DAY;
};

const getUnchangedPlatformReturnIds = async ({ companyId, platform, rows = [], getReturnId, getUpdatedAt }) => {
    const { ReturnOrder } = require('../../models');
    const incoming = new Map();
    for (const row of rows) {
        const returnId = clean(getReturnId(row));
        const updatedAt = toPlatformEpochSecond(getUpdatedAt(row));
        if (returnId && updatedAt) incoming.set(returnId, updatedAt);
    }
    const returnIds = [...incoming.keys()];
    if (!returnIds.length) return new Set();

    const existingRows = await ReturnOrder.findAll({
        where: {
            company_id: companyId,
            platform,
            platform_return_id: { [Op.in]: returnIds },
            deleted_at: null,
        },
        attributes: ['platform_return_id', 'platform_updated_at'],
        paranoid: false,
        raw: true,
    });

    return new Set(existingRows
        .filter((row) => incoming.get(row.platform_return_id) === toPlatformEpochSecond(row.platform_updated_at))
        .map((row) => row.platform_return_id));
};

const getShopeeStoreSyncState = async (companyId, storeId) => {
    const { ReturnOrderSyncState } = require('../../models');
    return ReturnOrderSyncState.findOne({
        where: {
            company_id: companyId,
            platform: 'shopee',
            platform_store_id: storeId,
        },
        raw: true,
    });
};

const setShopeeStoreSyncState = async (companyId, storeId, patch = {}) => {
    const { ReturnOrderSyncState } = require('../../models');
    const values = {
        company_id: companyId,
        platform: 'shopee',
        platform_store_id: storeId,
        last_synced_page: patch.lastSyncedPage ?? null,
        previous_last_page: patch.previousLastPage ?? null,
        first_requested_page: patch.firstRequestedPage ?? null,
        fetched_rows: patch.fetchedRows ?? 0,
        last_sync_at: new Date(),
        metadata_json: {
            more: patch.more === true,
            mode: patch.mode || null,
        },
    };

    const [row] = await ReturnOrderSyncState.findOrCreate({
        where: {
            company_id: companyId,
            platform: 'shopee',
            platform_store_id: storeId,
        },
        defaults: values,
    });

    if (!row.isNewRecord) {
        await row.update(values);
    }
};

const isReturnStoreSyncDue = (storeState) => {
    const lastSyncAt = storeState?.last_sync_at;
    if (!lastSyncAt) return true;

    const elapsed = Date.now() - new Date(lastSyncAt).getTime();
    return !Number.isFinite(elapsed) || elapsed >= SHOPEE_RETURN_BACKGROUND_INTERVAL_MS;
};

const shouldStartDueShopeeStoreSync = async (companyId, storeId) =>
    isReturnStoreSyncDue(await getShopeeStoreSyncState(companyId, storeId));

const getTikTokStoreSyncState = async (companyId, storeId) => {
    const { ReturnOrderSyncState } = require('../../models');
    return ReturnOrderSyncState.findOne({
        where: {
            company_id: companyId,
            platform: 'tiktok',
            platform_store_id: storeId,
        },
        raw: true,
    });
};

const setTikTokStoreSyncState = async (companyId, storeId, patch = {}) => {
    const { ReturnOrderSyncState } = require('../../models');
    const values = {
        company_id: companyId,
        platform: 'tiktok',
        platform_store_id: storeId,
        last_synced_page: patch.lastSyncedPage ?? null,
        previous_last_page: null,
        first_requested_page: null,
        fetched_rows: patch.fetchedRows ?? 0,
        last_sync_at: new Date(),
        metadata_json: {
            rangeStart: patch.rangeStart ?? null,
            rangeEnd: patch.rangeEnd ?? null,
            days: patch.days ?? null,
            firstSync: patch.firstSync === true,
            firstSyncCompleted: patch.firstSyncCompleted === true,
            failed: patch.failed === true,
            reason: patch.reason || null,
            nextPageToken: patch.nextPageToken || null,
        },
    };

    const [row] = await ReturnOrderSyncState.findOrCreate({
        where: {
            company_id: companyId,
            platform: 'tiktok',
            platform_store_id: storeId,
        },
        defaults: values,
    });

    if (!row.isNewRecord) {
        await row.update(values);
    }
};

const hasTikTokFirstSyncCompleted = (storeState) => {
    const metadata = parseJsonValue(storeState?.metadata_json, {});
    return metadata?.firstSyncCompleted === true;
};

const shouldStartDueTikTokStoreSync = async (companyId, storeId) =>
    isReturnStoreSyncDue(await getTikTokStoreSyncState(companyId, storeId));

const callTikTokReturnsSearch = async ({ store, days = 7, startDate, endDate, pageSize = 50 }) => {
    const openId = clean(store.store_open_id);
    const cipher = clean(store.store_cipher);
    if (!openId || !cipher) {
        return { rows: [], skipped: true, reason: 'TikTok store openId/cipher missing' };
    }

    const range = getOptionDateRange({ days, startDate, endDate });
    const baseBody = {
        createTimeGe: range.start,
        createTimeLt: range.end,
        updateTimeGe: range.start,
        updateTimeLt: range.end,
        returnStatus: TIKTOK_RETURN_STATUSES,
    };

    const rows = [];
    let nextPageToken = null;
    let page = 0;
    const url = `${JAVA_API_BASE_URL}${TIKTOK_RETURN_SEARCH_PATH}`;

    do {
        page += 1;
        const params = {
            openId,
            cipher,
            sortField: 'update_time',
            sortOrder: 'DESC',
            pageSize,
            ...(nextPageToken ? { pageToken: nextPageToken } : {}),
        };
        let response;
        try {
            response = await axios.post(
                url,
                baseBody,
                {
                    params,
                    headers: { accept: '*/*', 'Content-Type': 'application/json' },
                    timeout: 30000,
                }
            );
        } catch (err) {
            console.error('[returnOrders][TikTokReturnSearch] axios error', {
                url,
                params: { ...params, cipher: cipher ? '[present]' : '' },
                body: baseBody,
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                page,
                message: err.message,
                code: err.code,
                status: err.response?.status,
                statusText: err.response?.statusText,
                responseKeys: getTopLevelKeys(err.response?.data),
                responsePreview: getResponsePreview(err.response?.data),
            });
            throw err;
        }

        const extracted = extractTikTokReturnRows(response.data);
        rows.push(...extracted.rows);
        nextPageToken = extracted.nextPageToken;
    } while (nextPageToken && page < TIKTOK_RETURN_SYNC_MAX_PAGES);

    return { rows, skipped: false, range, pagesFetched: page, nextPageToken };
};

const callShopeeReturnsList = async ({ companyId, store, pageSize = 50 }) => {
    const shopId = clean(store.store_shop_id || store.external_store_id);
    if (!shopId) {
        return { rows: [], skipped: true, reason: 'Shopee store shopId missing' };
    }

    const storeState = await getShopeeStoreSyncState(companyId, store.id);
    const previousLastPage = Number.parseInt(storeState?.last_synced_page || '0', 10) || 0;
    const url = `${JAVA_API_BASE_URL}${SHOPEE_RETURN_LIST_PATH}`;
    const fetchPage = async (pageNo, purpose = 'sync') => {
        const params = {
            shopId,
            pageNo,
            pageSize,
        };

        let response;
        try {
            response = await axios.get(
                url,
                {
                    params,
                    headers: { accept: '*/*' },
                    timeout: 30000,
                }
            );
        } catch (err) {
            console.error('[returnOrders][ShopeeReturnList] axios error', {
                url,
                params: {
                    shopId,
                    pageNo,
                    pageSize,
                },
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                purpose,
                message: err.message,
                code: err.code,
                status: err.response?.status,
                statusText: err.response?.statusText,
                responseKeys: getTopLevelKeys(err.response?.data),
                responsePreview: getResponsePreview(err.response?.data),
            });
            throw err;
        }

        const extracted = extractShopeeReturnRows(response.data);
        return { pageNo, rows: extracted.rows, more: extracted.more };
    };

    const findLastPage = async () => {
        const firstPage = await fetchPage(1, 'find-last');
        if (!firstPage.rows.length) return { lastPage: 0, pages: new Map([[1, firstPage]]) };
        const pages = new Map([[1, firstPage]]);
        if (!firstPage.more) return { lastPage: 1, pages };

        let low = 1;
        let high = 2;
        while (high <= SHOPEE_RETURN_SYNC_MAX_PAGES) {
            const page = await fetchPage(high, 'find-last');
            pages.set(high, page);
            if (!page.rows.length || !page.more) break;
            low = high;
            high *= 2;
        }

        if (high > SHOPEE_RETURN_SYNC_MAX_PAGES) high = SHOPEE_RETURN_SYNC_MAX_PAGES;
        const highPage = pages.get(high) || await fetchPage(high, 'find-last');
        pages.set(high, highPage);
        if (highPage.rows.length && !highPage.more) {
            return { lastPage: high, pages };
        }

        let lastGoodPage = highPage.rows.length ? high : low;
        let left = low + 1;
        let right = high - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const page = pages.get(mid) || await fetchPage(mid, 'find-last');
            pages.set(mid, page);
            if (page.rows.length) {
                lastGoodPage = mid;
                if (!page.more) {
                    return { lastPage: mid, pages };
                }
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return { lastPage: lastGoodPage, pages };
    };

    const rows = [];
    let firstRequestedPage;
    let lastFetchedPage;
    let more = false;

    if (previousLastPage <= 0) {
        const { lastPage, pages } = await findLastPage();
        if (lastPage <= 0) {
            await setShopeeStoreSyncState(companyId, store.id, {
                lastSyncedPage: 0,
                previousLastPage,
                firstRequestedPage: 1,
                fetchedRows: 0,
                more: false,
                mode: 'first-sync-latest-window',
            });
            return {
                rows: [],
                skipped: false,
                firstRequestedPage: 1,
                lastSyncedPage: 0,
                previousLastPage,
            };
        }

        firstRequestedPage = lastPage;
        lastFetchedPage = lastPage;
        for (let pageNo = lastPage; pageNo >= 1; pageNo -= 1) {
            const page = pages.get(pageNo) || await fetchPage(pageNo, 'first-sync-backward');
            pages.set(pageNo, page);
            const recentRows = page.rows.filter((row) => isShopeeReturnWithinDays(row, SHOPEE_RETURN_FIRST_SYNC_DAYS));
            rows.push(...recentRows);
            lastFetchedPage = Math.max(lastFetchedPage, pageNo);

            const pageHasRows = page.rows.length > 0;
            const pageHasRecentRows = recentRows.length > 0;
            if (!pageHasRows || !pageHasRecentRows) break;
        }
        more = false;
    } else {
        firstRequestedPage = Math.max(1, previousLastPage - SHOPEE_RETURN_SYNC_OVERLAP_PAGES);
        let pageNo = firstRequestedPage;
        lastFetchedPage = firstRequestedPage - 1;

        do {
            const page = await fetchPage(pageNo, 'incremental-forward');
            rows.push(...page.rows.filter((row) => isShopeeReturnWithinDays(row, SHOPEE_RETURN_FIRST_SYNC_DAYS)));
            lastFetchedPage = pageNo;
            more = page.more && page.rows.length > 0;
            pageNo += 1;
        } while (more && pageNo <= SHOPEE_RETURN_SYNC_MAX_PAGES);
    }

    await setShopeeStoreSyncState(companyId, store.id, {
        lastSyncedPage: lastFetchedPage,
        previousLastPage,
        firstRequestedPage,
        fetchedRows: rows.length,
        more,
        mode: previousLastPage <= 0 ? 'first-sync-latest-window' : 'incremental-forward',
    });

    return {
        rows: sortShopeeReturnsByCreateTimeAsc(rows),
        skipped: false,
        firstRequestedPage,
        lastSyncedPage: lastFetchedPage,
        previousLastPage,
    };
};

const getSyncStores = async (user, { platform = 'tiktok', platformStoreId, platformStoreIds, storeIds, storeId } = {}) => {
    const { PlatformStore } = require('../../models');
    const companyId = getUserCompanyId(user);
    const selectedStoreIds = [
        ...(Array.isArray(platformStoreIds) ? platformStoreIds : []),
        ...(Array.isArray(storeIds) ? storeIds : []),
        platformStoreId,
        storeId,
    ]
        .filter((value) => value !== undefined && value !== null && value !== '' && value !== 'all')
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0);
    const where = {
        company_id: companyId,
        platform,
        is_active: true,
        deleted_at: null,
    };
    if (selectedStoreIds.length === 1) where.id = selectedStoreIds[0];
    if (selectedStoreIds.length > 1) where.id = { [Op.in]: [...new Set(selectedStoreIds)] };

    const permittedStoreIds = await getPermittedStoreIds(user);
    if (Array.isArray(permittedStoreIds)) {
        if (!permittedStoreIds.length) return [];
        const disallowedStore = selectedStoreIds.find((id) => !permittedStoreIds.includes(id));
        if (disallowedStore) {
            const err = new Error('You do not have access to this store');
            err.statusCode = 403;
            throw err;
        }
        if (!where.id) where.id = { [Op.in]: permittedStoreIds };
    }

    return PlatformStore.findAll({ where, order: [['store_name', 'ASC']] });
};

const hasDueReturnSyncStore = async (user, { platform, ...options } = {}) => {
    const companyId = getUserCompanyId(user);
    const stores = await getSyncStores(user, { ...options, platform });
    for (const store of stores) {
        const state = platform === 'shopee'
            ? await getShopeeStoreSyncState(companyId, store.id)
            : await getTikTokStoreSyncState(companyId, store.id);
        if (isReturnStoreSyncDue(state)) return true;
    }
    return false;
};

const syncTikTokReturnOrders = async (user, options = {}) => {
    const companyId = getUserCompanyId(user);
    const stores = await getSyncStores(user, { ...options, platform: 'tiktok' });
    const summary = {
        platform: 'tiktok',
        storesChecked: stores.length,
        fetched: 0,
        created: 0,
        updated: 0,
        skippedRows: 0,
        pruned: 0,
        skippedStores: [],
        failedStores: [],
        failedRows: [],
    };

    for (const store of stores) {
        const storeState = await getTikTokStoreSyncState(companyId, store.id);
        if (options.dueOnly && !isReturnStoreSyncDue(storeState)) {
            summary.skippedStores.push({
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                reason: 'TikTok return sync is not due yet',
            });
            continue;
        }
        const firstSync = !hasTikTokFirstSyncCompleted(storeState);
        const syncDays = firstSync ? TIKTOK_RETURN_FIRST_SYNC_DAYS : TIKTOK_RETURN_RECENT_SYNC_DAYS;
        let search;
        try {
            search = await callTikTokReturnsSearch({
                store,
                days: syncDays,
                pageSize: options.pageSize || 50,
            });
        } catch (err) {
            const reason = getErrorMessage(err);
            summary.failedStores.push({ storeId: store.id, storeName: getStoreDisplayName(store), reason });
            await setTikTokStoreSyncState(companyId, store.id, {
                fetchedRows: 0,
                days: syncDays,
                firstSync,
                firstSyncCompleted: false,
                failed: true,
                reason,
            });
            console.error('[returnOrders] TikTok return list sync failed:', {
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                reason,
            });
            continue;
        }

        if (search.skipped) {
            summary.skippedStores.push({ storeId: store.id, storeName: getStoreDisplayName(store), reason: search.reason });
            await setTikTokStoreSyncState(companyId, store.id, {
                fetchedRows: 0,
                days: syncDays,
                firstSync,
                firstSyncCompleted: !firstSync,
                failed: true,
                reason: search.reason,
            });
            continue;
        }
        summary.fetched += search.rows.length;
        const unchangedReturnIds = await getUnchangedPlatformReturnIds({
            companyId,
            platform: 'tiktok',
            rows: search.rows,
            getReturnId: (row) => getNested(row, ['returnId', 'return_id', 'returnOrderId', 'return_order_id', 'id']),
            getUpdatedAt: (row) => toDateFromPlatformTime(getNested(row, ['updateTime', 'update_time', 'updatedTime', 'updated_time'])),
        });

        for (let index = 0; index < search.rows.length; index += 1) {
            const raw = search.rows[index];
            const returnId = clean(getNested(raw, ['returnId', 'return_id', 'returnOrderId', 'return_order_id', 'id']));
            if (returnId && unchangedReturnIds.has(returnId)) {
                summary.skippedRows += 1;
                continue;
            }
            try {
                await sequelize.transaction(async (transaction) => {
                    const result = await upsertTikTokReturnOrder({ companyId, store, raw, transaction });
                    if (result.created) summary.created += 1;
                    else if (result.skipped) summary.skippedRows += 1;
                    else summary.updated += 1;
                });
            } catch (err) {
                const reason = getErrorMessage(err);
                summary.failedRows.push({
                    storeId: store.id,
                    storeName: getStoreDisplayName(store),
                    rowIndex: index,
                    returnId: clean(getNested(raw, ['returnId', 'return_id', 'returnOrderId', 'return_order_id', 'id'])) || null,
                    orderId: clean(getNested(raw, ['orderId', 'order_id', 'mainOrderId', 'main_order_id'])) || null,
                    reason,
                });
                console.error('[returnOrders] TikTok return row sync failed:', {
                    storeId: store.id,
                    rowIndex: index,
                    reason,
                });
            }
        }

        await setTikTokStoreSyncState(companyId, store.id, {
            lastSyncedPage: search.pagesFetched,
            fetchedRows: search.rows.length,
            rangeStart: search.range?.start,
            rangeEnd: search.range?.end,
            days: syncDays,
            firstSync,
            firstSyncCompleted: true,
            failed: false,
            nextPageToken: search.nextPageToken,
        });
        summary.pruned += await pruneOldReturnOrdersForStore({ companyId, platform: 'tiktok', storeId: store.id });
    }

    return summary;
};

const syncShopeeReturnOrders = async (user, options = {}) => {
    const companyId = getUserCompanyId(user);
    const stores = await getSyncStores(user, { ...options, platform: 'shopee' });
    const summary = {
        platform: 'shopee',
        storesChecked: stores.length,
        fetched: 0,
        created: 0,
        updated: 0,
        skippedRows: 0,
        pruned: 0,
        skippedStores: [],
        failedStores: [],
        failedRows: [],
    };

    for (const store of stores) {
        if (options.dueOnly && !(await shouldStartDueShopeeStoreSync(companyId, store.id))) {
            summary.skippedStores.push({
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                reason: 'Shopee return sync is not due yet',
            });
            continue;
        }
        let search;
        try {
            search = await callShopeeReturnsList({
                companyId,
                store,
                pageSize: options.pageSize || 50,
            });
        } catch (err) {
            const reason = getErrorMessage(err);
            summary.failedStores.push({ storeId: store.id, storeName: getStoreDisplayName(store), reason });
            console.error('[returnOrders] Shopee return list sync failed:', {
                storeId: store.id,
                storeName: getStoreDisplayName(store),
                reason,
            });
            continue;
        }

        if (search.skipped) {
            summary.skippedStores.push({ storeId: store.id, storeName: getStoreDisplayName(store), reason: search.reason });
            continue;
        }
        summary.fetched += search.rows.length;
        const unchangedReturnIds = await getUnchangedPlatformReturnIds({
            companyId,
            platform: 'shopee',
            rows: search.rows,
            getReturnId: (row) => getNested(row, ['return_sn', 'returnSn', 'return_id', 'returnId', 'id']),
            getUpdatedAt: (row) => toDateFromPlatformTime(getNested(row, ['update_time', 'updateTime', 'updated_time', 'updatedTime'])),
        });

        for (let index = 0; index < search.rows.length; index += 1) {
            const raw = search.rows[index];
            const returnId = clean(getNested(raw, ['return_sn', 'returnSn', 'return_id', 'returnId', 'id']));
            if (returnId && unchangedReturnIds.has(returnId)) {
                summary.skippedRows += 1;
                continue;
            }
            try {
                await sequelize.transaction(async (transaction) => {
                    const result = await upsertShopeeReturnOrder({ companyId, store, raw, transaction });
                    if (result.created) summary.created += 1;
                    else if (result.skipped) summary.skippedRows += 1;
                    else if (!result.skipped) summary.updated += 1;
                });
            } catch (err) {
                const reason = getErrorMessage(err);
                summary.failedRows.push({
                    storeId: store.id,
                    storeName: getStoreDisplayName(store),
                    rowIndex: index,
                    returnId: clean(getNested(raw, ['return_sn', 'returnSn', 'return_id', 'returnId', 'id'])) || null,
                    orderId: clean(getNested(raw, ['order_sn', 'orderSn', 'order_id', 'orderId'])) || null,
                    reason,
                });
                console.error('[returnOrders] Shopee return row sync failed:', {
                    storeId: store.id,
                    rowIndex: index,
                    reason,
                });
            }
        }
        summary.pruned += await pruneOldReturnOrdersForStore({ companyId, platform: 'shopee', storeId: store.id });
    }

    return summary;
};

const toJobCompanyId = (value) => Number(value);

const getReturnSyncJobs = (companyId = null) => {
    const targetCompanyId = companyId ? Number(companyId) : null;
    const jobs = [];
    for (const [jobCompanyId, job] of shopeeReturnSyncJobs.entries()) {
        if (!targetCompanyId || Number(jobCompanyId) === targetCompanyId) {
            jobs.push({ platform: 'shopee', companyId: Number(jobCompanyId), ...job });
        }
    }
    for (const [jobCompanyId, job] of tiktokReturnSyncJobs.entries()) {
        if (!targetCompanyId || Number(jobCompanyId) === targetCompanyId) {
            jobs.push({ platform: 'tiktok', companyId: Number(jobCompanyId), ...job });
        }
    }
    return jobs;
};

const getShopeeReturnSyncJobStatus = (userOrCompanyId = null) => {
    const companyId = typeof userOrCompanyId === 'object'
        ? getUserCompanyId(userOrCompanyId)
        : toJobCompanyId(userOrCompanyId);
    const job = shopeeReturnSyncJobs.get(companyId);
    if (!job) return { running: false };
    return {
        running: true,
        platform: 'shopee',
        companyId,
        jobId: job.jobId,
        source: job.source,
        startedAt: job.startedAt,
    };
};

const getReturnSyncJobStatus = (userOrCompanyId = null) => {
    const companyId = userOrCompanyId
        ? (typeof userOrCompanyId === 'object' ? getUserCompanyId(userOrCompanyId) : toJobCompanyId(userOrCompanyId))
        : null;
    const jobs = getReturnSyncJobs(companyId);
    if (!jobs.length) return { running: false, jobs: [] };
    return {
        running: true,
        jobs,
        jobId: jobs.map((job) => job.jobId).join(','),
        source: jobs.map((job) => `${job.platform}:${job.source}`).join(','),
        startedAt: jobs[0].startedAt,
    };
};

const startShopeeReturnSyncJob = async (user, options = {}) => {
    const companyId = getUserCompanyId(user);
    if (options.dueOnly && !(await hasDueReturnSyncStore(user, { ...options, platform: 'shopee' }))) {
        return {
            queued: false,
            skipped: true,
            reason: 'No Shopee return stores are due for sync',
            ...getShopeeReturnSyncJobStatus(companyId),
        };
    }
    if (shopeeReturnSyncJobs.has(companyId)) {
        return {
            queued: false,
            alreadyRunning: true,
            ...getShopeeReturnSyncJobStatus(companyId),
        };
    }

    const jobId = `shopee-return-${Date.now()}`;
    const safeUser = {
        userId: user.userId || user.id || null,
        companyId,
        company_id: companyId,
        role: user.role || 'owner',
        isOwner: user.isOwner === true || user.is_owner === true || String(user.role || '').toLowerCase() === 'owner',
        permissions: user.permissions,
    };
    const safeOptions = {
        platformStoreId: options.platformStoreId,
        storeId: options.storeId,
        storeIds: Array.isArray(options.storeIds) ? options.storeIds : undefined,
        pageSize: options.pageSize,
        dueOnly: options.dueOnly === true,
    };

    const job = {
        jobId,
        companyId,
        source: options.source || 'manual',
        startedAt: new Date().toISOString(),
    };
    shopeeReturnSyncJobs.set(companyId, job);

    Promise.resolve()
        .then(() => syncShopeeReturnOrders(safeUser, safeOptions))
        .then(() => {})
        .catch((err) => {
            console.error('[returnOrders] Shopee background sync failed:', getErrorMessage(err));
        })
        .finally(() => {
            shopeeReturnSyncJobs.delete(companyId);
        });

    return {
        queued: true,
        running: true,
        jobId,
        companyId,
        source: options.source || 'manual',
        startedAt: job.startedAt,
    };
};

const startTikTokReturnSyncJob = async (user, options = {}) => {
    const companyId = getUserCompanyId(user);
    if (options.dueOnly && !(await hasDueReturnSyncStore(user, { ...options, platform: 'tiktok' }))) {
        return {
            queued: false,
            skipped: true,
            reason: 'No TikTok return stores are due for sync',
            ...getReturnSyncJobStatus(companyId),
        };
    }
    if (tiktokReturnSyncJobs.has(companyId)) {
        return {
            queued: false,
            alreadyRunning: true,
            ...getReturnSyncJobStatus(companyId),
        };
    }

    const jobId = `tiktok-return-${Date.now()}`;
    const safeUser = {
        userId: user.userId || user.id || null,
        companyId,
        company_id: companyId,
        role: user.role || 'owner',
        isOwner: user.isOwner === true || user.is_owner === true || String(user.role || '').toLowerCase() === 'owner',
        permissions: user.permissions,
    };
    const safeOptions = {
        platformStoreId: options.platformStoreId,
        storeId: options.storeId,
        storeIds: Array.isArray(options.storeIds) ? options.storeIds : undefined,
        pageSize: options.pageSize,
        dueOnly: options.dueOnly === true,
    };

    const job = {
        jobId,
        companyId,
        source: options.source || 'manual',
        startedAt: new Date().toISOString(),
    };
    tiktokReturnSyncJobs.set(companyId, job);

    Promise.resolve()
        .then(() => syncTikTokReturnOrders(safeUser, safeOptions))
        .then(() => {})
        .catch((err) => {
            console.error('[returnOrders] TikTok background sync failed:', getErrorMessage(err));
        })
        .finally(() => {
            tiktokReturnSyncJobs.delete(companyId);
        });

    return {
        queued: true,
        running: true,
        jobId,
        companyId,
        source: options.source || 'manual',
        startedAt: job.startedAt,
    };
};

const runScheduledShopeeReturnSync = async ({ source = 'scheduler' } = {}) => {
    const { Company } = require('../../models');
    const companies = await Company.findAll({
        where: { status: { [Op.in]: ['active', 'trial'] } },
        attributes: ['id'],
        raw: true,
    });

    const results = [];
    for (const company of companies) {
        const companyId = Number(company.id);
        if (shopeeReturnSyncJobs.has(companyId)) {
            results.push({ companyId, skipped: true, reason: 'Shopee return sync already running' });
            continue;
        }

        const user = {
            userId: null,
            companyId,
            company_id: companyId,
            role: 'owner',
            isOwner: true,
        };
        if (!(await hasDueReturnSyncStore(user, { platform: 'shopee' }))) {
            results.push({ companyId, skipped: true, reason: 'No Shopee return stores are due for sync' });
            continue;
        }

        const jobId = `shopee-return-${Date.now()}-${companyId}`;
        shopeeReturnSyncJobs.set(companyId, {
            jobId,
            companyId,
            source,
            startedAt: new Date().toISOString(),
        });

        try {
            const result = await syncShopeeReturnOrders(user, { dueOnly: true });
            results.push({ companyId, jobId, ...result });
        } finally {
            shopeeReturnSyncJobs.delete(companyId);
        }
    }

    return { companiesChecked: companies.length, results };
};

const runScheduledTikTokReturnSync = async ({ source = 'scheduler' } = {}) => {
    const { Company } = require('../../models');
    const companies = await Company.findAll({
        where: { status: { [Op.in]: ['active', 'trial'] } },
        attributes: ['id'],
        raw: true,
    });

    const results = [];
    for (const company of companies) {
        const companyId = Number(company.id);
        if (tiktokReturnSyncJobs.has(companyId)) {
            results.push({ companyId, skipped: true, reason: 'TikTok return sync already running' });
            continue;
        }

        const user = {
            userId: null,
            companyId,
            company_id: companyId,
            role: 'owner',
            isOwner: true,
        };
        if (!(await hasDueReturnSyncStore(user, { platform: 'tiktok' }))) {
            results.push({ companyId, skipped: true, reason: 'No TikTok return stores are due for sync' });
            continue;
        }

        const jobId = `tiktok-return-${Date.now()}-${companyId}`;
        tiktokReturnSyncJobs.set(companyId, {
            jobId,
            companyId,
            source,
            startedAt: new Date().toISOString(),
        });

        try {
            const result = await syncTikTokReturnOrders(user, { dueOnly: true });
            results.push({ companyId, jobId, ...result });
        } finally {
            tiktokReturnSyncJobs.delete(companyId);
        }
    }

    return { companiesChecked: companies.length, results };
};

const buildListWhere = async (user, filters = {}) => {
    const companyId = getUserCompanyId(user);
    const where = { company_id: companyId, deleted_at: null };
    if (filters.platform && filters.platform !== 'all') where.platform = filters.platform;
    if (filters.status && filters.status !== 'all') where.erp_return_status = normalizeNullableStatus(filters.status);
    const dateCondition = getListDateCondition(filters);
    if (dateCondition) {
        where[Op.and] = [
            ...(where[Op.and] || []),
            {
                [Op.or]: [
                    { platform_created_at: dateCondition },
                    { platform_created_at: null, created_at: dateCondition },
                ],
            },
        ];
    }
    if (filters.warehouseId && filters.warehouseId !== 'all') {
        await assertWarehousePermission(user, filters.warehouseId);
        where.warehouse_id = Number(filters.warehouseId);
    } else {
        Object.assign(where, await applyWarehouseScope(user, {}, 'warehouse_id'));
    }

    const permittedStoreIds = await getPermittedStoreIds(user);
    if (Array.isArray(permittedStoreIds)) {
        if (!permittedStoreIds.length) {
            where.platform_store_id = { [Op.in]: [-1] };
        } else {
            where[Op.or] = [
                { platform_store_id: { [Op.in]: permittedStoreIds } },
                { platform: 'manual' },
            ];
        }
    }

    if (filters.storeId && filters.storeId !== 'all') where.platform_store_id = Number(filters.storeId);

    const searchCondition = await buildSearchCondition(companyId, filters);
    if (searchCondition) {
        where[Op.and] = [
            ...(where[Op.and] || []),
            searchCondition,
        ];
    }

    return where;
};

const getReturnInclude = () => {
    const { ReturnOrderLine, Warehouse, PlatformStore, MerchantSku } = require('../../models');
    return [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
        { model: PlatformStore, as: 'platformStore', attributes: ['id', 'platform', 'store_name', 'external_store_id', 'store_shop_id', 'region'], required: false },
        {
            model: ReturnOrderLine,
            as: 'lines',
            required: false,
            include: [{
                model: MerchantSku,
                as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
                required: false,
            }],
        },
    ];
};

const formatReturnLine = (line) => ({
    id: line.id,
    merchantSkuId: line.merchant_sku_id,
    sku: line.seller_sku || line.sku_name || line.merchantSku?.sku_name || line.platform_sku_id || '',
    skuName: line.sku_name || line.seller_sku || line.merchantSku?.sku_name || '',
    platformSkuId: line.platform_sku_id,
    productName: line.product_name || line.merchantSku?.sku_title || line.seller_sku || '',
    image: line.product_image_url || line.merchantSku?.image_url || '',
    quantity: Number(line.quantity || 0),
    refundCurrency: line.refund_currency,
    refundTotal: line.refund_total !== null && line.refund_total !== undefined ? Number(line.refund_total) : null,
    raw: parseJsonValue(line.raw_json, line.raw_json || null),
});

const formatReturnOrder = (order) => {
    const plainOrder = order?.get ? order.get({ plain: true }) : order;
    const lines = (plainOrder.lines || []).map(formatReturnLine);
    const firstLine = lines[0] || {};
    const platformCreatedAt = plainOrder.platform_created_at || plainOrder.platformCreatedAt || null;
    const platformUpdatedAt = plainOrder.platform_updated_at || plainOrder.platformUpdatedAt || null;
    const returnImages = parseJsonValue(plainOrder.return_images_json, []);
    const raw = parseJsonValue(plainOrder.raw_json, plainOrder.raw_json || {});
    return {
        id: plainOrder.id,
        platform: plainOrder.platform,
        platformLabel: plainOrder.platform === 'manual' ? 'Manual' : plainOrder.platform === 'tiktok' ? 'TikTok' : 'Shopee',
        platformStoreId: plainOrder.platform_store_id,
        storeName: plainOrder.store_name || plainOrder.platformStore?.store_name || '',
        warehouseId: plainOrder.warehouse_id,
        warehouseName: plainOrder.warehouse?.name || '',
        warehouseCode: plainOrder.warehouse?.code || '',
        platformReturnId: plainOrder.platform_return_id,
        platformOrderId: plainOrder.platform_order_id,
        orderNo: plainOrder.order_number || '',
        orderNumber: plainOrder.order_number || '',
        returnId: plainOrder.platform_return_id || '',
        platformCreatedAt,
        platformUpdatedAt,
        buyerUsername: plainOrder.buyer_username || '',
        buyerEmail: plainOrder.buyer_email || '',
        buyerPortraitUrl: plainOrder.buyer_portrait_url || '',
        returnImages: Array.isArray(returnImages) ? returnImages : [],
        pkgNo: plainOrder.warehouse_package_no || '',
        warehousePackageNo: plainOrder.warehouse_package_no || '',
        sku: firstLine.sku || '',
        image: firstLine.image || '',
        trackingNo: plainOrder.return_tracking_number || '',
        platformTrackingNo: plainOrder.return_tracking_number || '',
        returnTrackingNo: plainOrder.local_return_tracking_number || '',
        localReturnTrackingNo: plainOrder.local_return_tracking_number || '',
        logisticName: plainOrder.logistic_name || plainOrder.return_provider_name || '',
        returnProviderName: plainOrder.return_provider_name || '',
        returnStatus: plainOrder.erp_return_status,
        platformReturnStatus: plainOrder.platform_return_status,
        platformStatusLabel: plainOrder.platform_status_label || statusLabel(plainOrder.platform_return_status),
        returnReason: plainOrder.return_reason,
        returnReasonText: plainOrder.return_reason_text,
        platformReturnType: plainOrder.return_type,
        localReturnType: plainOrder.local_return_type || '',
        returnType: plainOrder.local_return_type || 'by_logistic',
        remark: plainOrder.remark || '',
        refundCurrency: plainOrder.refund_currency,
        refundTotal: plainOrder.refund_total !== null && plainOrder.refund_total !== undefined ? Number(plainOrder.refund_total) : null,
        status: plainOrder.platform_status_label || statusLabel(plainOrder.platform_return_status),
        isManual: Boolean(plainOrder.is_manual),
        isResaleableInbounded: Boolean(plainOrder.is_resaleable_inbounded),
        resaleableInboundOrderId: plainOrder.resaleable_inbound_order_id,
        products: lines,
        raw,
        createdAt: platformCreatedAt || plainOrder.created_at || plainOrder.createdAt,
        updatedAt: platformUpdatedAt || plainOrder.updated_at || plainOrder.updatedAt,
        dbCreatedAt: plainOrder.created_at || plainOrder.createdAt,
        dbUpdatedAt: plainOrder.updated_at || plainOrder.updatedAt,
    };
};

const getReturnOrderSort = (filters = {}) => {
    const direction = clean(filters.sortDirection).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const field = clean(filters.sortField);
    const sortMap = {
        platformCreateTime: 'platform_created_at',
        platformUpdateTime: 'platform_updated_at',
        returnStatus: 'erp_return_status',
        platformStatus: 'platform_status_label',
    };
    if (sortMap[field]) {
        return [[sortMap[field], direction], ['id', direction]];
    }
    return [['platform_created_at', 'DESC'], ['created_at', 'DESC'], ['id', 'DESC']];
};

const listReturnOrders = async (user, filters = {}) => {
    const { ReturnOrder } = require('../../models');
    const page = Math.max(1, Number.parseInt(filters.page || 1, 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit || 20, 10)));
    const where = await buildListWhere(user, filters);
    const { count, rows } = await ReturnOrder.findAndCountAll({
        where,
        include: getReturnInclude(),
        order: getReturnOrderSort(filters),
        limit,
        offset: (page - 1) * limit,
        distinct: true,
    });

    return {
        data: rows.map(formatReturnOrder),
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    };
};

const getReturnOrderById = async (user, id) => {
    const { ReturnOrder } = require('../../models');
    const order = await ReturnOrder.findOne({
        where: { id, company_id: getUserCompanyId(user), deleted_at: null },
        include: getReturnInclude(),
    });
    await assertReturnOrderAccess(user, order);
    return formatReturnOrder(order);
};

const getManualReturnStore = async (user, { platform, platformStoreId }) => {
    const { PlatformStore } = require('../../models');
    const companyId = getUserCompanyId(user);
    const storeId = Number(platformStoreId);
    const normalizedPlatform = clean(platform).toLowerCase();
    if (!['shopee', 'tiktok'].includes(normalizedPlatform)) {
        const err = new Error('platform is required');
        err.statusCode = 400;
        throw err;
    }
    if (!storeId) {
        const err = new Error('platformStoreId is required');
        err.statusCode = 400;
        throw err;
    }
    const permittedStoreIds = await getPermittedStoreIds(user);
    if (Array.isArray(permittedStoreIds) && !permittedStoreIds.includes(storeId)) {
        const err = new Error('You do not have access to this store');
        err.statusCode = 403;
        throw err;
    }
    const store = await PlatformStore.findOne({
        where: {
            id: storeId,
            company_id: companyId,
            platform: normalizedPlatform,
            is_active: true,
            deleted_at: null,
        },
    });
    if (!store) {
        const err = new Error('Platform store not found');
        err.statusCode = 404;
        throw err;
    }
    return store;
};

const getOrderLookupLineIds = (line = {}) => ({
    itemId: clean(getNested(line, ['item_id', 'itemId', 'product_id', 'productId', 'item.id', 'product.id'])),
    modelId: clean(getNested(line, ['model_id', 'modelId', 'sku_id', 'skuId', 'model.id', 'sku.id'])),
    sellerSku: clean(getNested(line, [
        'variation_sku', 'variationSku', 'seller_sku', 'sellerSku', 'sku_name', 'skuName', 'sku',
        'sellerSkuName', 'product_sku', 'productSku',
    ])),
});

const findMappedMerchantSkuForReturnLookup = async ({ companyId, store, line }) => {
    const { PlatformSkuMapping, MerchantSku } = require('../../models');
    const ids = getOrderLookupLineIds(line);
    const andConditions = [];
    if (ids.itemId) {
        andConditions.push({
            [Op.or]: [
                { platform_item_id: ids.itemId },
                { platform_listing_id: ids.itemId },
                { platform_product_id: ids.itemId },
            ],
        });
    }
    if (ids.modelId) {
        andConditions.push({
            [Op.or]: [
                { platform_model_id: ids.modelId },
                { platform_sku_id: ids.modelId },
            ],
        });
    }
    if (andConditions.length) {
        const mapping = await PlatformSkuMapping.findOne({
            where: {
                company_id: companyId,
                platform_store_id: store.id,
                is_active: true,
                [Op.and]: andConditions,
            },
            include: [{ model: MerchantSku, as: 'merchantSku', attributes: ['id', 'sku_name', 'sku_title', 'image_url'], required: false }],
            order: [['id', 'DESC']],
        });
        if (mapping?.merchant_sku_id) return mapping.merchantSku || { id: mapping.merchant_sku_id };
    }
    if (ids.sellerSku) {
        const sku = await MerchantSku.findOne({
            where: { company_id: companyId, sku_name: ids.sellerSku, deleted_at: null },
            attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
        });
        if (sku) return sku;
    }
    return null;
};

const normalizeManualLookupOrder = async ({ companyId, store, order }) => {
    const raw = order || {};
    const platform = store.platform;
    const orderNumber = clean(getNested(raw, ['order_sn', 'orderSn', 'order_id', 'orderId', 'id']));
    const buyer = getNested(raw, ['buyer', 'user', 'customer', 'recipient_address']) || {};
    const rawLines = toArray(
        getNested(raw, ['item_list', 'itemList', 'line_items', 'lineItems', 'items', 'skus', 'orderLineItems', 'order_line_items'])
    );
    const products = [];
    for (let index = 0; index < rawLines.length; index += 1) {
        const line = rawLines[index];
        const ids = getOrderLookupLineIds(line);
        const merchantSku = await findMappedMerchantSkuForReturnLookup({ companyId, store, line });
        const merchantPlain = merchantSku?.get ? merchantSku.get({ plain: true }) : merchantSku;
        const productName = clean(getNested(line, ['item_name', 'itemName', 'product_name', 'productName', 'name'])) || ids.sellerSku || `Item ${index + 1}`;
        const image = clean(firstArrayValue(getNested(line, ['image_info.image_url_list', 'images', 'image'])) || getNested(line, ['image_url', 'imageUrl', 'sku_image']));
        products.push({
            id: `lookup-${index + 1}-${ids.itemId || ids.modelId || ids.sellerSku || Date.now()}`,
            merchantSkuId: merchantPlain?.id ? String(merchantPlain.id) : '',
            sku: merchantPlain?.sku_name || ids.sellerSku || ids.modelId || ids.itemId || '',
            productName,
            image: image || merchantPlain?.image_url || '',
            quantity: Number.parseInt(getNested(line, ['model_quantity_purchased', 'quantity', 'qty', 'amount']) || 1, 10) || 1,
            platformItemId: ids.itemId,
            platformModelId: ids.modelId,
            returnLineItemId: clean(getNested(line, ['order_item_id', 'orderItemId', 'line_id', 'lineId'])) || [orderNumber, ids.itemId, ids.modelId, index + 1].filter(Boolean).join('-'),
            raw: line,
        });
    }
    return {
        platform,
        platformStoreId: String(store.id),
        storeName: getStoreDisplayName(store),
        orderNumber,
        platformOrderId: orderNumber,
        buyerUsername: clean(getNested(raw, ['buyer_username', 'buyerUsername', 'buyer.userName', 'buyer.username', 'user.username'])) || clean(getNested(buyer, ['name', 'full_name', 'username'])) || '',
        buyerEmail: clean(getNested(raw, ['buyer_email', 'buyerEmail', 'buyer.email', 'user.email'])) || clean(getNested(buyer, ['email'])) || '',
        refundCurrency: clean(getNested(raw, ['currency', 'payment.currency'])) || '',
        refundTotal: Number(getNested(raw, ['total_amount', 'totalAmount', 'payment.totalAmount']) || 0) || null,
        trackingNumber: clean(getNested(raw, ['tracking_number', 'trackingNumber', 'package_list.0.tracking_number'])) || '',
        logisticName: clean(getNested(raw, ['shipping_carrier', 'shippingCarrier', 'logistics_provider_name', 'logisticsProviderName'])) || '',
        platformCreatedAt: toDateFromPlatformTime(getNested(raw, ['create_time', 'createTime', 'created_time', 'createdTime'])),
        platformUpdatedAt: toDateFromPlatformTime(getNested(raw, ['update_time', 'updateTime', 'updated_time', 'updatedTime'])),
        products,
        raw,
    };
};

const lookupManualReturnOrder = async (user, data = {}) => {
    const companyId = getUserCompanyId(user);
    const platform = clean(data.platform).toLowerCase();
    const orderNumber = clean(data.orderNumber || data.order_number);
    const store = await getManualReturnStore(user, { platform, platformStoreId: data.platformStoreId || data.storeId });
    if (!orderNumber) {
        const err = new Error('orderNumber is required');
        err.statusCode = 400;
        throw err;
    }
    let response;
    if (platform === 'shopee') {
        const shopId = clean(store.store_shop_id || store.external_store_id);
        response = await axios.get(`${JAVA_API_BASE_URL}${SHOPEE_ORDER_DETAIL_PATH}`, {
            params: {
                shopId,
                orderSnList: orderNumber,
                request_order_status_pending: true,
                response_optional_fields: 'buyer_user_id,buyer_username,currency,total_amount,recipient_address,item_list,payment_method,cod,shipping_carrier,package_list,message_to_seller,note,pay_time,create_time,update_time,order_status',
            },
            timeout: 30000,
        });
        const order = response?.data?.response?.order_list?.[0] || response?.data?.data?.response?.order_list?.[0] || response?.data?.order_list?.[0];
        if (!order) {
            const err = new Error('Order details not found');
            err.statusCode = 404;
            throw err;
        }
        return normalizeManualLookupOrder({ companyId, store, order });
    }

    const openId = clean(store.store_open_id);
    const cipher = clean(store.store_cipher);
    response = await axios.get(`${JAVA_API_BASE_URL}${TIKTOK_ORDER_DETAIL_PATH}`, {
        params: { openId, orderIds: orderNumber, cipher },
        timeout: 30000,
    });
    const payload = response?.data?.data || response?.data?.body?.data || response?.data?.response || response?.data || {};
    const order = payload.order || payload.orders?.[0] || payload.order_list?.[0] || payload.orderList?.[0] || payload;
    if (!order || (!order.orderId && !order.order_id && !order.id)) {
        const err = new Error('Order details not found');
        err.statusCode = 404;
        throw err;
    }
    return normalizeManualLookupOrder({ companyId, store, order });
};

const createManualReturnOrder = async (user, data) => {
    const { ReturnOrder, ReturnOrderLine, MerchantSku, Warehouse } = require('../../models');
    const companyId = getUserCompanyId(user);
    const warehouseId = Number(data.warehouseId || data.warehouse_id);
    const platform = clean(data.platform).toLowerCase();
    const store = await getManualReturnStore(user, { platform, platformStoreId: data.platformStoreId || data.storeId });
    const orderNumber = clean(data.orderNumber || data.order_number);
    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (!warehouseId) {
        const err = new Error('warehouseId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!orderNumber) {
        const err = new Error('orderNumber is required');
        err.statusCode = 400;
        throw err;
    }
    if (!lines.length) {
        const err = new Error('At least one return item is required');
        err.statusCode = 400;
        throw err;
    }
    await assertWarehousePermission(user, warehouseId, { canEdit: true });
    const warehouse = await Warehouse.findOne({ where: { id: warehouseId, company_id: companyId, status: 'active' } });
    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    const merchantSkuIds = lines.map((line) => Number(line.merchantSkuId || line.merchant_sku_id)).filter(Boolean);
    if (!merchantSkuIds.length || merchantSkuIds.length !== lines.length) {
        const err = new Error('Every return item needs a merchantSkuId');
        err.statusCode = 400;
        throw err;
    }
    const skus = await MerchantSku.findAll({
        where: { id: { [Op.in]: merchantSkuIds }, company_id: companyId, deleted_at: null },
        attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
    });
    if (skus.length !== [...new Set(merchantSkuIds)].length) {
        const err = new Error('One or more return SKUs are invalid');
        err.statusCode = 400;
        throw err;
    }
    const skuMap = new Map(skus.map((sku) => [Number(sku.id), sku]));

    const created = await sequelize.transaction(async (transaction) => {
        const order = await ReturnOrder.create({
            company_id: companyId,
            platform,
            platform_store_id: store.id,
            platform_order_id: clean(data.platformOrderId || data.platform_order_id) || orderNumber,
            platform_return_id: clean(data.returnId || data.platformReturnId || data.platform_return_id) || `manual-${platform}-${store.id}-${orderNumber}-${Date.now()}`,
            order_number: orderNumber,
            platform_created_at: toDateFromPlatformTime(data.platformCreatedAt || data.platform_created_at) || new Date(),
            platform_updated_at: toDateFromPlatformTime(data.platformUpdatedAt || data.platform_updated_at) || new Date(),
            buyer_username: clean(data.buyerUsername || data.buyer_username) || null,
            buyer_email: clean(data.buyerEmail || data.buyer_email) || null,
            warehouse_package_no: clean(data.warehousePackageNo || data.warehouse_package_no) || orderNumber,
            warehouse_id: warehouseId,
            store_name: getStoreDisplayName(store),
            erp_return_status: 'need_to_check',
            platform_status_label: 'Need To Check',
            return_reason: clean(data.returnReason || data.return_reason) || null,
            return_reason_text: clean(data.returnReasonText || data.return_reason_text) || null,
            local_return_type: normalizeReturnType(data.returnType || data.localReturnType || 'by_logistic'),
            return_tracking_number: clean(data.trackingNumber || data.returnTrackingNo || data.return_tracking_number) || null,
            local_return_tracking_number: clean(data.localReturnTrackingNo || data.local_return_tracking_number) || null,
            logistic_name: clean(data.logisticName || data.logistic_name) || null,
            refund_currency: clean(data.refundCurrency || data.refund_currency) || null,
            refund_total: data.refundTotal !== undefined && data.refundTotal !== '' ? Number(data.refundTotal) || null : null,
            remark: clean(data.remark || data.notes) || null,
            is_manual: true,
            created_by: user.userId,
            raw_json: {
                ...(typeof data.raw === 'object' && data.raw ? data.raw : {}),
                orderNumber,
                warehousePackageNo: clean(data.warehousePackageNo || data.warehouse_package_no),
                platform,
                platformStoreId: store.id,
                createdFrom: 'erp_manual_return',
            },
        }, { transaction });

        await ReturnOrderLine.bulkCreate(lines.map((line) => {
            const skuId = Number(line.merchantSkuId || line.merchant_sku_id);
            const sku = skuMap.get(skuId);
            return {
                company_id: companyId,
                return_order_id: order.id,
                merchant_sku_id: skuId,
                return_line_item_id: clean(line.returnLineItemId || line.return_line_item_id) || `manual-${skuId}`,
                platform_sku_id: clean(line.platformModelId || line.platformSkuId || line.platform_sku_id) || null,
                order_line_item_id: clean(line.platformItemId || line.orderLineItemId || line.order_line_item_id) || null,
                seller_sku: clean(line.sku || line.skuName || sku?.sku_name) || null,
                sku_name: clean(line.sku || line.skuName || sku?.sku_name) || null,
                product_name: clean(line.productName || line.name || sku?.sku_title || sku?.sku_name) || 'Return product',
                product_image_url: clean(line.image || line.imageUrl || sku?.image_url) || null,
                quantity: toPositiveInt(line.quantity || line.qty, 'quantity'),
                raw_json: line,
            };
        }), { transaction });

        return order;
    });

    return getReturnOrderById(user, created.id);
};

const createReturnInbound = async ({ user, order, warehouseId, transaction }) => {
    const {
        InboundOrder,
        InboundOrderLine,
        SkuWarehouseStock,
        StockLedgerEntry,
    } = require('../../models');
    const companyId = getUserCompanyId(user);
    const plainOrder = order?.get ? order.get({ plain: true }) : order;
    const lines = (plainOrder.lines || []).filter((line) => line.merchant_sku_id && Number(line.quantity) > 0);
    if (!lines.length) {
        const err = new Error('No mapped merchant SKU lines found for resaleable return inbound');
        err.statusCode = 400;
        throw err;
    }

    const inboundId = await generateInboundId(companyId, transaction);
    const inbound = await InboundOrder.create({
        company_id: companyId,
        warehouse_id: warehouseId,
        inbound_id: inboundId,
        status: 'completed',
        is_manual: true,
        supplier_name: `Return ${plainOrder.platform || 'Order'}`,
        supplier_reference: plainOrder.order_number || plainOrder.platform_return_id || null,
        notes: `Return order ${plainOrder.order_number || plainOrder.platform_return_id || plainOrder.id} marked as resalable`,
        shipped_at: new Date(),
        arrived_at: new Date(),
        created_by: user.userId,
    }, { transaction });

    const affectedSkuIds = [];
    const platformAdjustmentItems = [];

    for (const line of lines) {
        const quantity = Number(line.quantity || 0);
        const [stockRecord] = await SkuWarehouseStock.findOrCreate({
            where: { merchant_sku_id: line.merchant_sku_id, warehouse_id: warehouseId },
            defaults: {
                company_id: companyId,
                merchant_sku_id: line.merchant_sku_id,
                warehouse_id: warehouseId,
                qty_on_hand: 0,
                qty_reserved: 0,
                qty_inbound: 0,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        const nextQty = Number(stockRecord.qty_on_hand || 0) + quantity;
        await stockRecord.update({ qty_on_hand: nextQty }, { transaction });

        await InboundOrderLine.create({
            company_id: companyId,
            inbound_order_id: inbound.id,
            merchant_sku_id: line.merchant_sku_id,
            qty_expected: quantity,
            qty_received: quantity,
            has_discrepancy: false,
        }, { transaction });

        await StockLedgerEntry.create({
            company_id: companyId,
            merchant_sku_id: line.merchant_sku_id,
            warehouse_id: warehouseId,
            sku_warehouse_stock_id: stockRecord.id,
            movement_type: 'return',
            quantity_delta: quantity,
            qty_on_hand_after: nextQty,
            reference_type: 'return_order',
            reference_id: String(plainOrder.id),
            notes: `Resalable return inbound for ${plainOrder.order_number || plainOrder.platform_return_id || plainOrder.id}`,
            created_by: user.userId,
        }, { transaction });

        affectedSkuIds.push(Number(line.merchant_sku_id));
        platformAdjustmentItems.push({
            merchantSkuId: Number(line.merchant_sku_id),
            warehouseId,
            quantityDelta: quantity,
            quantity,
        });
    }

    return { inbound, affectedSkuIds, platformAdjustmentItems };
};

const reverseReturnInbound = async ({ user, order, warehouseId, transaction }) => {
    const {
        SkuWarehouseStock,
        StockLedgerEntry,
    } = require('../../models');
    const companyId = getUserCompanyId(user);
    const plainOrder = order?.get ? order.get({ plain: true }) : order;
    const lines = (plainOrder.lines || []).filter((line) => line.merchant_sku_id && Number(line.quantity) > 0);
    if (!lines.length) {
        const err = new Error('No mapped merchant SKU lines found for resaleable return reversal');
        err.statusCode = 400;
        throw err;
    }

    const affectedSkuIds = [];
    const platformAdjustmentItems = [];

    for (const line of lines) {
        const quantity = Number(line.quantity || 0);
        const stockRecord = await SkuWarehouseStock.findOne({
            where: {
                company_id: companyId,
                merchant_sku_id: line.merchant_sku_id,
                warehouse_id: warehouseId,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        const currentQty = Number(stockRecord?.qty_on_hand || 0);
        if (!stockRecord || currentQty < quantity) {
            const err = new Error(`Insufficient warehouse stock to reverse resalable return for SKU ${line.seller_sku || line.merchant_sku_id}: available ${currentQty}, requested ${quantity}`);
            err.statusCode = 400;
            throw err;
        }

        const nextQty = currentQty - quantity;
        await stockRecord.update({ qty_on_hand: nextQty }, { transaction });

        await StockLedgerEntry.create({
            company_id: companyId,
            merchant_sku_id: line.merchant_sku_id,
            warehouse_id: warehouseId,
            sku_warehouse_stock_id: stockRecord.id,
            movement_type: 'return',
            quantity_delta: -quantity,
            qty_on_hand_after: nextQty,
            reference_type: 'return_order',
            reference_id: String(plainOrder.id),
            notes: `Resalable return reversal for ${plainOrder.order_number || plainOrder.platform_return_id || plainOrder.id}`,
            created_by: user.userId,
        }, { transaction });

        affectedSkuIds.push(Number(line.merchant_sku_id));
        platformAdjustmentItems.push({
            merchantSkuId: Number(line.merchant_sku_id),
            warehouseId,
            quantity,
            quantityDelta: -quantity,
        });
    }

    return { affectedSkuIds, platformAdjustmentItems };
};

const updateReturnStatus = async (user, id, data = {}) => {
    const { ReturnOrder } = require('../../models');
    const companyId = getUserCompanyId(user);
    const status = normalizeStatus(data.returnStatus || data.erpReturnStatus || data.status);
    const returnType = normalizeReturnType(data.returnType || data.localReturnType || 'by_logistic');
    const warehouseId = Number(data.warehouseId || data.warehouse_id);
    const trackingNumber = clean(data.localReturnTrackingNo || data.returnTrackingNo || data.local_return_tracking_number || data.trackingNumber);
    const logisticName = clean(data.logisticName || data.logistic_name);
    const remark = clean(data.remark || data.remarks || data.notes);

    if (!warehouseId) {
        const err = new Error('warehouseId is required');
        err.statusCode = 400;
        throw err;
    }
    await assertWarehousePermission(user, warehouseId, { canEdit: true });

    const result = await sequelize.transaction(async (transaction) => {
        const order = await ReturnOrder.findOne({
            where: { id, company_id: companyId, deleted_at: null },
            include: getReturnInclude(),
            lock: transaction.LOCK.UPDATE,
            transaction,
        });
        await assertReturnOrderAccess(user, order, { canEdit: true });

        const updateData = {
            warehouse_id: warehouseId,
            erp_return_status: status,
            local_return_type: returnType,
            local_return_tracking_number: trackingNumber || null,
            logistic_name: logisticName || null,
            remark: remark || null,
        };

        let inboundResult = null;
        let reverseResult = null;
        if (status === 'resalable_item' && !order.is_resaleable_inbounded) {
            inboundResult = await createReturnInbound({
                user,
                order,
                warehouseId,
                transaction,
            });
            updateData.is_resaleable_inbounded = true;
            updateData.resaleable_inbound_order_id = inboundResult.inbound.id;
        }
        if (status !== 'resalable_item' && order.is_resaleable_inbounded) {
            const reversalWarehouseId = Number(order.warehouse_id || warehouseId);
            await assertWarehousePermission(user, reversalWarehouseId, { canEdit: true });
            reverseResult = await reverseReturnInbound({
                user,
                order,
                warehouseId: reversalWarehouseId,
                transaction,
            });
            updateData.is_resaleable_inbounded = false;
            updateData.resaleable_inbound_order_id = null;
        }

        await order.update(updateData, { transaction });
        return { orderId: order.id, inboundResult, reverseResult };
    });

    const refreshed = await getReturnOrderById(user, result.orderId);

    if (result.inboundResult?.affectedSkuIds?.length) {
        await queueCombineRecompute(companyId, result.inboundResult.affectedSkuIds, warehouseId).catch((err) => {
            console.error('[returnOrders] combine recompute failed:', err.message);
        });

        const platformItems = result.inboundResult.platformAdjustmentItems;
        await Promise.all([
            platformOrderDeductionsService.pushManualOrderPlatformStockIncrease({ companyId, items: platformItems, platform: 'shopee' }),
            platformOrderDeductionsService.pushManualOrderPlatformStockIncrease({ companyId, items: platformItems, platform: 'tiktok' }),
        ]).catch((err) => {
            console.error('[returnOrders] platform stock increase failed:', err.message);
        });
    }

    if (result.reverseResult?.affectedSkuIds?.length) {
        const reversalWarehouseIds = [...new Set(result.reverseResult.platformAdjustmentItems.map((item) => item.warehouseId).filter(Boolean))];
        for (const affectedWarehouseId of reversalWarehouseIds) {
            await queueCombineRecompute(companyId, result.reverseResult.affectedSkuIds, affectedWarehouseId).catch((err) => {
                console.error('[returnOrders] combine recompute after return reversal failed:', err.message);
            });
        }

        const platformItems = result.reverseResult.platformAdjustmentItems;
        await Promise.all([
            platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({ companyId, items: platformItems, platform: 'shopee' }),
            platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({ companyId, items: platformItems, platform: 'tiktok' }),
        ]).catch((err) => {
            console.error('[returnOrders] platform stock reduction failed:', err.message);
        });
    }

    return refreshed;
};

const deleteReturnOrder = async (user, id, data = {}) => {
    const { ReturnOrder } = require('../../models');
    const order = await ReturnOrder.findOne({
        where: { id, company_id: getUserCompanyId(user), deleted_at: null },
        include: getReturnInclude(),
    });
    await assertReturnOrderAccess(user, order, { canEdit: true });

    if (order.is_resaleable_inbounded) {
        const err = new Error('Return order already created inbound stock and cannot be deleted');
        err.statusCode = 409;
        throw err;
    }

    const expected = clean(order.order_number || order.platform_return_id || String(order.id));
    const supplied = clean(data.orderNumber || data.order_number || data.confirmOrderNumber || data.confirm_order_number);
    if (expected && supplied !== expected) {
        const err = new Error('Please type the correct order number to confirm deletion');
        err.statusCode = 400;
        throw err;
    }

    await order.destroy();
    return { id: Number(id), deleted: true };
};

module.exports = {
    syncTikTokReturnOrders,
    syncShopeeReturnOrders,
    startShopeeReturnSyncJob,
    startTikTokReturnSyncJob,
    getShopeeReturnSyncJobStatus,
    getReturnSyncJobStatus,
    runScheduledShopeeReturnSync,
    runScheduledTikTokReturnSync,
    listReturnOrders,
    getReturnOrderById,
    lookupManualReturnOrder,
    createManualReturnOrder,
    updateReturnStatus,
    deleteReturnOrder,
};

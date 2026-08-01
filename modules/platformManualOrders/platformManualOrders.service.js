'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const platformOrderDeductionsService = require('../platformOrderDeductions/platformOrderDeductions.service');
const sellableSkuStock = require('../shared/sellableSkuStock');
const { applyWarehouseScope, assertWarehousePermission } = require('../../utils/permissions');

const STATUSES = new Set(['Processed', 'On The Way', 'Shipped', 'Delivered', 'Completed', 'Cancelled']);

const normalizeString = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
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

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseJsonField = (body, field, required = true) => {
    const value = body[field];
    if ((value === undefined || value === null || value === '') && !required) return field === 'products' ? [] : {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_err) {
        const err = new Error(`${field} must be valid JSON`);
        err.statusCode = 400;
        throw err;
    }
};

const hasBodyField = (body, field) => body[field] !== undefined && body[field] !== null && body[field] !== '';

const normalizeArrayQuery = (value) => {
    if (Array.isArray(value)) return value.flatMap((item) => normalizeArrayQuery(item));
    if (value === undefined || value === null || value === '') return [];
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const resolveCompanyId = (user, queryCompanyId = null) => {
    const userCompanyId = Number(user?.companyId);
    const requestedCompanyId = Number(queryCompanyId);
    if (Number.isInteger(userCompanyId) && userCompanyId > 0) {
        if (Number.isInteger(requestedCompanyId) && requestedCompanyId > 0 && requestedCompanyId !== userCompanyId) {
            const err = new Error('companyId does not match authenticated user company');
            err.statusCode = 403;
            throw err;
        }
        return userCompanyId;
    }
    if (Number.isInteger(requestedCompanyId) && requestedCompanyId > 0) return requestedCompanyId;
    const err = new Error('companyId is required');
    err.statusCode = 400;
    throw err;
};

const publicWaybillUrl = (file) => `/uploads/platform-manual-waybills/${file.filename}`;

const deleteUploadedFile = (urlOrPath) => {
    const value = normalizeString(urlOrPath);
    if (!value || !value.startsWith('/uploads/platform-manual-waybills/')) return;
    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || './uploads');
    const filename = path.basename(value);
    const target = path.join(uploadRoot, 'platform-manual-waybills', filename);
    fs.promises.unlink(target).catch(() => {});
};

const validateStatus = (status) => {
    const normalized = normalizeString(status);
    if (!STATUSES.has(normalized)) {
        const err = new Error(`shipmentStatus must be one of: ${[...STATUSES].join(', ')}`);
        err.statusCode = 400;
        throw err;
    }
    return normalized;
};

const validateOrderBasics = async ({ user, body, companyId, requireWaybill, file, existingOrder = null }) => {
    const { Warehouse } = require('../../models');
    const warehouseId = Number(body.warehouseId || body.warehouse_id || existingOrder?.warehouse_id);
    const orderNumber = normalizeString(body.orderNumber || body.order_number || existingOrder?.order_number);
    const orderTime = normalizeString(body.orderTime || body.order_time || existingOrder?.order_time);
    const orderDate = normalizeString(body.orderDate || body.order_date || existingOrder?.order_date);

    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
        const err = new Error('warehouseId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!orderNumber) {
        const err = new Error('orderNumber is required');
        err.statusCode = 400;
        throw err;
    }
    if (!orderTime) {
        const err = new Error('orderTime is required');
        err.statusCode = 400;
        throw err;
    }
    if (!orderDate) {
        const err = new Error('orderDate is required');
        err.statusCode = 400;
        throw err;
    }
    if (requireWaybill && !file) {
        const err = new Error('waybillFile is required');
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

    return { warehouseId, orderNumber, orderTime, orderDate };
};

const normalizeProduct = (product) => {
    const ref = sellableSkuStock.getLineSkuRef(product);
    const quantity = toPositiveInt(product.qty || product.quantity, 'product qty');
    return {
        ...ref,
        quantity,
        unitPrice: toNumber(product.unitPrice || product.unit_price),
        weight: toNumber(product.weight),
        name: normalizeString(product.name || product.productName),
        image: normalizeString(product.image || product.imageUrl),
    };
};

const applyStockDeduction = async ({ user, companyId, order, warehouseId, products, transaction }) => {
    const { MerchantSku, CombineSku, PlatformManualOrderItem, PlatformSkuMapping } = require('../../models');
    const affectedMerchantSkuIds = [];
    const platformStockDeductionItems = [];
    const createdItems = [];

    for (const rawProduct of products) {
        const product = normalizeProduct(rawProduct);
        const sku = product.kind === 'combine'
            ? await CombineSku.findOne({ where: { id: product.combineSkuId, company_id: companyId, warehouse_id: warehouseId, deleted_at: null, status: 'active' }, transaction })
            : await MerchantSku.findOne({ where: { id: product.merchantSkuId, company_id: companyId, deleted_at: null, status: 'active' }, transaction });
        if (!sku) {
            const err = new Error(`${product.kind === 'combine' ? 'Combine' : 'Merchant'} SKU not found`);
            err.statusCode = 404;
            throw err;
        }

        const deduction = await sellableSkuStock.deductSellableStock({
            user,
            companyId,
            line: rawProduct,
            warehouseId,
            quantity: product.quantity,
            referenceType: 'platform_manual_order',
            referenceId: order.order_number,
            notes: 'Platform manual order stock deduction',
            movementType: 'sale_deduction',
            transaction,
        });
        deduction.childDeductions.forEach((child) => affectedMerchantSkuIds.push(child.merchantSkuId));
        platformStockDeductionItems.push(deduction.platformDeduction);

        const item = await PlatformManualOrderItem.create({
            company_id: companyId,
            platform_manual_order_id: order.id,
            merchant_sku_id: product.kind === 'merchant' ? product.merchantSkuId : null,
            combine_sku_id: product.kind === 'combine' ? product.combineSkuId : null,
            warehouse_id: warehouseId,
            sku: product.kind === 'combine' ? sku.combine_sku_code : sku.sku_name,
            product_name: product.name || (product.kind === 'combine' ? sku.combine_name : sku.sku_title),
            quantity: product.quantity,
            unit_price: product.unitPrice,
            weight: product.weight || toNumber(sku.weight),
            qty_on_hand_before: deduction.childDeductions[0]?.qtyOnHandBefore ?? null,
            qty_on_hand_after: deduction.childDeductions[0]?.qtyOnHandAfter ?? null,
        }, { transaction });

        createdItems.push(item);
    }

    if (affectedMerchantSkuIds.length) {
        await PlatformSkuMapping.update(
            { sync_status: 'out_of_sync', sync_error: null },
            {
                where: {
                    company_id: companyId,
                    is_active: true,
                    merchant_sku_id: { [Op.in]: [...new Set(affectedMerchantSkuIds)] },
                },
                transaction,
            }
        );
    }

    return { createdItems, affectedMerchantSkuIds, platformStockDeductionItems };
};

const restoreExistingStock = async ({ user, companyId, order, transaction }) => {
    const { PlatformManualOrderItem, PlatformSkuMapping } = require('../../models');
    const items = await PlatformManualOrderItem.findAll({
        where: { company_id: companyId, platform_manual_order_id: order.id },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });
    const affectedMerchantSkuIds = [];
    const platformStockRestoreItems = [];

    for (const item of items) {
        const restored = await sellableSkuStock.restoreSellableStock({
            user,
            companyId,
            item,
            referenceType: 'platform_manual_order',
            referenceId: order.order_number,
            notes: 'Platform manual order stock restored',
            transaction,
        });
        restored.restored.forEach((child) => {
            affectedMerchantSkuIds.push(child.merchantSkuId);
            platformStockRestoreItems.push({
                merchantSkuId: child.merchantSkuId,
                warehouseId: child.warehouseId,
                quantityDelta: child.quantityDelta,
            });
        });
        if (restored.ref.kind === 'combine') {
            platformStockRestoreItems.push({ combineSkuId: restored.ref.combineSkuId, warehouseId: item.warehouse_id, quantityDelta: Number(item.quantity || 0) });
        }
    }

    if (affectedMerchantSkuIds.length) {
        await PlatformSkuMapping.update(
            { sync_status: 'out_of_sync', sync_error: null },
            { where: { company_id: companyId, is_active: true, merchant_sku_id: { [Op.in]: [...new Set(affectedMerchantSkuIds)] } }, transaction }
        );
    }

    await PlatformManualOrderItem.destroy({ where: { company_id: companyId, platform_manual_order_id: order.id }, transaction });
    return { affectedMerchantSkuIds, platformStockRestoreItems };
};
const syncPlatformStocks = async (companyId, items) => {
    if (!items.length) return null;
    const [shopee, tiktok] = await Promise.all([
        platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({ companyId, items, platform: 'shopee' }),
        platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({ companyId, items, platform: 'tiktok' }),
    ]);
    return {
        shopee,
        tiktok,
        total: Number(shopee?.total || 0) + Number(tiktok?.total || 0),
        synced: Number(shopee?.synced || 0) + Number(tiktok?.synced || 0),
        failed: Number(shopee?.failed || 0) + Number(tiktok?.failed || 0),
    };
};

const syncPlatformStockAdjustments = async (companyId, items) => {
    if (!items.length) return null;
    const [shopee, tiktok] = await Promise.all([
        platformOrderDeductionsService.pushManualOrderPlatformStockAdjustment({ companyId, items, platform: 'shopee' }),
        platformOrderDeductionsService.pushManualOrderPlatformStockAdjustment({ companyId, items, platform: 'tiktok' }),
    ]);
    return {
        shopee,
        tiktok,
        total: Number(shopee?.total || 0) + Number(tiktok?.total || 0),
        synced: Number(shopee?.synced || 0) + Number(tiktok?.synced || 0),
        failed: Number(shopee?.failed || 0) + Number(tiktok?.failed || 0),
    };
};

const toApiOrder = (order) => ({
    id: String(order.id),
    warehouseId: String(order.warehouse_id),
    orderNumber: order.order_number,
    orderTime: order.order_time,
    orderDate: order.order_date,
    waybillFileName: order.waybill_file_name,
    waybillUrl: order.waybill_url,
    shipmentStatus: order.shipment_status,
    logistic: order.logistic || {},
    sender: order.sender || {},
    buyer: order.buyer || {},
    products: (order.items || []).map((item) => ({
        id: String(item.combine_sku_id ? `combine:${item.combine_sku_id}` : item.merchant_sku_id),
        merchantSkuId: item.merchant_sku_id || null,
        combineSkuId: item.combine_sku_id || null,
        skuType: item.combine_sku_id ? 'combine' : 'merchant',
        sku: item.sku,
        name: item.product_name || '',
        qty: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        weight: Number(item.weight || 0),
    })),
    package: order.package_details || { weight: '', length: '', width: '', height: '' },
    createdAt: order.created_at,
    updatedAt: order.updated_at,
});

const getOrderForUser = async (user, id) => {
    const { PlatformManualOrder, PlatformManualOrderItem } = require('../../models');
    const companyId = resolveCompanyId(user);
    const order = await PlatformManualOrder.findOne({
        where: { id, company_id: companyId },
        include: [{ model: PlatformManualOrderItem, as: 'items' }],
    });
    if (!order) {
        const err = new Error('Platform manual order not found');
        err.statusCode = 404;
        throw err;
    }
    return order;
};

const listPlatformManualOrders = async (user, query = {}) => {
    const { PlatformManualOrder, PlatformManualOrderItem } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId);
    const page = Math.max(1, Number.parseInt(query.page || 1, 10));
    const limit = Math.max(1, Math.min(200, Number.parseInt(query.limit || 20, 10)));
    const where = { company_id: companyId };

    if (query.warehouseId) {
        await assertWarehousePermission(user, query.warehouseId);
        where.warehouse_id = Number(query.warehouseId);
    } else {
        Object.assign(where, await applyWarehouseScope(user, {}, 'warehouse_id'));
    }

    const statuses = normalizeArrayQuery(query.statuses).map(validateStatus);
    if (statuses.length) where.shipment_status = { [Op.in]: statuses };

    const include = [{ model: PlatformManualOrderItem, as: 'items' }];
    const searchValues = normalizeArrayQuery(query.searchValues);
    if (searchValues.length) {
        const searchField = normalizeString(query.searchField);
        if (searchField === 'Order Number') {
            where[Op.or] = searchValues.map((value) => ({ order_number: { [Op.like]: `%${value}%` } }));
        } else if (searchField === 'SKU') {
            include[0].where = { sku: { [Op.in]: searchValues } };
            include[0].required = true;
        }
    }

    const { count, rows } = await PlatformManualOrder.findAndCountAll({
        where,
        include,
        order: [['created_at', 'DESC']],
        distinct: true,
        limit,
        offset: (page - 1) * limit,
    });

    return { orders: rows.map(toApiOrder), total: count };
};

const createPlatformManualOrder = async (user, body = {}, file = null) => {
    const { PlatformManualOrder } = require('../../models');
    const companyId = resolveCompanyId(user);
    const products = parseJsonField(body, 'products');
    if (!Array.isArray(products) || products.length < 1) {
        const err = new Error('products must be a non-empty array');
        err.statusCode = 400;
        throw err;
    }
    const payload = await validateOrderBasics({ user, body, companyId, requireWaybill: true, file });
    const logistic = parseJsonField(body, 'logistic');
    const sender = parseJsonField(body, 'sender');
    const buyer = parseJsonField(body, 'buyer');
    const packageDetails = parseJsonField(body, 'package', false);
    let createdOrder;
    let platformStockItems = [];

    await sequelize.transaction(async (transaction) => {
        createdOrder = await PlatformManualOrder.create({
            company_id: companyId,
            warehouse_id: payload.warehouseId,
            order_number: payload.orderNumber,
            order_time: payload.orderTime,
            order_date: payload.orderDate,
            waybill_file_name: file.originalname || file.filename,
            waybill_url: publicWaybillUrl(file),
            shipment_status: 'Processed',
            logistic,
            sender,
            buyer,
            package_details: packageDetails,
            created_by: user.userId || user.id || null,
        }, { transaction });

        const deduction = await applyStockDeduction({
            user,
            companyId,
            order: createdOrder,
            warehouseId: payload.warehouseId,
            products,
            transaction,
        });
        platformStockItems = deduction.platformStockDeductionItems;
    });

    let platformStockSync = null;
    let platformStockSyncError = null;
    try {
        platformStockSync = await syncPlatformStocks(companyId, platformStockItems);
    } catch (err) {
        platformStockSyncError = err.message || 'Platform stock sync failed';
    }

    const order = await getOrderForUser(user, createdOrder.id);
    return { order: toApiOrder(order), platformStockSync, platformStockSyncError };
};

const updatePlatformManualOrder = async (user, id, body = {}, file = null) => {
    const { PlatformManualOrder } = require('../../models');
    const companyId = resolveCompanyId(user);
    const existing = await getOrderForUser(user, id);
    const payload = await validateOrderBasics({
        user,
        body: {
            ...body,
            warehouseId: existing.warehouse_id,
            warehouse_id: existing.warehouse_id,
        },
        companyId,
        requireWaybill: false,
        file,
        existingOrder: existing,
    });
    const oldWaybillUrl = existing.waybill_url;

    await sequelize.transaction(async (transaction) => {
        await PlatformManualOrder.update({
            warehouse_id: existing.warehouse_id,
            order_number: payload.orderNumber,
            order_time: payload.orderTime,
            order_date: payload.orderDate,
            ...(file ? { waybill_file_name: file.originalname || file.filename, waybill_url: publicWaybillUrl(file) } : {}),
            ...(hasBodyField(body, 'logistic') ? { logistic: parseJsonField(body, 'logistic') } : {}),
            sender: existing.sender,
            ...(hasBodyField(body, 'buyer') ? { buyer: parseJsonField(body, 'buyer') } : {}),
            ...(hasBodyField(body, 'package') ? { package_details: parseJsonField(body, 'package', false) } : {}),
        }, { where: { id: existing.id, company_id: companyId }, transaction });
    });

    if (file) deleteUploadedFile(oldWaybillUrl);

    const order = await getOrderForUser(user, id);
    return { order: toApiOrder(order), platformStockSync: null, platformStockSyncError: null };
};

const updatePlatformManualOrderStatus = async (user, id, body = {}) => {
    const order = await getOrderForUser(user, id);
    const shipmentStatus = validateStatus(body.shipmentStatus || body.shipment_status);
    await order.update({ shipment_status: shipmentStatus });
    const updated = await getOrderForUser(user, id);
    return toApiOrder(updated);
};

const deletePlatformManualOrder = async (user, id) => {
    const companyId = resolveCompanyId(user);
    const order = await getOrderForUser(user, id);
    const waybillUrl = order.waybill_url;
    let platformStockRestoreItems = [];
    await sequelize.transaction(async (transaction) => {
        const restore = await restoreExistingStock({ user, companyId, order, transaction });
        platformStockRestoreItems = restore.platformStockRestoreItems;
        await order.destroy({ transaction });
    });
    try {
        await syncPlatformStockAdjustments(companyId, platformStockRestoreItems);
    } catch (_err) {
        // Deletion should not be blocked after local stock/order cleanup.
    }
    deleteUploadedFile(waybillUrl);
    return { deleted: true };
};

const listCompanyWarehouses = async (user, query = {}) => {
    const { Warehouse } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId);
    const rows = await Warehouse.findAll({
        where: await applyWarehouseScope(user, { company_id: companyId, status: 'active' }),
        attributes: ['id', 'name', 'code'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });
    return rows.map((warehouse) => ({
        id: warehouse.code || String(warehouse.id),
        name: warehouse.name,
        code: warehouse.code,
        warehouseId: String(warehouse.id),
    }));
};

const listWarehouseMerchantSkus = async (user, warehouseId, query = {}) => {
    const { MerchantSku, CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId);
    const search = normalizeString(query.search);
    const warehouseNumericId = Number(warehouseId);
    const warehouseWhere = Number.isInteger(warehouseNumericId) ? { id: warehouseNumericId } : { code: warehouseId };
    const { Warehouse } = require('../../models');
    const warehouse = await Warehouse.findOne({ where: { ...warehouseWhere, company_id: companyId, status: 'active' } });
    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }
    await assertWarehousePermission(user, warehouse.id);

    const skuWhere = { company_id: companyId, deleted_at: null, status: 'active' };
    const combineWhere = { company_id: companyId, deleted_at: null, status: 'active', warehouse_id: warehouse.id };
    if (search) {
        skuWhere[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
        combineWhere[Op.or] = [
            { combine_sku_code: { [Op.like]: `%${search}%` } },
            { combine_name: { [Op.like]: `%${search}%` } },
        ];
    }

    const [merchantRows, combineRows] = await Promise.all([
        MerchantSku.findAll({
            where: skuWhere,
            include: [{
                model: SkuWarehouseStock,
                as: 'stock',
                where: { company_id: companyId, warehouse_id: warehouse.id },
                required: true,
                attributes: ['qty_on_hand', 'qty_reserved'],
            }],
            order: [['sku_name', 'ASC']],
            limit: 100,
        }),
        CombineSku.findAll({
            where: combineWhere,
            attributes: ['id', 'combine_sku_code', 'combine_name', 'image_url', 'selling_price', 'weight'],
            include: [{
                model: CombineSkuItem,
                as: 'items',
                attributes: ['id', 'merchant_sku_id'],
                required: false,
                include: [{
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'image_url'],
                    required: false,
                }],
            }],
            order: [['combine_sku_code', 'ASC']],
            limit: 100,
        }),
    ]);

    const merchants = merchantRows.map((sku) => {
        const stockRows = Array.isArray(sku.stock) ? sku.stock : [];
        const available = stockRows.reduce((sum, stock) => sum + Math.max(0, Number(stock.qty_on_hand || 0) - Number(stock.qty_reserved || 0)), 0);
        return {
            id: `merchant:${sku.id}`,
            merchantSkuId: String(sku.id),
            skuType: 'merchant',
            sku: sku.sku_name,
            name: sku.sku_title,
            image: sku.image_url || '',
            availableForPlatform: available,
            unitPrice: Number(sku.price || 0),
            weight: Number(sku.weight || 0),
        };
    });

    const combines = await Promise.all(combineRows.map(async (sku) => {
        const availability = await sellableSkuStock.getCombineAvailability({ companyId, combineSkuId: sku.id, warehouseId: warehouse.id });
        const firstItem = Array.isArray(sku.items) ? sku.items.find((item) => item?.merchantSku?.image_url) : null;
        return {
            id: `combine:${sku.id}`,
            combineSkuId: String(sku.id),
            skuType: 'combine',
            sku: sku.combine_sku_code,
            name: sku.combine_name,
            image: sku.image_url || firstItem?.merchantSku?.image_url || '',
            warehouseName: warehouse.name,
            availableForPlatform: Number(availability?.available || 0),
            unitPrice: Number(sku.selling_price || 0),
            weight: Number(sku.weight || 0),
        };
    }));

    return [...merchants, ...combines];
};
module.exports = {
    listPlatformManualOrders,
    createPlatformManualOrder,
    updatePlatformManualOrder,
    updatePlatformManualOrderStatus,
    deletePlatformManualOrder,
    listCompanyWarehouses,
    listWarehouseMerchantSkus,
};




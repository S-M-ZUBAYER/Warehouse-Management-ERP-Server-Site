'use strict';

/**
 * inventory.service.js
 *
 * Serves the Inventory List page.
 * All functions read from sku_warehouse_stock joined with merchant_skus
 * and platform_sku_mappings to produce the combined "inventory view".
 *
 * Endpoints covered:
 *   GET  /api/v1/inventory            → getInventoryList
 *   GET  /api/v1/inventory/counts     → getInventoryCounts
 *   PUT  /api/v1/inventory/stock-alert → setStockAlert
 *   PUT  /api/v1/inventory/sync       → syncInventory
 */

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:inventory${suffix ? ':' + suffix : ''}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive stock alert status from qty_on_hand vs min_stock.
 * Returns: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'No Alert'
 */
const deriveAlertStatus = (qtyOnHand, minStock) => {
    if (minStock === null || minStock === undefined) return 'No Alert';
    if (qtyOnHand === 0) return 'Out of Stock';
    if (qtyOnHand <= minStock) return 'Low Stock';
    return 'In Stock';
};

/**
 * Build the search WHERE clause based on skuType.
 * skuType: 'sku_name' | 'product_name' | 'gtin' | 'store_id'
 */
const buildSearchWhere = (search, skuType) => {
    if (!search || !search.trim()) return null;
    const q = `%${search.trim()}%`;

    switch (skuType) {
        case 'product_name': return { '$merchantSku.sku_title$': { [Op.like]: q } };
        case 'gtin': return { '$merchantSku.gtin$': { [Op.like]: q } };
        // store_id searches platform_sku_mappings external_store_id
        case 'store_id': return { '$mapping.platform_store_id$': { [Op.like]: q } };
        case 'sku_name':
        default: return { '$merchantSku.sku_name$': { [Op.like]: q } };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/inventory
//    Paginated inventory list — joins stock + merchant SKU + mapping status
// ─────────────────────────────────────────────────────────────────────────────
const getInventoryList = async (user, filters = {}) => {
    const {
        SkuWarehouseStock,
        MerchantSku,
        Warehouse,
        PlatformSkuMapping,
    } = require('../../models');

    const {
        page = 1,
        limit = 20,
        warehouseId,
        search,
        skuType = 'sku_name',
        mappingStatus = 'all',   // all | mapped | unmapped
        sortBy = 'created_at',
        sortOrder = 'DESC',
    } = filters;

    // ── Build WHERE for SkuWarehouseStock ──────────────────────────────────
    const stockWhere = { company_id: user.companyId };
    if (warehouseId && warehouseId !== 'all') {
        stockWhere.warehouse_id = parseInt(warehouseId, 10);
    }

    // ── Merchant SKU include (always required join) ─────────────────────────
    const merchantSkuWhere = { deleted_at: null };
    const searchWhere = buildSearchWhere(search, skuType);

    // Merge search into merchant SKU where if it targets a merchant_skus field
    if (searchWhere && !searchWhere['$mapping.platform_store_id$']) {
        // sku_name / product_name / gtin live on merchant_skus
        const field = Object.keys(searchWhere)[0].replace('$merchantSku.', '').replace('$', '');
        merchantSkuWhere[field] = searchWhere[Object.keys(searchWhere)[0]];
    }

    // ── Mapping include (LEFT JOIN — determines mapped/unmapped) ───────────
    const mappingInclude = {
        model: PlatformSkuMapping,
        as: 'platformMappings',
        attributes: ['id', 'platform_store_id', 'sync_status', 'is_active', 'last_synced_at'],
        required: false,  // LEFT JOIN
        where: { is_active: true, deleted_at: null },
    };

    // mappingStatus filter: mapped = must have at least one mapping row
    //                       unmapped = no mapping rows
    if (mappingStatus === 'mapped') {
        mappingInclude.required = true;   // converts to INNER JOIN → only mapped
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await SkuWarehouseStock.findAndCountAll({
        where: stockWhere,
        include: [
            {
                model: MerchantSku,
                as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title', 'gtin', 'image_url', 'status', 'price'],
                where: merchantSkuWhere,
                required: true,        // INNER JOIN — skip orphaned stock records
                include: [mappingInclude],
            },
            {
                model: Warehouse,
                as: 'warehouse',
                attributes: ['id', 'name', 'code'],
                required: false,
            },
        ],
        order: [[sortBy === 'sku_name' ? [{ model: MerchantSku, as: 'merchantSku' }, 'sku_name', sortOrder === 'ASC' ? 'ASC' : 'DESC'] : [sortBy === 'qty_on_hand' ? 'qty_on_hand' : 'created_at', sortOrder === 'ASC' ? 'ASC' : 'DESC']]],
        limit: parseInt(limit, 10),
        offset,
        distinct: true,
        subQuery: false,
    });

    // ── Post-process: filter unmapped if needed, derive alert status ────────
    let rows_ = rows;
    if (mappingStatus === 'unmapped') {
        rows_ = rows.filter((r) => !r.merchantSku?.platformMappings?.length);
    }

    const data = rows_.map((record) => {
        const mappings = record.merchantSku?.platformMappings ?? [];
        const isMapped = mappings.length > 0;
        const alertStatus = deriveAlertStatus(record.qty_on_hand, record.min_stock);

        return {
            id: record.id,
            // Stock numbers
            qty_on_hand: record.qty_on_hand,
            qty_reserved: record.qty_reserved,
            qty_inbound: record.qty_inbound,
            min_stock: record.min_stock,
            // Derived
            stock_alert_status: alertStatus,
            qty_available: Math.max(0, (record.qty_on_hand || 0) - (record.qty_reserved || 0)),
            // Merchant SKU
            merchantSku: {
                id: record.merchantSku?.id,
                sku_name: record.merchantSku?.sku_name,
                sku_title: record.merchantSku?.sku_title,
                gtin: record.merchantSku?.gtin,
                image_url: record.merchantSku?.image_url,
                status: record.merchantSku?.status,
                price: record.merchantSku?.price,
            },
            // Warehouse
            warehouse: record.warehouse
                ? { id: record.warehouse.id, name: record.warehouse.name, code: record.warehouse.code }
                : null,
            // Mapping info
            is_mapped: isMapped,
            mapping_count: mappings.length,
            mappings: mappings.map((m) => ({
                id: m.id,
                sync_status: m.sync_status,
                is_active: m.is_active,
                last_synced_at: m.last_synced_at,
            })),
        };
    });

    return {
        data,
        pagination: {
            total: count,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalPages: Math.ceil(count / parseInt(limit, 10)),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/inventory/counts
//    Returns { all, mapped, unmapped } for the tab badges.
//    Uses raw SQL for performance (single query, no N+1).
// ─────────────────────────────────────────────────────────────────────────────
const getInventoryCounts = async (user, filters = {}) => {
    const { warehouseId } = filters;

    const warehouseClause = warehouseId && warehouseId !== 'all'
        ? `AND sws.warehouse_id = :warehouseId`
        : '';

    const [results] = await sequelize.query(
        `SELECT
             COUNT(DISTINCT sws.id)                                           AS \`all\`,
             COUNT(DISTINCT CASE WHEN psm.id IS NOT NULL THEN sws.id END)     AS mapped,
             COUNT(DISTINCT CASE WHEN psm.id IS NULL     THEN sws.id END)     AS unmapped
         FROM sku_warehouse_stock sws
         INNER JOIN merchant_skus ms
             ON ms.id = sws.merchant_sku_id
             AND ms.deleted_at IS NULL
         LEFT JOIN platform_sku_mappings psm
             ON psm.merchant_sku_id = ms.id
             AND psm.is_active      = 1
             AND psm.deleted_at     IS NULL
         WHERE sws.company_id = :companyId
         ${warehouseClause}`,
        {
            replacements: {
                companyId: user.companyId,
                warehouseId: warehouseId ? parseInt(warehouseId, 10) : null,
            },
            type: sequelize.QueryTypes.SELECT,
        }
    );

    return {
        all: parseInt(results?.all ?? 0, 10),
        mapped: parseInt(results?.mapped ?? 0, 10),
        unmapped: parseInt(results?.unmapped ?? 0, 10),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUT /api/v1/inventory/stock-alert
//    Sets min_stock threshold on sku_warehouse_stock rows for selected SKUs.
//    Body: { skuIds: [1, 2, 3], minStock: 10 }
//    skuIds here are sku_warehouse_stock IDs (the inventory row IDs).
// ─────────────────────────────────────────────────────────────────────────────
const setStockAlert = async (user, data) => {
    const { SkuWarehouseStock, MerchantSku } = require('../../models');

    const { skuIds, minStock } = data;
    console.log(skuIds, minStock, "lksjfalasdjdlkjflaksjdfkjaskljfadjslfjalsdjflajsdflkajsdjfklj");

    if (!Array.isArray(skuIds) || skuIds.length === 0) {
        const err = new Error('skuIds array is required');
        err.statusCode = 400;
        throw err;
    }

    const parsedMin = parseInt(minStock, 10);
    if (isNaN(parsedMin) || parsedMin < 0) {
        const err = new Error('minStock must be a non-negative integer');
        err.statusCode = 400;
        throw err;
    }

    // Verify all records belong to this company
    const records = await SkuWarehouseStock.findAll({
        where: {
            id: { [Op.in]: skuIds },
            company_id: user.companyId,
        },
        attributes: ['id'],
    });

    if (records.length !== skuIds.length) {
        const err = new Error('One or more inventory records not found');
        err.statusCode = 404;
        throw err;
    }

    // Bulk update min_stock
    const [affectedRows] = await SkuWarehouseStock.update(
        { min_stock: parsedMin },
        {
            where: {
                id: { [Op.in]: skuIds },
                company_id: user.companyId,
            },
        }
    );

    // Flush inventory cache so next list fetch reflects new alert status
    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return {
        updated: affectedRows,
        minStock: parsedMin,
        message: `Stock alert set to ${parsedMin} for ${affectedRows} SKU(s)`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUT /api/v1/inventory/sync
//    Marks platform_sku_mappings as 'out_of_sync' for selected inventory rows.
//    Java picks them up from GET /pending-sync and pushes to platform.
//    Body: { skuIds: [] }  ← empty array = sync ALL mapped SKUs for this company
// ─────────────────────────────────────────────────────────────────────────────
// const syncInventory = async (user, data) => {
//     const { SkuWarehouseStock, PlatformSkuMapping } = require('../../models');

//     const { skuIds = [] } = data;

//     let merchantSkuIds = [];

//     if (skuIds.length > 0) {
//         // skuIds are sku_warehouse_stock IDs → resolve to merchant_sku_ids
//         const stockRecords = await SkuWarehouseStock.findAll({
//             where: {
//                 id: { [Op.in]: skuIds },
//                 company_id: user.companyId,
//             },
//             attributes: ['merchant_sku_id'],
//             raw: true,
//         });
// console.log(stockRecords.length,'stockRecord.length');

//         if (!stockRecords.length) {
//             const err = new Error('No matching inventory records found');
//             err.statusCode = 404;
//             throw err;
//         }

//         merchantSkuIds = [...new Set(stockRecords.map((r) => r.merchant_sku_id))];
//     }
//     // If skuIds empty → merchantSkuIds stays [] → WHERE clause below syncs ALL

//     // Build WHERE for platform_sku_mappings
//     const mappingWhere = {
//         company_id: user.companyId,
//         is_active: true,
//         deleted_at: null,
//         // Only already-synced mappings can become out_of_sync
//         // (pending/failed ones are already in the Java queue)
//         sync_status: { [Op.in]: ['synced', 'out_of_sync'] },
//     };
// console.log(merchantSkuIds.length,"merchantSkuIds.length");

//     if (merchantSkuIds.length > 0) {
//         mappingWhere.merchant_sku_id = { [Op.in]: merchantSkuIds };
//     }

//     const [affectedRows] = await PlatformSkuMapping.update(
//         { sync_status: 'out_of_sync' },
//         { where: mappingWhere }
//     );

//     // Flush cache
//     await redis.flushByPattern(cacheKey(user.companyId, '*'));
//     await redis.flushByPattern(`company:${user.companyId}:cache:platform_sku_mappings*`);
//     console.log(affectedRows,"affectedRows");
    

//     return {
//         queued: affectedRows,
//         message: affectedRows > 0
//             ? `${affectedRows} mapping(s) queued for sync — Java will push to platforms on next poll`
//             : 'No eligible synced mappings found for the selected SKUs',
//     };
// };
const syncInventory = async (user, data) => {
    const { SkuWarehouseStock, PlatformSkuMapping } = require('../../models');
    const { skuIds = [] } = data;

    let merchantSkuIds = [];

    if (skuIds.length > 0) {
        const stockRecords = await SkuWarehouseStock.findAll({
            where: {
                id: { [Op.in]: skuIds },
                company_id: user.companyId,
            },
            attributes: ['merchant_sku_id'],
            raw: true,
        });


        if (!stockRecords.length) {
            const err = new Error('No matching inventory records found');
            err.statusCode = 404;
            throw err;
        }

        merchantSkuIds = [...new Set(stockRecords.map((r) => r.merchant_sku_id))];
    }


    // ✅ Build WHERE — let paranoid handle deleted_at, don't add it manually
    const mappingWhere = {
        company_id: user.companyId,
        is_active: true,
        // ✅ Include ALL statuses that should be re-queued
        // 'pending'  → never pushed yet, still valid to re-trigger
        // 'failed'   → previous attempt failed, retry makes sense
        // 'synced'   → previously synced, stock changed, needs re-push
        // 'out_of_sync' → already marked, re-marking is safe (idempotent)
        sync_status: { [Op.in]: ['pending', 'synced', 'failed', 'out_of_sync'] },
    };

    if (merchantSkuIds.length > 0) {
        mappingWhere.merchant_sku_id = { [Op.in]: merchantSkuIds };
    }

    // ✅ paranoid: true on the model means Sequelize auto-adds deleted_at IS NULL
    // DO NOT add deleted_at manually — it conflicts with paranoid behaviour
    const [affectedRows] = await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync' },
        {
            where: mappingWhere,
            // ✅ paranoid handles soft-delete filtering automatically
        }
    );

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    await redis.flushByPattern(`company:${user.companyId}:cache:platform_sku_mappings*`);

    return {
        queued: affectedRows,
        message: affectedRows > 0
            ? `${affectedRows} mapping(s) queued for sync — Java will push to platforms on next poll`
            : 'No eligible active mappings found for the selected SKUs',
    };
};


// ─────────────────────────────────────────────────────────────────────────────
// Dropdown helper — warehouses (reuses same query as merchant SKUs)
// ─────────────────────────────────────────────────────────────────────────────
const getInventoryDropdowns = async (user) => {
    const { Warehouse } = require('../../models');

    const warehouses = await Warehouse.findAll({
        where: { company_id: user.companyId, status: 'active' },
        attributes: ['id', 'name', 'code', 'is_default'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });

    return { warehouses };
};

module.exports = {
    getInventoryList,
    getInventoryCounts,
    setStockAlert,
    syncInventory,
    getInventoryDropdowns,
};

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
const { default: axios } = require('axios');
const { applyWarehouseScope, assertWarehousePermission, getPermittedWarehouseIds } = require('../../utils/permissions');

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
        await assertWarehousePermission(user, warehouseId);
        stockWhere.warehouse_id = parseInt(warehouseId, 10);
    } else {
        Object.assign(stockWhere, await applyWarehouseScope(user, {}, 'warehouse_id'));
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
    attributes: [
        'id',
        'platform_store_id',
        'merchant_sku_id',
        'combine_sku_id',
        'fulfillment_warehouse_id',
        'platform_sku_id',
        'platform_listing_id',
        'platform_model_id',
        'platform_shop_id',
        'platform_open_id',
        'platform_cipher_id',
        'platform_product_id',
        'platform_warehouse_id',
        'platform_item_id',
        'platform_location_id',
        'sync_status',
        'is_active',
        'last_synced_at',
    ],
    required: false,
    where: { is_active: true, deleted_at: null },
};

    // mappingStatus filter: mapped = must have at least one mapping row
    //                       unmapped = no mapping rows
    if (mappingStatus === 'mapped') {
        mappingInclude.required = true;   // converts to INNER JOIN → only mapped
    }

    const activeMappingWhere = {
        company_id: user.companyId,
        is_active: true,
        deleted_at: null,
        merchant_sku_id: { [Op.ne]: null },
    };

    if (searchWhere && searchWhere['$mapping.platform_store_id$']) {
        activeMappingWhere.platform_store_id = searchWhere['$mapping.platform_store_id$'];
    }

    if (mappingStatus !== 'all' || activeMappingWhere.platform_store_id) {
        const mappedRows = await PlatformSkuMapping.findAll({
            where: activeMappingWhere,
            attributes: ['merchant_sku_id'],
            raw: true,
        });
        const mappedMerchantSkuIds = [...new Set(mappedRows.map((row) => row.merchant_sku_id).filter(Boolean))];

        if (mappingStatus === 'mapped' || activeMappingWhere.platform_store_id) {
            stockWhere.merchant_sku_id = { [Op.in]: mappedMerchantSkuIds.length ? mappedMerchantSkuIds : [-1] };
        } else if (mappingStatus === 'unmapped' && mappedMerchantSkuIds.length) {
            stockWhere.merchant_sku_id = { [Op.notIn]: mappedMerchantSkuIds };
        }
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
    });

    // ── Post-process: filter unmapped if needed, derive alert status ────────
    const merchantSkuIds = [...new Set(rows.map((record) => record.merchantSku?.id).filter(Boolean))];
    const mappingsByMerchantSkuId = new Map();

    if (merchantSkuIds.length) {
        const mappings = await PlatformSkuMapping.findAll({
            where: {
                company_id: user.companyId,
                is_active: true,
                deleted_at: null,
                merchant_sku_id: { [Op.in]: merchantSkuIds },
            },
            attributes: [
                'id',
                'platform_store_id',
                'merchant_sku_id',
                'combine_sku_id',
                'fulfillment_warehouse_id',
                'platform_sku_id',
                'platform_listing_id',
                'platform_model_id',
                'platform_shop_id',
                'platform_open_id',
                'platform_cipher_id',
                'platform_product_id',
                'platform_warehouse_id',
                'platform_item_id',
                'platform_location_id',
                'sync_status',
                'is_active',
                'last_synced_at',
            ],
            order: [['id', 'ASC']],
            raw: true,
        });

        mappings.forEach((mapping) => {
            const current = mappingsByMerchantSkuId.get(mapping.merchant_sku_id) ?? [];
            current.push(mapping);
            mappingsByMerchantSkuId.set(mapping.merchant_sku_id, current);
        });
    }

    const data = rows.map((record) => {
        const mappings = mappingsByMerchantSkuId.get(record.merchantSku?.id) ?? [];
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
    merchant_sku_id: m.merchant_sku_id,
    combine_sku_id: m.combine_sku_id,
    fulfillment_warehouse_id: m.fulfillment_warehouse_id,
    platform_sku_id: m.platform_sku_id,
    platform_listing_id: m.platform_listing_id,
    platform_model_id: m.platform_model_id,
    platform_shop_id: m.platform_shop_id,
    platform_open_id: m.platform_open_id,
    platform_cipher_id: m.platform_cipher_id,
    platform_product_id: m.platform_product_id,
    platform_warehouse_id: m.platform_warehouse_id,
    platform_item_id: m.platform_item_id,
    platform_location_id: m.platform_location_id,
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

    let warehouseClause = '';
    let scopedWarehouseIds = null;
    if (warehouseId && warehouseId !== 'all') {
        await assertWarehousePermission(user, warehouseId);
        warehouseClause = `AND sws.warehouse_id = :warehouseId`;
    } else {
        scopedWarehouseIds = await getPermittedWarehouseIds(user);
        if (scopedWarehouseIds !== null) {
            warehouseClause = scopedWarehouseIds.length
                ? `AND sws.warehouse_id IN (:scopedWarehouseIds)`
                : `AND 1 = 0`;
        }
    }

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
                scopedWarehouseIds,
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

//previous
// const syncInventory = async (user, data) => {
//     const { SkuWarehouseStock, PlatformSkuMapping } = require('../../models');
//     const { skuIds = [] } = data;

//     let merchantSkuIds = [];

//     if (skuIds.length > 0) {
//         const stockRecords = await SkuWarehouseStock.findAll({
//             where: {
//                 id: { [Op.in]: skuIds },
//                 company_id: user.companyId,
//             },
//             attributes: ['merchant_sku_id'],
//             raw: true,
//         });


//         if (!stockRecords.length) {
//             const err = new Error('No matching inventory records found');
//             err.statusCode = 404;
//             throw err;
//         }

//         merchantSkuIds = [...new Set(stockRecords.map((r) => r.merchant_sku_id))];
//     }


//     // ✅ Build WHERE — let paranoid handle deleted_at, don't add it manually
//     const mappingWhere = {
//         company_id: user.companyId,
//         is_active: true,
//         // ✅ Include ALL statuses that should be re-queued
//         // 'pending'  → never pushed yet, still valid to re-trigger
//         // 'failed'   → previous attempt failed, retry makes sense
//         // 'synced'   → previously synced, stock changed, needs re-push
//         // 'out_of_sync' → already marked, re-marking is safe (idempotent)
//         sync_status: { [Op.in]: ['pending', 'synced', 'failed', 'out_of_sync'] },
//     };

//     if (merchantSkuIds.length > 0) {
//         mappingWhere.merchant_sku_id = { [Op.in]: merchantSkuIds };
//     }

//     // ✅ paranoid: true on the model means Sequelize auto-adds deleted_at IS NULL
//     // DO NOT add deleted_at manually — it conflicts with paranoid behaviour
//     const [affectedRows] = await PlatformSkuMapping.update(
//         { sync_status: 'out_of_sync' },
//         {
//             where: mappingWhere,
//             // ✅ paranoid handles soft-delete filtering automatically
//         }
//     );

//     await redis.flushByPattern(cacheKey(user.companyId, '*'));
//     await redis.flushByPattern(`company:${user.companyId}:cache:platform_sku_mappings*`);

//     return {
//         queued: affectedRows,
//         message: affectedRows > 0
//             ? `${affectedRows} mapping(s) queued for sync — Java will push to platforms on next poll`
//             : 'No eligible active mappings found for the selected SKUs',
//     };
// };

//New
const syncInventory = async (user, data) => {
    const { SkuWarehouseStock, PlatformSkuMapping } = require('../../models');
    const { skuIds = [] } = data;
    

    // ── Step 1: Resolve sku_warehouse_stock IDs → stock records ──────────────
    let stockMap = {}; // merchant_sku_id → qty_available

    if (skuIds.length > 0) {
        const stockRecords = await SkuWarehouseStock.findAll({
            where: {
                id: { [Op.in]: skuIds },
                company_id: user.companyId,
            },
            attributes: ['id', 'merchant_sku_id', 'warehouse_id', 'qty_on_hand', 'qty_reserved'],
            raw: true,
        });

        if (!stockRecords.length) {
            const err = new Error('No matching inventory records found');
            err.statusCode = 404;
            throw err;
        }


        // Map merchant_sku_id → qty_available for quick lookup
        stockRecords.forEach((r) => {
            stockMap[r.merchant_sku_id] = Math.max(0, Number(r.qty_on_hand || 0) - Number(r.qty_reserved || 0));
        });
    }

    const merchantSkuIds = Object.keys(stockMap).map(Number);

    // ── Step 2: Find all active mappings for these merchant SKUs ─────────────
    const mappingWhere = {
        company_id: user.companyId,
        is_active: true,
        sync_status: { [Op.in]: ['pending', 'synced', 'failed', 'out_of_sync'] },
    };

    if (merchantSkuIds.length > 0) {
        mappingWhere.merchant_sku_id = { [Op.in]: merchantSkuIds };
    }

    const mappings = await PlatformSkuMapping.findAll({
        where: mappingWhere,
        raw: true,
    });

    if (!mappings.length) {
        return {
            queued: 0,
            synced: 0,
            failed: 0,
            total: 0,
            message: 'No eligible active mappings found for the selected SKUs',
            results: [],
        };
    }

    // ── Step 3: Call platform APIs concurrently ───────────────────────────────
    const results = await Promise.allSettled(
        mappings.map((mapping) => callPlatformSyncApi(mapping, stockMap))
    );

    // ── Step 4: Categorize results ────────────────────────────────────────────
    const successIds = [];
    const failedIds  = [];
    const failedMap  = {}; // id → error message

    results.forEach((result, index) => {
        const mapping = mappings[index];
        if (result.status === 'fulfilled' && result.value.success) {
            successIds.push(mapping.id);
        } else {
            failedIds.push(mapping.id);
            failedMap[mapping.id] = result.reason?.message
                ?? result.value?.error
                ?? 'Unknown error';
        }
    });

    // ── Step 5: Bulk update sync_status in DB ─────────────────────────────────
    const now = new Date();

    if (successIds.length > 0) {
        await PlatformSkuMapping.update(
            {
                sync_status: 'synced',
                last_synced_at: now,
                sync_error: null,
            },
            { where: { id: { [Op.in]: successIds } } }
        );
    }

    if (failedIds.length > 0) {
        // Update each failed one individually to store its specific error
        await Promise.all(
            failedIds.map((id) =>
                PlatformSkuMapping.update(
                    {
                        sync_status: 'failed',
                        sync_error: failedMap[id],
                    },
                    { where: { id } }
                )
            )
        );
    }

    // ── Step 6: Flush cache ───────────────────────────────────────────────────
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    await redis.flushByPattern(`company:${user.companyId}:cache:platform_sku_mappings*`);

    // ── Step 7: Build response ────────────────────────────────────────────────
    const total  = mappings.length;
    const synced = successIds.length;
    const failed = failedIds.length;

    let message;
    if (failed === 0) {
        message = `${synced} mapping(s) synced successfully to platforms`;
    } else if (synced === 0) {
        message = `Sync failed for all ${failed} mapping(s)`;
    } else {
        message = `Partial sync: ${synced} succeeded, ${failed} failed`;
    }

    return {
        total,
        synced,
        failed,
        message,
        results: mappings.map((m, i) => ({
            mappingId: m.id,
            merchantSkuId: m.merchant_sku_id,
            platform: detectPlatform(m),
            status: successIds.includes(m.id) ? 'synced' : 'failed',
            error: failedMap[m.id] ?? null,
        })),
    };
};

// Detect which platform this mapping belongs to
const detectPlatform = (mapping) => {
    if (mapping.platform_open_id)  return 'tiktok';
    if (mapping.platform_shop_id)  return 'shopee';
    return 'unknown';
};

// Route to correct platform API
const callPlatformSyncApi = async (mapping, stockMap) => {
    const platform = detectPlatform(mapping);
    const qty = stockMap[mapping.merchant_sku_id] ?? 0;

    console.log(platform,qty,"-------------------------------Call----------------");
    

    switch (platform) {
        case 'shopee':
            return callShopeeUpdateStock(mapping, qty);
        case 'tiktok':
            return callTikTokUpdateStock(mapping, qty);
        default:
            return { success: false, error: `Unknown platform for mapping ${mapping.id}` };
    }
};

// ── Shopee ────────────────────────────────────────────────────────────────────
const callShopeeUpdateStock = async (mapping, qty) => {
console.log(mapping.platform_shop_id, mapping.platform_item_id, mapping.platform_model_id, qty, "-------------------------------Shopee----------------");
    try {
        const response = await axios.post(
            `https://grozziie.zjweiting.com:3091/new-shopee-open-shop/api/dev/product/update_stock/${mapping.platform_shop_id}`,
            {
                item_id:  Number(mapping.platform_item_id),
                model_id: Number(mapping.platform_model_id),
                stock:    qty,
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        // Shopee returns failure_list — check it
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

// ── TikTok ────────────────────────────────────────────────────────────────────
const callTikTokUpdateStock = async (mapping, qty) => {
    
    try {
        const response = await axios.post(
            `https://grozziie.zjweiting.com:3091/tiktokshop-partner-country/api/dev/products/updateStock`,
            {
                skus: [
                    {
                        id: mapping.platform_sku_id,
                        inventory: [
                            {
                                quantity:    qty,
                                warehouseId: mapping.platform_warehouse_id,
                            },
                        ],
                    },
                ],
            },
            {
                params: {
                    productId: mapping.platform_product_id,
                    openId:    mapping.platform_open_id,
                    cipher:    mapping.platform_cipher_id,
                },
                headers: { 'Content-Type': 'application/json' },
            }
        );

        // TikTok returns code: 0 for success
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



// ─────────────────────────────────────────────────────────────────────────────
// Dropdown helper — warehouses (reuses same query as merchant SKUs)
// ─────────────────────────────────────────────────────────────────────────────
// Update only quantity and lock quantity for one inventory row.
const updateInventoryStock = async (user, inventoryId, data = {}) => {
    const {
        SkuWarehouseStock,
        MerchantSku,
        Warehouse,
        StockLedgerEntry,
        PlatformSkuMapping,
    } = require('../../models');

    const id = parseInt(inventoryId, 10);
    const quantity = parseInt(data.quantity, 10);
    const lock = parseInt(data.lock, 10);

    if (!Number.isInteger(id) || id <= 0) {
        const err = new Error('Invalid inventory row id');
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(lock) || lock < 0) {
        const err = new Error('Quantity and lock quantity must be non-negative integers');
        err.statusCode = 400;
        throw err;
    }
    if (lock > quantity) {
        const err = new Error('Lock quantity cannot be more than quantity');
        err.statusCode = 400;
        throw err;
    }

    let updatedItem = null;
    let markedOutOfSync = 0;

    await sequelize.transaction(async (transaction) => {
        const stockRecord = await SkuWarehouseStock.findOne({
            where: { id, company_id: user.companyId },
            include: [
                {
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'gtin', 'image_url', 'status', 'price'],
                    required: true,
                },
                {
                    model: Warehouse,
                    as: 'warehouse',
                    attributes: ['id', 'name', 'code'],
                    required: false,
                },
            ],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!stockRecord) {
            const err = new Error('Inventory record not found');
            err.statusCode = 404;
            throw err;
        }

        await assertWarehousePermission(user, stockRecord.warehouse_id);

        const oldQuantity = Number(stockRecord.qty_on_hand || 0);
        const oldLock = Number(stockRecord.qty_reserved || 0);
        const quantityDelta = quantity - oldQuantity;

        await stockRecord.update(
            {
                qty_on_hand: quantity,
                qty_reserved: lock,
            },
            { transaction },
        );

        if (quantityDelta !== 0 || oldLock !== lock) {
            await StockLedgerEntry.create({
                company_id: user.companyId,
                merchant_sku_id: stockRecord.merchant_sku_id,
                warehouse_id: stockRecord.warehouse_id,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: 'manual_adjustment',
                quantity_delta: quantityDelta,
                qty_on_hand_after: quantity,
                reference_type: 'inventory_stock_edit',
                reference_id: String(stockRecord.id),
                notes: `Inventory edit: quantity ${oldQuantity} -> ${quantity}, lock ${oldLock} -> ${lock}`,
                created_by: user.id || user.userId || null,
            }, { transaction });
        }

        const [affectedRows] = await PlatformSkuMapping.update(
            {
                sync_status: 'out_of_sync',
                sync_error: null,
            },
            {
                where: {
                    company_id: user.companyId,
                    merchant_sku_id: stockRecord.merchant_sku_id,
                    is_active: true,
                    sync_status: { [Op.in]: ['pending', 'synced', 'failed', 'out_of_sync'] },
                },
                transaction,
            },
        );
        markedOutOfSync = affectedRows;

        updatedItem = {
            id: stockRecord.id,
            qty_on_hand: quantity,
            qty_reserved: lock,
            qty_available: Math.max(0, quantity - lock),
            stock_alert_status: deriveAlertStatus(quantity, stockRecord.min_stock),
            min_stock: stockRecord.min_stock,
            merchantSku: stockRecord.merchantSku
                ? {
                    id: stockRecord.merchantSku.id,
                    sku_name: stockRecord.merchantSku.sku_name,
                    sku_title: stockRecord.merchantSku.sku_title,
                    gtin: stockRecord.merchantSku.gtin,
                    image_url: stockRecord.merchantSku.image_url,
                    status: stockRecord.merchantSku.status,
                    price: stockRecord.merchantSku.price,
                }
                : null,
            warehouse: stockRecord.warehouse
                ? { id: stockRecord.warehouse.id, name: stockRecord.warehouse.name, code: stockRecord.warehouse.code }
                : null,
        };
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    await redis.flushByPattern(`company:${user.companyId}:cache:platform_sku_mappings*`);

    return {
        item: updatedItem,
        mappingsMarkedOutOfSync: markedOutOfSync,
        message: markedOutOfSync > 0
            ? `Inventory updated. ${markedOutOfSync} mapped SKU(s) marked out of sync.`
            : 'Inventory updated.',
    };
};

const getInventoryDropdowns = async (user) => {
    const { Warehouse } = require('../../models');
    const where = await applyWarehouseScope(user, { company_id: user.companyId, status: 'active' });

    const warehouses = await Warehouse.findAll({
        where,
        attributes: ['id', 'name', 'code', 'is_default'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });

    return { warehouses };
};

module.exports = {
    getInventoryList,
    getInventoryCounts,
    setStockAlert,
    updateInventoryStock,
    syncInventory,
    getInventoryDropdowns,
};

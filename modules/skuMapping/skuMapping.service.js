'use strict';

/**
 * skuMapping.service.js
 *
 * Backend for ByMerchantSKUMappingPage.
 * Functions:
 *   getDropdowns           → platform stores for filter bar
 *   getMerchantSkuList     → paginated merchant SKUs with mapping status
 *   getMerchantSkuCounts   → { all, mapped, unmapped } for tabs
 *   getPlatformProductPicker → left panel of Add Mapping modal
 *                             (shows platform products by store, status=not_mapped)
 *   createMappingFromModal → Confirm button in Add Mapping modal
 *   unlinkMerchantMapping  → action logo unlink (unmap from merchant side)
 *   syncMappedSkus         → Sync Mapped button — marks out_of_sync for Java
 */

const { Op, UniqueConstraintError } = require('sequelize'); 


const buildPlatformMappingFields = (platformProduct, platformStore, fulfillmentWarehouseId, userId) => ({
    platform_store_id:        platformProduct.platform_store_id || platformStore?.id,
    fulfillment_warehouse_id: fulfillmentWarehouseId || null,
    platform_listing_id:      platformProduct.platform_product_id || null,
    platform_product_id:      platformProduct.platform_product_id || null,
    platform_item_id:         platformProduct.platform_item_id || platformProduct.platform_product_id || null,
    platform_sku_id:          platformProduct.platform_sku_id || null,
    platform_model_id:        platformProduct.platform_model_id || null,
    platform_location_id:     platformProduct.platform_location_id || null,
    platform_warehouse_id:    platformProduct.platform_warehouse_id || null,
    platform_shop_id:         platformStore?.store_shop_id || platformStore?.external_store_id || null,
    platform_open_id:         platformStore?.store_open_id || null,
    platform_cipher_id:       platformStore?.store_cipher || null,
    sync_status:              'pending',
    is_active:                true,
    deleted_at:               null,
    created_by:               userId || null,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. getDropdowns — platforms + stores for filter bars
// ─────────────────────────────────────────────────────────────────────────────
const getDropdowns = async (user) => {
    const { PlatformStore, Warehouse } = require('../../models');

    const [stores, warehouses] = await Promise.all([
        PlatformStore.findAll({
            // where:      { company_id: user.companyId, status: 'active' },
            where:      { company_id: user.companyId, is_active: true },
            attributes: ['id', 'store_name', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher'],
            order:      [['platform', 'ASC'], ['store_name', 'ASC']],
        }),
        Warehouse.findAll({
            where:      { company_id: user.companyId, status: 'active' },
            attributes: ['id', 'name', 'code', 'is_default'],
            order:      [['is_default', 'DESC'], ['name', 'ASC']],
        }),
    ]);

    const platforms = [...new Set(stores.map((s) => s.platform))];
    const storesByPlatform = {};
    platforms.forEach((p) => {
        storesByPlatform[p] = stores
            .filter((s) => s.platform === p)
            .map((s) => ({ id: s.id, label: s.store_name, value: String(s.id) }));
    });

    return {
        platforms:        platforms.map((p) => ({ label: p, value: p })),
        stores:           stores.map((s) => ({ id: s.id, label: s.store_name, value: String(s.id), platform: s.platform })),
        storesByPlatform,
        warehouses:       warehouses.map((w) => ({ id: w.id, label: w.name, value: String(w.id), is_default: w.is_default })),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. getMerchantSkuList — ByMerchantSKUMappingPage table
// ─────────────────────────────────────────────────────────────────────────────
const getMerchantSkuList = async (user, filters = {}) => {
    const { MerchantSku, PlatformSkuMapping, PlatformStore, Warehouse, PlatformProduct } = require('../../models');

    const {
        page          = 1,
        limit         = 20,
        search,
        skuType       = 'sku_name',   // sku_name | product_name
        mappingStatus = 'all',
    } = filters;

    // A merchant SKU can now be a parent, a child of multiple parent groups,
    // and also a parent in its own group. Do not hide child/group SKUs from the
    // main table. Only the Unmapped tab excludes SKUs already mapped to stores.
    const excludedIds = [];
    if (mappingStatus === 'unmapped') {
        const mappedRows = await PlatformSkuMapping.findAll({
            where: { company_id: user.companyId, is_active: true, deleted_at: null, merchant_sku_id: { [Op.ne]: null } },
            attributes: ['merchant_sku_id'],
            raw: true,
        });
        excludedIds.push(...mappedRows.map((r) => r.merchant_sku_id).filter(Boolean));
    }

    const where = { company_id: user.companyId, deleted_at: null };
    if (excludedIds.length) where.id = { [Op.notIn]: [...new Set(excludedIds)] };
    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        where[skuType === 'product_name' ? 'sku_title' : 'sku_name'] = { [Op.like]: q };
    }

    const mappingInclude = {
        model:      PlatformSkuMapping,
        as:         'platformMappings',
        attributes: ['id', 'platform_store_id', 'fulfillment_warehouse_id', 'platform_listing_id', 'platform_product_id', 'platform_item_id', 'platform_sku_id', 'platform_model_id', 'platform_location_id', 'platform_warehouse_id', 'platform_shop_id', 'platform_open_id', 'platform_cipher_id', 'sync_status', 'is_active', 'last_synced_at'],
        required:   mappingStatus === 'mapped',
        where:      { is_active: true, deleted_at: null },
        include: [{
            model:      PlatformStore,
            as:         'platformStore',
            attributes: ['id', 'store_name', 'platform'],
            required:   false,
        }],
    };

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        include: [
            mappingInclude,
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
        ],
        order:    [['created_at', 'DESC']],
        limit:    parseInt(limit, 10),
        offset,
        distinct: true,
        subQuery: false,
    });

    const allMappings = rows.flatMap((sku) => sku.platformMappings ?? []);
    const productLookupConditions = allMappings
        .filter((m) => m.platform_store_id && (m.platform_product_id || m.platform_listing_id || m.platform_sku_id))
        .map((m) => ({
            platform_store_id: m.platform_store_id,
            platform_product_id: m.platform_product_id || m.platform_listing_id,
            ...(m.platform_sku_id ? { platform_sku_id: m.platform_sku_id } : {}),
        }));

    // Do not request columns that do not exist in the current DB/model.
    // Some installations already have platform_item_id in platform_sku_mappings
    // but not in platform_products. Selecting it from platform_products caused:
    // "Unknown column 'platform_item_id' in 'field list'" on the mapped tab.
    const platformProductAttributes = [
        'id', 'platform_store_id', 'platform', 'platform_product_id',
        'platform_sku_id', 'platform_model_id', 'platform_location_id', 'platform_warehouse_id',
        'product_name', 'variation_name', 'seller_sku', 'parent_sku', 'image_url',
        'platform_stock', 'platform_price', 'currency', 'is_mapped',
    ].filter((attr) => PlatformProduct.rawAttributes?.[attr]);

    const platformProducts = productLookupConditions.length ? await PlatformProduct.findAll({
        where: {
            company_id: user.companyId,
            row_type: 'child',
            [Op.or]: productLookupConditions,
        },
        attributes: platformProductAttributes,
        raw: true,
    }) : [];

    const productByKey = new Map();
    platformProducts.forEach((p) => {
        productByKey.set(`${p.platform_store_id}|${p.platform_product_id}|${p.platform_sku_id ?? ''}`, p);
        productByKey.set(`${p.platform_store_id}|${p.platform_product_id}|`, p);
    });

    return {
        data: rows.map((sku) => {
            const mappings = sku.platformMappings ?? [];
            const isMapped = mappings.length > 0;
            const firstMap  = mappings[0];
            const mappedStoreSku = firstMap
                ? `${firstMap.platformStore?.store_name ?? ''} — ${firstMap.platform_listing_id ?? firstMap.platform_product_id ?? ''}`
                : null;

            return {
                id:              sku.id,
                sku_name:        sku.sku_name,
                sku_title:       sku.sku_title,
                image_url:       sku.image_url,
                status:          sku.status,
                warehouse_id:    sku.warehouse_id,
                warehouse_name:  sku.warehouse?.name ?? null,
                is_mapped:       isMapped,
                mapping_count:   mappings.length,
                mapped_store_sku:mappedStoreSku,
                mappings:        mappings.map((m) => {
                    const platformProductId = m.platform_product_id || m.platform_listing_id;
                    const product = productByKey.get(`${m.platform_store_id}|${platformProductId}|${m.platform_sku_id ?? ''}`)
                        || productByKey.get(`${m.platform_store_id}|${platformProductId}|`)
                        || null;
                    return {
                        id:                  m.id,
                        platform:            m.platformStore?.platform,
                        store_name:          m.platformStore?.store_name,
                        platform_store_id:   m.platform_store_id,
                        fulfillment_warehouse_id: m.fulfillment_warehouse_id,
                        platform_listing_id: m.platform_listing_id,
                        platform_product_id: m.platform_product_id,
                        platform_item_id:    m.platform_item_id,
                        platform_sku_id:     m.platform_sku_id,
                        platform_model_id:   m.platform_model_id,
                        platform_location_id:m.platform_location_id,
                        platform_warehouse_id:m.platform_warehouse_id,
                        platform_shop_id:    m.platform_shop_id,
                        platform_open_id:    m.platform_open_id,
                        platform_cipher_id:  m.platform_cipher_id,
                        product_name:        product?.product_name ?? null,
                        variation_name:      product?.variation_name ?? null,
                        seller_sku:          product?.seller_sku ?? null,
                        parent_sku:          product?.parent_sku ?? null,
                        product_image_url:   product?.image_url ?? null,
                        platform_stock:      product?.platform_stock ?? null,
                        platform_price:      product?.platform_price ?? null,
                        currency:            product?.currency ?? null,
                        sync_status:         m.sync_status,
                        last_synced_at:      m.last_synced_at,
                    };
                }),
            };
        }),
        pagination: {
            total:      count,
            page:       parseInt(page, 10),
            limit:      parseInt(limit, 10),
            totalPages: Math.ceil(count / parseInt(limit, 10)),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. getMerchantSkuCounts
// ─────────────────────────────────────────────────────────────────────────────
const getMerchantSkuCounts = async (user) => {
    const { sequelize } = require('../../config/database');

    const [result] = await sequelize.query(
        `SELECT
             COUNT(DISTINCT ms.id)                                        AS \`all\`,
             COUNT(DISTINCT CASE WHEN psm.id IS NOT NULL THEN ms.id END) AS mapped,
             COUNT(DISTINCT CASE WHEN psm.id IS NULL     THEN ms.id END) AS unmapped
         FROM merchant_skus ms
         LEFT JOIN platform_sku_mappings psm
             ON psm.merchant_sku_id = ms.id AND psm.is_active = 1 AND psm.deleted_at IS NULL
         WHERE ms.company_id = :companyId AND ms.deleted_at IS NULL`,
        { replacements: { companyId: user.companyId }, type: sequelize.QueryTypes.SELECT }
    );

    return {
        all:      parseInt(result?.all      ?? 0, 10),
        mapped:   parseInt(result?.mapped   ?? 0, 10),
        unmapped: parseInt(result?.unmapped ?? 0, 10),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. getPlatformProductPicker
//    Left panel of Add Mapping modal.
//    Returns platform products for a given store, filtered by status.
//    mappingStatus: 'all' | 'not_mapped'
//    skuType: 'sku_name' | 'product_name' | 'item_id' | 'sku_id'
// ─────────────────────────────────────────────────────────────────────────────
const getPlatformProductPicker = async (user, filters = {}) => {
    const { PlatformProduct, PlatformStore } = require('../../models');

    const {
        platformStoreId,
        platformStoreIds,
        platform,
        mappingStatus = 'all',
        skuType       = 'product_name',
        search,
        page          = 1,
        limit         = 50,
    } = filters;

    const where = { company_id: user.companyId, row_type: 'child' };
    const storeIdList = [
        ...(platformStoreIds ? String(platformStoreIds).split(',') : []),
        ...(platformStoreId ? [platformStoreId] : []),
    ].map((id) => parseInt(id, 10)).filter(Boolean);
    if (storeIdList.length) where.platform_store_id = { [Op.in]: [...new Set(storeIdList)] };
    if (platform && platform !== 'all') where.platform = platform;
    if (mappingStatus === 'not_mapped') where.is_mapped = 0;

    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        const fieldMap = {
            product_name: 'product_name',
            sku_name:     'seller_sku',
            item_id:      'platform_product_id',
            sku_id:       'platform_sku_id',
        };
        where[fieldMap[skuType] ?? 'product_name'] = { [Op.like]: q };
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await PlatformProduct.findAndCountAll({
        where,
        include: [{
            model:      PlatformStore,
            as:         'platformStore',
            attributes: ['id', 'store_name', 'platform'],
            required:   false,
        }],
        order:    [['product_name', 'ASC']],
        limit:    parseInt(limit, 10),
        offset,
        distinct: true,
    });

    return {
        data: rows.map((p) => ({
            id:                  p.id,
            platform:            p.platform,
            platform_store_id:   p.platform_store_id,
            platform_product_id: p.platform_product_id,
            platform_sku_id:     p.platform_sku_id,
            platform_model_id:   p.platform_model_id,
            platform_location_id:p.platform_location_id,
            platform_warehouse_id:p.platform_warehouse_id,
            product_name:        p.product_name,
            variation_name:      p.variation_name,
            seller_sku:          p.seller_sku,
            image_url:           p.image_url,
            store_name:          p.platformStore?.store_name ?? p.store_name,
            is_mapped:           !!p.is_mapped,
        })),
        pagination: {
            total:      count,
            page:       parseInt(page, 10),
            limit:      parseInt(limit, 10),
            totalPages: Math.ceil(count / parseInt(limit, 10)),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. createMappingFromModal
//    Confirm button in Add Mapping modal (from Merchant SKU side).
//    Links one merchant SKU to multiple platform product rows.
//    Body: { merchantSkuId, platformProductIds: [1,2,3], platformStoreId }
// ─────────────────────────────────────────────────────────────────────────────
const createMappingFromModal = async (user, body) => {
    const { PlatformSkuMapping, MerchantSku, PlatformProduct, PlatformStore } = require('../../models');
    // const { UniqueConstraintError } = require('sequelize');
    const { merchantSkuId, platformProductIds, platformStoreId } = body;

    if (!merchantSkuId || !Array.isArray(platformProductIds) || !platformProductIds.length) {
        const err = new Error('merchantSkuId and platformProductIds[] are required');
        err.statusCode = 400; throw err;
    }

    const msku = await MerchantSku.findOne({
        where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!msku) { const err = new Error('Merchant SKU not found'); err.statusCode = 404; throw err; }

    const products = await PlatformProduct.findAll({
        where: {
            id: { [Op.in]: platformProductIds },
            company_id: user.companyId,
            ...(platformStoreId ? { platform_store_id: parseInt(platformStoreId, 10) } : {}),
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher'],
            required: false,
        }],
    });
    if (!products.length) { const err = new Error('No valid platform products found'); err.statusCode = 404; throw err; }

    let created = 0, skipped = 0;
    for (const product of products) {
        try {
            const [, wasCreated] = await PlatformSkuMapping.findOrCreate({
                where: {
                    company_id:          user.companyId,
                    merchant_sku_id:     msku.id,
                    platform_store_id:   product.platform_store_id,
                    platform_listing_id: product.platform_product_id,
                    platform_sku_id:     product.platform_sku_id,
                },
                defaults: {
                    ...buildPlatformMappingFields(product, product.platformStore, msku.warehouse_id, user.id || user.userId),
                },
            });
            if (wasCreated) {
                await product.update({ is_mapped: 1 });
                created++;   // ✅ was accidentally using matched++ from autoMapping
            } else {
                skipped++;
            }
        } catch (e) {
            if (e instanceof UniqueConstraintError) {
                skipped++;
            } else {
                throw e;
            }
        }
    }

    return {
        created,
        skipped,
        message: `${created} mapping(s) created, ${skipped} skipped`,
    };
};


// ─────────────────────────────────────────────────────────────────────────────
// 6. createStoreMappings
//    Store-level mapping from merchant SKU side.
//    Body: { merchantSkuId, platformStoreIds: [1,2,3] }
//    The parent SKU is mapped to one/multiple/all selected stores. If a platform
//    product with matching seller_sku/parent_sku exists in that store, its
//    platform identifiers are copied; otherwise a pending store mapping is made
//    for Java/platform sync to complete later.
// ─────────────────────────────────────────────────────────────────────────────
const createStoreMappings = async (user, body) => {
    const {
        MerchantSku,
        MerchantSkuSyncGroup,
        MerchantSkuSyncMember,
        PlatformStore,
        PlatformProduct,
        PlatformSkuMapping,
    } = require('../../models');

    const { merchantSkuId, platformStoreIds, platformProductIds = [], childMerchantSkuIds = [] } = body;
    const storeIds = [...new Set((platformStoreIds ?? []).map((id) => parseInt(id, 10)).filter(Boolean))];

    if (!merchantSkuId || !storeIds.length) {
        const err = new Error('merchantSkuId and platformStoreIds[] are required');
        err.statusCode = 400; throw err;
    }

    const msku = await MerchantSku.findOne({
        where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!msku) { const err = new Error('Merchant SKU not found'); err.statusCode = 404; throw err; }

    // A SKU can now be a parent and also a child in other sync groups.
    // Store mapping is allowed for the selected parent/action SKU.

    const childIds = [...new Set((childMerchantSkuIds ?? []).map((id) => parseInt(id, 10)).filter(Boolean))]
        .filter((id) => id !== msku.id);
    if (childIds.length) {
        const childRows = await MerchantSku.findAll({
            where: { id: { [Op.in]: childIds }, company_id: user.companyId, deleted_at: null, warehouse_id: msku.warehouse_id },
            attributes: ['id'],
        });
        if (childRows.length) {
            const [group] = await MerchantSkuSyncGroup.findOrCreate({
                where: { company_id: user.companyId, primary_sku_id: msku.id },
                defaults: { company_id: user.companyId, primary_sku_id: msku.id },
            });
            for (const child of childRows) {
                await MerchantSkuSyncMember.findOrCreate({
                    where: { group_id: group.id, member_sku_id: child.id },
                    defaults: { company_id: user.companyId, group_id: group.id, member_sku_id: child.id },
                });
            }
        }
    }

    const selectedProductIds = [...new Set((platformProductIds ?? []).map((id) => parseInt(id, 10)).filter(Boolean))];
    const explicitProducts = selectedProductIds.length ? await PlatformProduct.findAll({
        where: { id: { [Op.in]: selectedProductIds }, company_id: user.companyId, row_type: 'child' },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'store_name', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher', 'default_warehouse_id'],
            required: false,
        }],
    }) : [];

    const stores = await PlatformStore.findAll({
        where: { id: { [Op.in]: storeIds }, company_id: user.companyId, is_active: true },
        attributes: ['id', 'store_name', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher', 'default_warehouse_id'],
    });
    if (!stores.length) { const err = new Error('No valid active stores found'); err.statusCode = 404; throw err; }

    let created = 0;
    let restored = 0;
    let skipped = 0;
    const results = [];

    for (const store of stores) {
        const selectedForStore = explicitProducts.filter((p) => Number(p.platform_store_id) === Number(store.id));
        const productsToLink = selectedForStore.length ? selectedForStore : [await PlatformProduct.findOne({
            where: {
                company_id: user.companyId,
                platform_store_id: store.id,
                row_type: 'child',
                [Op.or]: [
                    { seller_sku: msku.sku_name },
                    { parent_sku: msku.sku_name },
                ],
            },
            include: [{
                model: PlatformStore,
                as: 'platformStore',
                attributes: ['id', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher', 'default_warehouse_id'],
                required: false,
            }],
            order: [['updated_at', 'DESC']],
        })].filter(Boolean);

        if (!productsToLink.length) {
            const defaults = {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                combine_sku_id: null,
                platform_store_id: store.id,
                fulfillment_warehouse_id: msku.warehouse_id || store.default_warehouse_id || null,
                platform_shop_id: store.store_shop_id || store.external_store_id || null,
                platform_open_id: store.store_open_id || null,
                platform_cipher_id: store.store_cipher || null,
                sync_status: 'pending',
                is_active: true,
                deleted_at: null,
                created_by: user.id || user.userId || null,
            };

            const existing = await PlatformSkuMapping.findOne({
                where: { company_id: user.companyId, platform_store_id: store.id, merchant_sku_id: msku.id, platform_listing_id: null, platform_sku_id: null },
                paranoid: false,
            });

            if (existing) {
                if (existing.is_active && !existing.deleted_at) { skipped++; results.push({ storeId: store.id, storeName: store.store_name, status: 'already_mapped' }); continue; }
                await existing.update(defaults, { paranoid: false });
                restored++; results.push({ storeId: store.id, storeName: store.store_name, status: 'restored_pending' }); continue;
            }

            await PlatformSkuMapping.create(defaults);
            created++; results.push({ storeId: store.id, storeName: store.store_name, status: 'created_pending' });
            continue;
        }

        for (const product of productsToLink) {
            const defaults = {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                combine_sku_id: null,
                ...buildPlatformMappingFields(product, product.platformStore || store, msku.warehouse_id || store.default_warehouse_id || null, user.id || user.userId),
            };

            const existing = await PlatformSkuMapping.findOne({
                where: {
                    company_id: user.companyId,
                    platform_store_id: product.platform_store_id,
                    merchant_sku_id: msku.id,
                    platform_listing_id: product.platform_product_id,
                    platform_sku_id: product.platform_sku_id,
                },
                paranoid: false,
            });

            if (existing) {
                if (existing.is_active && !existing.deleted_at) { skipped++; results.push({ storeId: store.id, storeName: store.store_name, productId: product.id, status: 'already_mapped' }); continue; }
                await existing.update(defaults, { paranoid: false });
                restored++; results.push({ storeId: store.id, storeName: store.store_name, productId: product.id, status: 'restored' });
            } else {
                await PlatformSkuMapping.create(defaults);
                created++; results.push({ storeId: store.id, storeName: store.store_name, productId: product.id, status: 'created' });
            }
            await product.update({ is_mapped: 1 });
        }
    }

    return {
        created,
        restored,
        skipped,
        results,
        message: `${created + restored} store mapping(s) saved, ${skipped} skipped`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. unlinkMerchantMapping — unmap a single platform_sku_mapping from merchant side
// ─────────────────────────────────────────────────────────────────────────────
const unlinkMerchantMapping = async (user, mappingId) => {
    const { PlatformSkuMapping, PlatformProduct } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId },
    });
    if (!mapping) { const err = new Error('Mapping not found'); err.statusCode = 404; throw err; }

    await mapping.update({ is_active: false, deleted_at: new Date() });

    // Clear is_mapped on platform product
    await PlatformProduct.update(
        { is_mapped: 0 },
        {
            where: {
                company_id:          user.companyId,
                platform_store_id:   mapping.platform_store_id,
                platform_product_id: mapping.platform_listing_id,
                platform_sku_id:     mapping.platform_sku_id,
            },
        }
    );

    return { unlinked: mappingId };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. syncMappedSkus
//    "Sync Mapped" button in the merchant mapping details dropdown.
//    Marks selected mappings as out_of_sync — Java will push to platforms.
//    Body: { merchantSkuId }  — syncs all mappings for this merchant SKU
// ─────────────────────────────────────────────────────────────────────────────
const syncMappedSkus = async (user, body) => {
    const { PlatformSkuMapping } = require('../../models');

    const { merchantSkuId } = body;
    if (!merchantSkuId) { const err = new Error('merchantSkuId is required'); err.statusCode = 400; throw err; }

    const [updated] = await PlatformSkuMapping.update(
        { sync_status: 'out_of_sync' },
        {
            where: {
                company_id:      user.companyId,
                merchant_sku_id: merchantSkuId,
                is_active:       true,
                deleted_at:      null,
                sync_status:     { [Op.in]: ['synced', 'out_of_sync'] },
            },
        }
    );

    return { queued: updated, message: `${updated} mapping(s) queued for sync` };
};

module.exports = {
    getDropdowns,
    getMerchantSkuList,
    getMerchantSkuCounts,
    getPlatformProductPicker,
    createMappingFromModal,
    createStoreMappings,
    unlinkMerchantMapping,
    syncMappedSkus,
};


const axios  = require('axios');
const { Op } = require('sequelize');

const { getPermittedStoreIds, assertStorePermission } = require('../../utils/permissions');
const JAVA_BASE = process.env.JAVA_API_URL ?? 'http://localhost:8080';

// ─── Axios instance for Java proxy ───────────────────────────────────────────
const javaApi = axios.create({
    baseURL: JAVA_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

const toDecimalOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const platformPrefix = (platform) => {
    if (platform === 'tiktok') return 'TT';
    if (platform === 'shopee') return 'SP';
    return String(platform || 'PL').slice(0, 2).toUpperCase();
};

const safeSkuPart = (value, fallback = 'SKU') => String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;

const buildMerchantSkuName = (platform, sellerSku, warehouseCode, productId, skuId) => {
    // Requirement: generated Merchant SKU must match the child/platform seller SKU exactly.
    // Do not add platform prefix or warehouse suffix (example: SK_A_001, not SP-SK_A_001-WH-004).
    return safeSkuPart(sellerSku, `${productId}-${skuId || 'SKU'}`).slice(0, 100);
};

const getWarehouseCode = (warehouse) => (
    warehouse?.warehouse_code || warehouse?.code || warehouse?.name || warehouse?.warehouse_name || `WH${warehouse?.id || ''}`
);

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
    sync_status:              'synced',
    last_synced_at:           new Date(),
    is_active:                true,
    deleted_at:               null,
    created_by:               userId || null,
});


const platformProductUniqueWhere = (values) => {
    const where = {
        company_id:           values.company_id,
        platform_store_id:    values.platform_store_id,
        platform_product_id:  values.platform_product_id,
        row_type:             values.row_type,
    };

    if (values.row_type === 'parent') {
        where.platform_sku_id = { [Op.is]: null };
    } else {
        where.platform_sku_id = values.platform_sku_id;
    }

    return where;
};

const upsertPlatformProductRow = async (PlatformProduct, values) => {
    const existing = await PlatformProduct.findOne({
        where: platformProductUniqueWhere(values),
        order: [['id', 'DESC']],
    });

    if (existing) {
        await existing.update(values);
        return existing;
    }

    return PlatformProduct.create(values);
};

const cleanupDuplicatePlatformProducts = async (companyId, storeId, PlatformProduct) => {
    const rows = await PlatformProduct.findAll({
        where: { company_id: companyId, platform_store_id: storeId },
        order: [['updated_at', 'DESC'], ['id', 'DESC']],
    });

    const groups = new Map();
    for (const row of rows) {
        const key = [
            row.platform_store_id,
            row.platform_product_id,
            row.row_type,
            row.row_type === 'parent' ? '__parent__' : (row.platform_sku_id || '__empty_sku__'),
        ].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    for (const group of groups.values()) {
        if (group.length <= 1) continue;
        const keep = group.find((row) => Number(row.is_mapped) === 1) || group[0];
        const deleteIds = group.filter((row) => row.id !== keep.id).map((row) => row.id);
        if (group.some((row) => Number(row.is_mapped) === 1) && Number(keep.is_mapped) !== 1) {
            await keep.update({ is_mapped: 1 });
        }
        if (deleteIds.length) {
            await PlatformProduct.destroy({ where: { id: { [Op.in]: deleteIds } } });
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Sync helpers per platform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * syncShopeeStore
 * Calls Java proxy: GET /shopee-open-shop/api/dev/product/get_item_list/:shopId
 * Paginates using next_offset until has_next_page = false.
 * For each item, calls GET /shopee-open-shop/api/dev/product/get_item/:shopId?itemId=
 * to retrieve models (variations) with their model_id, model_sku, stock, location_id.
 */
const syncShopeeStore = async (store, PlatformProduct) => {
    const shopId    = store.store_shop_id;
    const storeId   = store.id;
    const companyId = store.company_id;
    const storeName = store.store_name;

    let offset      = 0;
    const pageSize  = 100;
    let hasNextPage = true;
    let totalSynced = 0;

    while (hasNextPage) {
        const listRes = await javaApi.post(
            `/shopee-open-shop/api/dev/product/get`,
            {
                offset,
                page_size:   pageSize,
                item_status: ['NORMAL'],
            },
            { params: { shopId } }
        );

        const items      = listRes.data?.products ?? [];
        hasNextPage      = listRes.data?.has_next_page ?? false;   // ✅ fixed path
        const nextOffset = listRes.data?.next_offset ?? 0;         // ✅ fixed path

        console.log('list res:', items);

        for (const item of items) {
            const itemId      = item.item_id;
            const imageUrl    = item.image?.image_url_list?.[0] ?? null;
            const productName = item.item_name ?? '';
            const models      = item.models ?? [];                 // ✅ already in /get response
            const itemWeight = toDecimalOrNull(item.weight);
            const itemLength = toDecimalOrNull(item.dimension?.package_length);
            const itemWidth  = toDecimalOrNull(item.dimension?.package_width);
            const itemHeight = toDecimalOrNull(item.dimension?.package_height);
            const hasVariants = !!item.has_model || models.length > 1;

            console.log("current item:", item);

            // Upsert parent row by real unique product key. Do not use Sequelize
            // upsert here because MySQL unique indexes allow multiple NULL
            // platform_sku_id parent rows.
            await upsertPlatformProductRow(PlatformProduct, {
                company_id:           companyId,
                platform_store_id:    storeId,
                platform:             'shopee',
                platform_product_id:  String(itemId),
                platform_sku_id:      null,
                platform_model_id:    null,
                platform_location_id: null,
                product_name:         productName,
                variation_name:       null,
                parent_sku:           item.item_sku ?? null,
                seller_sku:           null,
                image_url:            imageUrl,
                store_name:           storeName,
                platform_stock:       0,
                platform_price:       null,
                currency:             null,
                product_status:       item.item_status ?? null,
                has_variants:         hasVariants,
                weight:               itemWeight,
                length:               itemLength,
                width:                itemWidth,
                height:               itemHeight,
                row_type:             'parent',
                synced_at:            new Date(),
            });

            // Upsert each model (child row)
            for (const model of models) {
                const modelId    = String(model.model_id ?? '');
                const stock      = model.stock_info_v2?.summary_info?.total_available_stock ?? 0;
                const locationId = model.stock_info_v2?.seller_stock?.[0]?.location_id ?? null;
                const price      = model.price_info?.[0]?.current_price ?? null;
                const currency   = model.price_info?.[0]?.currency ?? null;
                const modelWeight = toDecimalOrNull(model.weight ?? item.weight);
                const modelLength = toDecimalOrNull(model.dimension?.package_length ?? item.dimension?.package_length);
                const modelWidth  = toDecimalOrNull(model.dimension?.package_width ?? item.dimension?.package_width);
                const modelHeight = toDecimalOrNull(model.dimension?.package_height ?? item.dimension?.package_height);

                await upsertPlatformProductRow(PlatformProduct, {
                    company_id:           companyId,
                    platform_store_id:    storeId,
                    platform:             'shopee',
                    platform_product_id:  String(itemId),
                    platform_sku_id:      modelId,
                    platform_model_id:    modelId,
                    platform_location_id: locationId,
                    product_name:         productName,
                    variation_name:       model.model_name ?? null,
                    parent_sku:           item.item_sku ?? null,
                    seller_sku:           model.model_sku ?? null,
                    image_url:            imageUrl,
                    store_name:           storeName,
                    platform_stock:       stock,
                    platform_price:       price,
                    currency,
                    product_status:       model.model_status ?? item.item_status ?? null,
                    has_variants:         hasVariants,
                    weight:               modelWeight,
                    length:               modelLength,
                    width:                modelWidth,
                    height:               modelHeight,
                    row_type:             'child',
                    synced_at:            new Date(),
                });
            }

            totalSynced++;
        }

        if (!hasNextPage || items.length === 0) break;
        offset = nextOffset;
    }

    return totalSynced;
};

/**
 * syncTikTokStore
 * Calls Java proxy: POST /tiktokshop-partner/api/dev/products/get/pagination
 * Paginates using nextPageToken until it is null/empty.
 * Each product has skus[] — each SKU is a child row.
 */
const syncTikTokStore = async (store, PlatformProduct) => {
console.log("Call tiktok store product ....................................1.............................");

    
    const openId     = store.store_open_id;
    const cipher     = store.store_cipher;
    const storeId    = store.id;
    const companyId  = store.company_id;
    const storeName  = store.store_name;

    let pageToken    = null;
    const pageSize   = 100;
    let totalSynced  = 0;

    const sumInventoryQuantity = (inventory = []) => inventory.reduce((sum, row) => {
        const qty = Number(row?.quantity ?? 0);
        return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    const firstInventoryWarehouseId = (inventory = []) => {
        const first = inventory.find((row) => row?.warehouseId || row?.warehouse_id);
        return first?.warehouseId || first?.warehouse_id || null;
    };

    const firstMainImageUrl = (product = {}) => {
        const image = product.mainImages?.[0] || product.main_images?.[0] || null;
        return image?.urls?.[0] || image?.thumbUrls?.[0] || image?.thumb_urls?.[0] || null;
    };

    const skuVariationName = (sku = {}) => {
        const attrs = Array.isArray(sku.salesAttributes) ? sku.salesAttributes : [];
        const fromAttrs = attrs.map((attr) => {
            const values = Array.isArray(attr.values) ? attr.values : [];
            const firstValue = values[0] || {};
            return attr.valueName || attr.value_name || attr.name || firstValue.name || firstValue.valueName || firstValue.value_name || null;
        }).filter(Boolean).join(' / ');
        return fromAttrs || sku.sellerSku || sku.seller_sku || null;
    };

    const fetchTikTokProductDetail = async (productId, fallbackProduct) => {
        try {
            const detailRes = await javaApi.get(
                `/tiktokshop-partner/api/dev/products/get`,
                { params: { productId, openId, cipher } }
            );

            if (detailRes.data?.code === 0 && detailRes.data?.data) {
                return detailRes.data.data;
            }

            console.warn('[TikTok sync] product detail API returned non-zero response:', {
                productId,
                response: detailRes.data,
            });
        } catch (error) {
            console.warn('[TikTok sync] product detail API failed, using pagination data:', {
                productId,
                message: error.message,
            });
        }

        return fallbackProduct;
    };

    do {
        const params = { openId, cipher, pageSize };
        if (pageToken) params.pageToken = pageToken;

        const res = await javaApi.post(
            `/tiktokshop-partner/api/dev/products/get/pagination`,
            { status: 'ACTIVATE' },
            { params }
        );

        if (res.data?.code !== 0) {
            console.error('[TikTok sync] API error:', res.data);
            break;
        }

        const products = res.data?.data?.products ?? [];
        pageToken      = res.data?.data?.nextPageToken ?? null;

        for (const listProduct of products) {
            const productId = String(listProduct.id ?? '');
            if (!productId) continue;

            // Pagination gives product IDs and basic SKU information. The detail
            // API gives mainImages, package weight/dimensions, full SKU status,
            // and richer product data. Sync from the detail payload when available.
            const product     = await fetchTikTokProductDetail(productId, listProduct);
            const productName = product.title ?? listProduct.title ?? '';
            const skus        = Array.isArray(product.skus) && product.skus.length ? product.skus : (listProduct.skus ?? []);
            const parentSku   = skus[0]?.sellerSku ?? skus[0]?.seller_sku ?? null;
            const hasVariants = skus.length > 1;
            const imageUrl    = firstMainImageUrl(product);
            const status      = product.productStatus ?? product.status ?? listProduct.status ?? null;
            const productWeight = toDecimalOrNull(product.packageWeight?.value);
            const productLength = toDecimalOrNull(product.packageDimensions?.length);
            const productWidth  = toDecimalOrNull(product.packageDimensions?.width);
            const productHeight = toDecimalOrNull(product.packageDimensions?.height);
            const totalStock    = skus.reduce((sum, sku) => sum + sumInventoryQuantity(sku.inventory ?? []), 0);

            // Parent row: one row per TikTok product/listing.
            await upsertPlatformProductRow(PlatformProduct, {
                company_id:            companyId,
                platform_store_id:     storeId,
                platform:              'tiktok',
                platform_product_id:   productId,
                platform_sku_id:       null,
                platform_model_id:     null,
                platform_location_id:  null,
                platform_warehouse_id: null,
                product_name:          productName,
                variation_name:        null,
                parent_sku:            parentSku,
                seller_sku:            null,
                image_url:             imageUrl,
                store_name:            storeName,
                platform_stock:        totalStock,
                platform_price:        null,
                currency:              skus[0]?.price?.currency ?? null,
                product_status:        status,
                has_variants:          hasVariants,
                weight:                productWeight,
                length:                productLength,
                width:                 productWidth,
                height:                productHeight,
                row_type:              'parent',
                synced_at:             new Date(),
            });

            // Child rows: one row per TikTok SKU/variant.
            for (const sku of skus) {
                const skuId       = String(sku.id ?? '');
                if (!skuId) continue;

                const inventory   = sku.inventory ?? [];
                const warehouseId = firstInventoryWarehouseId(inventory);
                const stock       = sumInventoryQuantity(inventory);
                const price       = sku.price?.salePrice ?? sku.price?.taxExclusivePrice ?? sku.price?.unitPrice ?? null;
                const currency    = sku.price?.currency ?? null;

                await upsertPlatformProductRow(PlatformProduct, {
                    company_id:            companyId,
                    platform_store_id:     storeId,
                    platform:              'tiktok',
                    platform_product_id:   productId,
                    platform_sku_id:       skuId,
                    platform_model_id:     skuId,
                    platform_location_id:  null,
                    platform_warehouse_id: warehouseId,
                    product_name:          productName,
                    variation_name:        skuVariationName(sku),
                    parent_sku:            parentSku,
                    seller_sku:            sku.sellerSku ?? sku.seller_sku ?? null,
                    image_url:             imageUrl,
                    store_name:            storeName,
                    platform_stock:        stock,
                    platform_price:        toDecimalOrNull(price),
                    currency,
                    product_status:        sku.statusInfo?.status ?? status,
                    has_variants:          hasVariants,
                    weight:                productWeight,
                    length:                productLength,
                    width:                 productWidth,
                    height:                productHeight,
                    row_type:              'child',
                    synced_at:             new Date(),
                });
            }

            totalSynced++;
        }

    } while (pageToken && pageToken.length > 0);

    return totalSynced;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. syncAllStores — triggered by "Sync Product" button
// ─────────────────────────────────────────────────────────────────────────────
const syncAllStores = async (user, filters = {}) => {
    console.log("syncAllStores")
    const { PlatformStore, PlatformProduct } = require('../../models');
    const { platformStoreId, platform } = filters;

    // const storeWhere = { company_id: user.companyId, status: 'active' };
    const storeWhere = { company_id: user.companyId, is_active: true };
    if (platformStoreId) storeWhere.id = parseInt(platformStoreId, 10);
    if (platform && platform !== 'all') storeWhere.platform = platform;

    const permittedStoreIds = await getPermittedStoreIds(user, { canEdit: true });
    if (Array.isArray(permittedStoreIds)) {
        if (!permittedStoreIds.length) return { synced: 0, results: [], message: 'No permitted stores found' };
        storeWhere.id = storeWhere.id
            ? storeWhere.id
            : { [Op.in]: permittedStoreIds };
        if (platformStoreId && !permittedStoreIds.includes(Number(platformStoreId))) {
            await assertStorePermission(user, platformStoreId, { canEdit: true });
        }
    }

    const stores = await PlatformStore.findAll({ where: storeWhere });

    if (!stores.length) {
        return { synced: 0, results: [], message: 'No active stores found' };
    }

    const results = [];
    for (const store of stores) {
        try {
            let count = 0;
            if (store.platform === 'shopee') {
                count = await syncShopeeStore(store, PlatformProduct);
            } else if (store.platform === 'tiktok') {
                count = await syncTikTokStore(store, PlatformProduct);
            }

            // Keep platform_products idempotent after every Sync Product click.
            // Existing duplicate parent/variant rows from old sync code are also cleaned here.
            await cleanupDuplicatePlatformProducts(user.companyId, store.id, PlatformProduct);

            results.push({ storeName: store.store_name, platform: store.platform, synced: count });
        } catch (err) {
            console.error(`[sync] Error syncing store ${store.id}:`, err.message);
            results.push({ storeName: store.store_name, platform: store.platform, synced: 0, error: err.message });
        }
    }

    const totalSynced = results.reduce((s, r) => s + r.synced, 0);
    return {
        synced:  totalSynced,
        results,
        message: `Sync complete — ${totalSynced} product(s) updated across ${results.length} store(s)`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. getPlatformProducts — ByProductSKUMappingPage table
//    Main rows are parent products. Each parent row contains children[] variant
//    SKUs. This follows the seller/warehouse ERP logic: expand parent to see all
//    platform SKU variants and map/generate merchant SKU on the child SKU row.
// ─────────────────────────────────────────────────────────────────────────────
const getPlatformProducts = async (user, filters = {}) => {
    const { PlatformProduct, PlatformStore, PlatformSkuMapping, MerchantSku } = require('../../models');

    const {
        page            = 1,
        limit           = 20,
        platformStoreId,
        platform,
        search,
        skuType         = 'product_name',
        mappingStatus   = 'all',
    } = filters;

    const baseWhere = { company_id: user.companyId };
    if (platformStoreId) baseWhere.platform_store_id = parseInt(platformStoreId, 10);
    if (platform && platform !== 'all') baseWhere.platform = platform;

    const permittedStoreIds = await getPermittedStoreIds(user);
    if (Array.isArray(permittedStoreIds)) {
        if (!permittedStoreIds.length) {
            return { data: [], pagination: { total: 0, page: parseInt(page, 10), limit: parseInt(limit, 10), totalPages: 0 } };
        }
        if (platformStoreId && !permittedStoreIds.includes(Number(platformStoreId))) {
            await assertStorePermission(user, platformStoreId);
        } else if (!platformStoreId) {
            baseWhere.platform_store_id = { [Op.in]: permittedStoreIds };
        }
    }

    const parentWhere = { ...baseWhere, row_type: 'parent' };
    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        if (skuType === 'seller_sku') parentWhere.parent_sku = { [Op.like]: q };
        else if (skuType === 'platform_product_id') parentWhere.platform_product_id = { [Op.like]: q };
        else parentWhere.product_name = { [Op.like]: q };
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const parentRowsAll = await PlatformProduct.findAll({
        where: parentWhere,
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'store_name', 'platform'],
            required: false,
        }],
        order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
    });

    // Old sync code could create duplicate parent rows because parent rows use
    // platform_sku_id = NULL. Show each store/product only once even before the
    // next Sync Product cleanup runs.
    const parentGroups = new Map();
    for (const row of parentRowsAll) {
        const key = `${row.platform_store_id}|${row.platform_product_id}`;
        if (!parentGroups.has(key)) parentGroups.set(key, row);
        else if (Number(row.is_mapped) === 1 && Number(parentGroups.get(key).is_mapped) !== 1) parentGroups.set(key, row);
    }
    let count = parentGroups.size;
    let rows = [...parentGroups.values()].slice(offset, offset + parseInt(limit, 10));

    // Fallback for older synced data that does not have parent rows: group child
    // rows into synthetic parent-style rows by product/store.
    let syntheticFromChildren = false;
    if (!rows.length) {
        const childWhere = { ...baseWhere, row_type: 'child' };
        if (search?.trim()) {
            const q = `%${search.trim()}%`;
            if (skuType === 'seller_sku') childWhere.seller_sku = { [Op.like]: q };
            else if (skuType === 'platform_product_id') childWhere.platform_product_id = { [Op.like]: q };
            else childWhere.product_name = { [Op.like]: q };
        }
        const childRows = await PlatformProduct.findAll({
            where: childWhere,
            include: [{ model: PlatformStore, as: 'platformStore', attributes: ['id', 'store_name', 'platform'], required: false }],
            order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
        });
        const groups = new Map();
        for (const child of childRows) {
            const key = `${child.platform_store_id}:${child.platform_product_id}`;
            if (!groups.has(key)) groups.set(key, child);
        }
        rows = [...groups.values()].slice(offset, offset + parseInt(limit, 10));
        count = groups.size;
        syntheticFromChildren = true;
    }

    const childOrParentKeys = rows.map((p) => ({
        platform_store_id: p.platform_store_id,
        platform_product_id: p.platform_product_id,
    }));

    const childWhere = { ...baseWhere, row_type: 'child' };
    if (childOrParentKeys.length) {
        childWhere[Op.or] = childOrParentKeys.map((p) => ({
            platform_store_id: p.platform_store_id,
            platform_product_id: p.platform_product_id,
        }));
    }

    let children = childOrParentKeys.length ? await PlatformProduct.findAll({
        where: childWhere,
        include: [
            { model: PlatformStore, as: 'platformStore', attributes: ['id', 'store_name', 'platform'], required: false },
        ],
        order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
    }) : [];

    const childGroups = new Map();
    for (const child of children) {
        const key = `${child.platform_store_id}|${child.platform_product_id}|${child.platform_sku_id || ''}`;
        if (!childGroups.has(key)) childGroups.set(key, child);
        else if (Number(child.is_mapped) === 1 && Number(childGroups.get(key).is_mapped) !== 1) childGroups.set(key, child);
    }
    children = [...childGroups.values()];

    // Important: PlatformProduct.hasMany(PlatformSkuMapping) is only keyed by
    // platform_product_id, so a normal include can attach the first variant
    // mapping to every child row under the same parent product. Build a manual
    // lookup by store + product + child platform_sku_id to keep mapping aligned
    // with the exact child/variant SKU.
    const mappingConditions = children
        .filter((c) => c.platform_store_id && c.platform_product_id)
        .map((c) => ({
            platform_store_id: c.platform_store_id,
            platform_listing_id: c.platform_product_id,
            ...(c.platform_sku_id ? { platform_sku_id: c.platform_sku_id } : {}),
        }));

    const activeMappings = mappingConditions.length ? await PlatformSkuMapping.findAll({
        where: {
            company_id: user.companyId,
            is_active: true,
            deleted_at: null,
            [Op.or]: mappingConditions,
        },
        attributes: ['id', 'merchant_sku_id', 'platform_store_id', 'platform_listing_id', 'platform_product_id', 'platform_sku_id', 'sync_status'],
        include: [{ model: MerchantSku, as: 'merchantSku', attributes: ['id', 'sku_name', 'sku_title', 'warehouse_id'], required: false }],
    }) : [];

    const mappingsByChildKey = new Map();
    for (const m of activeMappings) {
        const key = `${m.platform_store_id}|${m.platform_listing_id || m.platform_product_id}|${m.platform_sku_id || ''}`;
        if (!mappingsByChildKey.has(key)) mappingsByChildKey.set(key, []);
        mappingsByChildKey.get(key).push(m);
    }

    // Also expose the generated Merchant SKU for each platform child SKU even
    // after the mapping was unlinked. This lets the frontend know which
    // warehouse should be used when opening the mapping/change modal. Generated
    // SKU naming requirement is seller_sku == merchant_skus.sku_name.
    const generatedSkuNames = [...new Set(children.map((c) => buildMerchantSkuName(c.platform, c.seller_sku, null, c.platform_product_id, c.platform_sku_id)).filter(Boolean).map(String))];
    const generatedSkus = generatedSkuNames.length ? await MerchantSku.findAll({
        where: {
            company_id: user.companyId,
            deleted_at: null,
            sku_name: { [Op.in]: generatedSkuNames },
        },
        attributes: ['id', 'sku_name', 'sku_title', 'warehouse_id', 'image_url'],
    }) : [];
    const generatedSkuByName = new Map(generatedSkus.map((sku) => [String(sku.sku_name), sku]));

    const getChildMappings = (p) => {
        const exact = mappingsByChildKey.get(`${p.platform_store_id}|${p.platform_product_id}|${p.platform_sku_id || ''}`) ?? [];
        if (exact.length || p.platform_sku_id) return exact;
        return mappingsByChildKey.get(`${p.platform_store_id}|${p.platform_product_id}|`) ?? [];
    };

    const mapChild = (p) => {
        const childMappings = getChildMappings(p);
        const generatedSkuName = buildMerchantSkuName(p.platform, p.seller_sku, null, p.platform_product_id, p.platform_sku_id);
        const generatedSku = generatedSkuName ? generatedSkuByName.get(String(generatedSkuName)) : null;
        return ({
        id:                   p.id,
        platform:             p.platform,
        platform_store_id:    p.platform_store_id,
        platform_product_id:  p.platform_product_id,
        platform_sku_id:      p.platform_sku_id,
        platform_model_id:    p.platform_model_id,
        platform_location_id: p.platform_location_id,
        platform_warehouse_id:p.platform_warehouse_id,
        product_name:         p.product_name,
        variation_name:       p.variation_name,
        parent_sku:           p.parent_sku,
        seller_sku:           p.seller_sku,
        image_url:            p.image_url,
        store_name:           p.platformStore?.store_name ?? p.store_name,
        platform_stock:       p.platform_stock,
        platform_price:       p.platform_price,
        currency:             p.currency,
        product_status:       p.product_status,
        has_variants:         !!p.has_variants,
        weight:               p.weight,
        length:               p.length,
        width:                p.width,
        height:               p.height,
        mappings:             childMappings.map((m) => ({ id: m.id, merchant_sku_id: m.merchant_sku_id, merchant_sku: m.merchantSku, sync_status: m.sync_status })),
        is_mapped:            childMappings.length > 0,
        mapping_id:           childMappings?.[0]?.id ?? null,
        merchant_sku:         childMappings?.[0]?.merchantSku ?? null,
        generated_merchant_sku: generatedSku ? {
            id:           generatedSku.id,
            sku_name:     generatedSku.sku_name,
            sku_title:    generatedSku.sku_title,
            warehouse_id: generatedSku.warehouse_id,
            image_url:    generatedSku.image_url,
        } : null,
        sync_status:          childMappings?.[0]?.sync_status ?? null,
        row_type:             'child',
        });
    };

    let data = rows.map((p) => {
        const childRows = children.filter((c) => c.platform_store_id === p.platform_store_id && c.platform_product_id === p.platform_product_id);
        const mappedChildren = childRows.filter((c) => getChildMappings(c).length > 0);
        const parentRow = {
            id:                   syntheticFromChildren ? `parent-${p.platform_store_id}-${p.platform_product_id}` : p.id,
            platform:             p.platform,
            platform_store_id:    p.platform_store_id,
            platform_product_id:  p.platform_product_id,
            platform_sku_id:      p.platform_sku_id,
            platform_model_id:    p.platform_model_id,
            product_name:         p.product_name,
            variation_name:       null,
            parent_sku:           p.parent_sku || childRows[0]?.parent_sku || '—',
            seller_sku:           null,
            image_url:            p.image_url || childRows[0]?.image_url,
            store_name:           p.platformStore?.store_name ?? p.store_name,
            is_mapped:            mappedChildren.length > 0,
            mapping_count:        mappedChildren.length,
            children:             childRows.map(mapChild),
            row_type:             'parent',
        };
        return parentRow;
    });

    if (mappingStatus === 'mapped') data = data.filter((p) => p.is_mapped);
    if (mappingStatus === 'unmapped') data = data.filter((p) => !p.is_mapped);

    return {
        data,
        pagination: {
            total:      count,
            page:       parseInt(page, 10),
            limit:      parseInt(limit, 10),
            totalPages: Math.ceil(count / parseInt(limit, 10)),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. getPlatformProductCounts — tab badges for parent product rows
// ─────────────────────────────────────────────────────────────────────────────
const getPlatformProductCounts = async (user, filters = {}) => {
    const { sequelize } = require('../../config/database');
    const { platformStoreId, platform } = filters;

    const storeClause    = platformStoreId ? `AND pp.platform_store_id = :storeId` : '';
    const platformClause = platform && platform !== 'all' ? `AND pp.platform = :platform` : '';

    const [result] = await sequelize.query(
        `SELECT
             COUNT(DISTINCT pp.id) AS \`all\`,
             COUNT(DISTINCT CASE WHEN COALESCE(cmap.mapped_count, 0) > 0 OR pp.is_mapped = 1 THEN pp.id END) AS mapped,
             COUNT(DISTINCT CASE WHEN COALESCE(cmap.mapped_count, 0) = 0 AND pp.is_mapped = 0 THEN pp.id END) AS unmapped
         FROM platform_products pp
         LEFT JOIN (
             SELECT platform_store_id, platform_product_id, SUM(CASE WHEN is_mapped = 1 THEN 1 ELSE 0 END) AS mapped_count
             FROM platform_products
             WHERE company_id = :companyId AND row_type = 'child'
             GROUP BY platform_store_id, platform_product_id
         ) cmap ON cmap.platform_store_id = pp.platform_store_id AND cmap.platform_product_id = pp.platform_product_id
         WHERE pp.company_id = :companyId
           AND pp.row_type = 'parent'
           ${storeClause}
           ${platformClause}`,
        {
            replacements: {
                companyId: user.companyId,
                storeId:   platformStoreId ? parseInt(platformStoreId, 10) : null,
                platform:  platform ?? null,
            },
            type: sequelize.QueryTypes.SELECT,
        }
    );

    return {
        all:      parseInt(result?.all      ?? 0, 10),
        mapped:   parseInt(result?.mapped   ?? 0, 10),
        unmapped: parseInt(result?.unmapped ?? 0, 10),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. generateMerchantSku
//    Creates a merchant_sku record from a selected platform product row.
//    Then creates a platform_sku_mapping linking them.
//    Body: { platformProductIds: [1,2,3], warehouseId: 1 }
// ─────────────────────────────────────────────────────────────────────────────
const generateMerchantSku = async (user, body) => {
    const {
        PlatformProduct,
        MerchantSku,
        SkuWarehouseStock,
        PlatformSkuMapping,
        PlatformStore,
        Warehouse,
    } = require('../../models');

    const { platformProductIds, warehouseId } = body;
    const parsedWarehouseId = parseInt(warehouseId, 10);

    if (!Array.isArray(platformProductIds) || !platformProductIds.length) {
        const err = new Error('Please select at least one SKU.');
        err.statusCode = 400;
        throw err;
    }

    if (!parsedWarehouseId) {
        const err = new Error('Warehouse is required');
        err.statusCode = 400;
        throw err;
    }

    const warehouse = await Warehouse.findOne({
        where: {
            id: parsedWarehouseId,
            company_id: user.companyId,
        },
    });

    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    const products = await PlatformProduct.findAll({
        where: {
            id: { [Op.in]: platformProductIds },
            company_id: user.companyId,
            row_type: 'child',
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher'],
            required: false,
        }],
    });

    if (!products.length) {
        const err = new Error('No valid child SKU rows found');
        err.statusCode = 404;
        throw err;
    }

    const created = [];
    const warehouseCode = getWarehouseCode(warehouse);

    for (const product of products) {
        const skuName = buildMerchantSkuName(
            product.platform,
            product.seller_sku,
            warehouseCode,
            product.platform_product_id,
            product.platform_sku_id
        );

        const skuTitle = product.variation_name
            ? `${product.product_name} - ${product.variation_name}`
            : product.product_name;

        const productDetails = JSON.stringify({
            source: 'platform_products',
            platform: product.platform,
            platform_store_id: product.platform_store_id,
            platform_product_id: product.platform_product_id,
            platform_sku_id: product.platform_sku_id,
            seller_sku: product.seller_sku,
            variant_name: product.variation_name,
        });

        const [msku, wasCreated] = await MerchantSku.findOrCreate({
            where: {
                company_id: user.companyId,
                sku_name: skuName,
            },
            defaults: {
                company_id: user.companyId,
                warehouse_id: parsedWarehouseId,
                sku_name: skuName,
                sku_title: skuTitle,
                product_details: productDetails,
                gtin: product.gtin || null,
                weight: product.weight,
                length: product.length,
                width: product.width,
                height: product.height,
                price: product.platform_price,
                image_url: product.image_url,
                status: 'active',
                created_by: user.userId,
            },
        });

        if (!wasCreated) {
            await msku.update({
                warehouse_id: msku.warehouse_id || parsedWarehouseId,
                sku_title: skuTitle,
                product_details: productDetails,
                ...(product.gtin ? { gtin: product.gtin } : {}),
                weight: product.weight ?? msku.weight,
                length: product.length ?? msku.length,
                width: product.width ?? msku.width,
                height: product.height ?? msku.height,
                price: product.platform_price ?? msku.price,
                image_url: product.image_url ?? msku.image_url,
            });
        }

        const [stockRow, stockCreated] = await SkuWarehouseStock.findOrCreate({
            where: {
                merchant_sku_id: msku.id,
                warehouse_id: parsedWarehouseId,
            },
            defaults: {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                warehouse_id: parsedWarehouseId,
                qty_on_hand: product.platform_stock || 0,
                qty_reserved: 0,
                qty_inbound: 0,
            },
        });

        if (!stockCreated) {
            await stockRow.update({
                qty_on_hand: product.platform_stock ?? stockRow.qty_on_hand,
            });
        }

        // A platform child/variant SKU should be mapped by its own platform_sku_id,
        // not only by parent product/store. This prevents every variant under the
        // same parent from showing the first generated Merchant SKU.
        await PlatformSkuMapping.update(
            { is_active: false, deleted_at: new Date() },
            {
                where: {
                    company_id: user.companyId,
                    platform_store_id: product.platform_store_id,
                    platform_listing_id: product.platform_product_id,
                    platform_sku_id: product.platform_sku_id,
                    is_active: true,
                    deleted_at: null,
                    merchant_sku_id: { [Op.ne]: msku.id },
                },
            }
        );

        const mappingDefaults = {
            company_id: user.companyId,
            merchant_sku_id: msku.id,
            ...buildPlatformMappingFields(product, product.platformStore, parsedWarehouseId, user.userId),
        };

        const [mapping, mappingCreated] = await PlatformSkuMapping.findOrCreate({
            where: {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                platform_store_id: product.platform_store_id,
                platform_listing_id: product.platform_product_id,
                platform_sku_id: product.platform_sku_id,
            },
            defaults: mappingDefaults,
            paranoid: false,
        });

        if (!mappingCreated) {
            await mapping.update({
                ...mappingDefaults,
                is_active: true,
                deleted_at: null,
            }, { paranoid: false });
        }

        await product.update({ is_mapped: true });

        created.push({
            platformProductId: product.id,
            merchantSkuId: msku.id,
            skuName: msku.sku_name,
            wasCreated,
            mappingCreated,
        });
    }

    return {
        created: created.length,
        skus: created,
        message: `${created.length} Merchant SKU(s) generated successfully`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. autoMapping
//    Matches platform products to merchant SKUs by comparing seller_sku → sku_name.
//    Body: { platformProductIds?: [1,2], warehouseId: 1 }
//    If platformProductIds is empty → try to auto-map ALL unmapped products.
// ─────────────────────────────────────────────────────────────────────────────
const autoMapping = async (user, body) => {
    const {
        PlatformProduct,
        MerchantSku,
        PlatformSkuMapping,
        PlatformStore,
    } = require('../../models');

    const {
        platformProductIds = [],
        platformStoreIds = [],
        platformStoreId,
        storeIds = [],
        storeId,
        selectedStoreIds = [],
        platform,
    } = body;

    const targetStoreIds = [
        ...platformStoreIds,
        ...storeIds,
        ...selectedStoreIds,
        ...(platformStoreId ? [platformStoreId] : []),
        ...(storeId ? [storeId] : []),
    ].map((id) => parseInt(id, 10)).filter(Boolean);

    const selectedPlatformProductIds = Array.isArray(platformProductIds)
        ? platformProductIds.map((id) => parseInt(id, 10)).filter(Boolean)
        : [];

    const sourceWhere = { company_id: user.companyId, row_type: 'child' };
    if (selectedPlatformProductIds.length) sourceWhere.id = { [Op.in]: selectedPlatformProductIds };
    else sourceWhere.is_mapped = 0;
    if (targetStoreIds.length) sourceWhere.platform_store_id = { [Op.in]: targetStoreIds };
    if (platform && platform !== 'all') sourceWhere.platform = platform;

    const sourceProducts = await PlatformProduct.findAll({
        where: sourceWhere,
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'platform', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher'],
            required: false,
        }],
    });

    if (!sourceProducts.length) {
        const err = new Error('No platform SKU rows found for auto mapping.');
        err.statusCode = 404;
        throw err;
    }

    const mapped = [];
    const failed = [];

    for (const product of sourceProducts) {
        let merchantSku = null;

        // Auto mapping must use the child/variant seller SKU, not any previous
        // parent/product-level mapping row. Older inactive/wrong mappings are
        // intentionally ignored here.

        if (product.seller_sku) {
            merchantSku = await MerchantSku.findOne({
                where: {
                    company_id: user.companyId,
                    deleted_at: null,
                    [Op.or]: [
                        // Child/variant seller SKU must be the primary match.
                        // Do not match by parent SKU or loose "%seller_sku%" text.
                        { sku_name: product.seller_sku },
                        { product_details: { [Op.like]: `%${product.platform_product_id}%${product.platform_sku_id ?? ''}%` } },
                    ],
                },
                order: [['updated_at', 'DESC']],
            });
        }

        if (!merchantSku) {
            failed.push({
                platformProductId: product.id,
                sellerSku: product.seller_sku,
                productName: product.product_name,
                reason: 'Merchant SKU has not been generated yet',
            });
            continue;
        }

        await PlatformSkuMapping.update(
            { is_active: false, deleted_at: new Date() },
            {
                where: {
                    company_id: user.companyId,
                    platform_store_id: product.platform_store_id,
                    platform_listing_id: product.platform_product_id,
                    platform_sku_id: product.platform_sku_id,
                    is_active: true,
                    deleted_at: null,
                    merchant_sku_id: { [Op.ne]: merchantSku.id },
                },
            }
        );

        const [mapping, wasCreated] = await PlatformSkuMapping.findOrCreate({
            where: {
                company_id: user.companyId,
                merchant_sku_id: merchantSku.id,
                platform_store_id: product.platform_store_id,
                platform_listing_id: product.platform_product_id,
                platform_sku_id: product.platform_sku_id,
            },
            defaults: {
                company_id: user.companyId,
                merchant_sku_id: merchantSku.id,
                ...buildPlatformMappingFields(product, product.platformStore, merchantSku.warehouse_id, user.userId),
            },
        });

        if (!wasCreated) {
            await mapping.update({
                is_active: true,
                deleted_at: null,
                ...buildPlatformMappingFields(product, product.platformStore, merchantSku.warehouse_id, user.userId),
            }, { paranoid: false });
        }

        await product.update({ is_mapped: true });

        mapped.push({
            platformProductId: product.id,
            sellerSku: product.seller_sku,
            productName: product.product_name,
            storeId: product.platform_store_id,
            merchantSkuId: merchantSku.id,
            merchantSku: merchantSku.sku_name,
            wasCreated,
        });
    }

    return {
        matched: mapped.length,
        skipped: failed.length,
        total: sourceProducts.length,
        mapped,
        failed,
        message: `Auto mapping complete — ${mapped.length} mapped, ${failed.length} failed`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. updatePlatformStock
//    Pushes stock quantity back to the platform after mapping or stock change.
//    Called after mapping is created and when stock changes in Node.js.
//    Body: { mappingId, newQty }
// ─────────────────────────────────────────────────────────────────────────────
const updatePlatformStock = async (user, body) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');

    const { mappingId, newQty } = body;

    const mapping = await PlatformSkuMapping.findOne({
        where:   { id: mappingId, company_id: user.companyId, is_active: true },
        include: [{ model: PlatformStore, as: 'platformStore' }],
    });

    if (!mapping) {
        const err = new Error('Mapping not found');
        err.statusCode = 404; throw err;
    }

    const platform = mapping.platformStore?.platform;
    let result;

    if (platform === 'shopee') {
        // POST /shopee-open-shop/api/dev/product/update_stock/:shopId
        const shopId = mapping.platformStore?.store_shop_id;
        result = await javaApi.post(
            `/shopee-open-shop/api/dev/product/update_stock/${shopId}`,
            {
                item_id:  parseInt(mapping.platform_listing_id, 10),
                model_id: parseInt(mapping.platform_model_id, 10),
                stock:    newQty,
            }
        );
    } else if (platform === 'tiktok') {
        // POST /tiktokshop-partner/api/dev/products/updateStock
        const openId  = mapping.platformStore?.store_open_id;
        const cipher  = mapping.platformStore?.store_cipher;
        result = await javaApi.post(
            `/tiktokshop-partner/api/dev/products/updateStock`,
            {
                skus: [{
                    id:        mapping.platform_sku_id,
                    inventory: [{ quantity: newQty, warehouseId: mapping.platform_warehouse_id }],
                }],
            },
            { params: { productId: mapping.platform_listing_id, openId, cipher } }
        );
    } else {
        return { skipped: true, reason: `Platform ${platform} stock push not implemented yet` };
    }

    // Update sync status
    await mapping.update({ sync_status: 'synced', last_synced_at: new Date() });

    return { pushed: true, platform, newQty, response: result?.data };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. unlinkMapping — remove a platform_sku_mapping (unmap action)
// ─────────────────────────────────────────────────────────────────────────────
const unlinkMapping = async (user, mappingId) => {
    const { PlatformSkuMapping, PlatformProduct } = require('../../models');

    const mapping = await PlatformSkuMapping.findOne({
        where: { id: mappingId, company_id: user.companyId },
    });
    if (!mapping) {
        const err = new Error('Mapping not found');
        err.statusCode = 404; throw err;
    }

    // Soft-delete the mapping
    await mapping.update({ is_active: false, deleted_at: new Date() });

    const remaining = await PlatformSkuMapping.count({
        where: {
            company_id: user.companyId,
            platform_store_id: mapping.platform_store_id,
            platform_listing_id: mapping.platform_listing_id,
            platform_sku_id: mapping.platform_sku_id,
            is_active: true,
            deleted_at: null,
        },
    });

    await PlatformProduct.update(
        { is_mapped: remaining > 0 ? 1 : 0 },
        {
            where: {
                company_id:          user.companyId,
                platform_store_id:   mapping.platform_store_id,
                platform_product_id: mapping.platform_listing_id,
                platform_sku_id:     mapping.platform_sku_id,
            },
        }
    );

    return { unlinked: mappingId, remainingMappings: remaining };
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. getMerchantSkuOptionsForProduct
//    Product-side mapping modal options. It derives the warehouse from the
//    current mapping first, then from the generated Merchant SKU (seller_sku),
//    and returns all Merchant SKUs from that same warehouse.
// ─────────────────────────────────────────────────────────────────────────────
const getMerchantSkuOptionsForProduct = async (user, productId, filters = {}) => {
    const {
        PlatformProduct,
        PlatformSkuMapping,
        MerchantSku,
        PlatformStore,
    } = require('../../models');

    const { search } = filters;
    const parsedProductId = parseInt(productId, 10);

    const platformProduct = await PlatformProduct.findOne({
        where: {
            id: parsedProductId,
            company_id: user.companyId,
            row_type: 'child',
        },
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'store_name', 'platform'],
            required: false,
        }],
    });

    if (!platformProduct) {
        const err = new Error('Platform product SKU not found');
        err.statusCode = 404;
        throw err;
    }

    const currentMapping = await PlatformSkuMapping.findOne({
        where: {
            company_id: user.companyId,
            platform_store_id: platformProduct.platform_store_id,
            platform_sku_id: platformProduct.platform_sku_id,
            is_active: true,
            deleted_at: null,
            [Op.or]: [
                { platform_listing_id: platformProduct.platform_product_id },
                { platform_product_id: platformProduct.platform_product_id },
            ],
        },
        include: [{
            model: MerchantSku,
            as: 'merchantSku',
            attributes: ['id', 'sku_name', 'sku_title', 'warehouse_id', 'image_url'],
            required: false,
        }],
        order: [['updated_at', 'DESC'], ['id', 'DESC']],
    });

    const generatedMerchantSku = platformProduct.seller_sku ? await MerchantSku.findOne({
        where: {
            company_id: user.companyId,
            deleted_at: null,
            sku_name: buildMerchantSkuName(platformProduct.platform, platformProduct.seller_sku, null, platformProduct.platform_product_id, platformProduct.platform_sku_id),
        },
        attributes: ['id', 'sku_name', 'sku_title', 'warehouse_id', 'image_url'],
    }) : null;

    const currentMerchantSku = currentMapping?.merchantSku || null;
    const warehouseId = currentMerchantSku?.warehouse_id || generatedMerchantSku?.warehouse_id || null;

    if (!warehouseId) {
        return {
            canMap: false,
            message: 'First generate Merchant SKU for this platform SKU.',
            warehouseId: null,
            platformProduct: {
                id: platformProduct.id,
                product_name: platformProduct.product_name,
                seller_sku: platformProduct.seller_sku,
                platform_product_id: platformProduct.platform_product_id,
                platform_sku_id: platformProduct.platform_sku_id,
                store_name: platformProduct.platformStore?.store_name ?? platformProduct.store_name,
                platform: platformProduct.platform,
            },
            currentMerchantSku: null,
            generatedMerchantSku: null,
            merchantSkus: [],
        };
    }

    const skuWhere = {
        company_id: user.companyId,
        deleted_at: null,
        warehouse_id: warehouseId,
    };

    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        skuWhere[Op.or] = [
            { sku_name: { [Op.like]: q } },
            { sku_title: { [Op.like]: q } },
        ];
    }

    const merchantSkus = await MerchantSku.findAll({
        where: skuWhere,
        attributes: ['id', 'sku_name', 'sku_title', 'warehouse_id', 'image_url'],
        order: [['sku_name', 'ASC']],
        limit: 100,
    });

    const currentId = currentMerchantSku?.id ? String(currentMerchantSku.id) : null;
    const generatedId = generatedMerchantSku?.id ? String(generatedMerchantSku.id) : null;

    return {
        canMap: true,
        message: 'Merchant SKU options fetched',
        warehouseId,
        platformProduct: {
            id: platformProduct.id,
            product_name: platformProduct.product_name,
            variation_name: platformProduct.variation_name,
            seller_sku: platformProduct.seller_sku,
            platform_product_id: platformProduct.platform_product_id,
            platform_sku_id: platformProduct.platform_sku_id,
            store_name: platformProduct.platformStore?.store_name ?? platformProduct.store_name,
            platform: platformProduct.platform,
        },
        currentMerchantSku: currentMerchantSku ? {
            id: currentMerchantSku.id,
            sku_name: currentMerchantSku.sku_name,
            sku_title: currentMerchantSku.sku_title,
            warehouse_id: currentMerchantSku.warehouse_id,
            image_url: currentMerchantSku.image_url,
        } : null,
        generatedMerchantSku: generatedMerchantSku ? {
            id: generatedMerchantSku.id,
            sku_name: generatedMerchantSku.sku_name,
            sku_title: generatedMerchantSku.sku_title,
            warehouse_id: generatedMerchantSku.warehouse_id,
            image_url: generatedMerchantSku.image_url,
        } : null,
        merchantSkus: merchantSkus.map((sku) => ({
            id: sku.id,
            sku_name: sku.sku_name,
            sku_title: sku.sku_title,
            warehouse_id: sku.warehouse_id,
            image_url: sku.image_url,
            is_current: currentId === String(sku.id),
            is_generated: generatedId === String(sku.id),
        })),
    };
};

/**
 * mapMerchantSkuToProduct
 *
 * Creates a platform_sku_mapping row that links a platform product row
 * (from platform_products table) to a merchant SKU — triggered when
 * the user clicks "Add Mapping with Store" on an UNMAPPED product row
 * in ByProductSKUMappingPage and selects a merchant SKU from the modal.
 *
 * @param {object} user            - req.user (companyId, userId)
 * @param {object} body
 * @param {number} body.platformProductId - ID from platform_products table
 * @param {number} body.merchantSkuId     - ID from merchant_skus table
 */
const mapMerchantSkuToProduct = async (user, body) => {
    const {
        PlatformProduct,
        PlatformSkuMapping,
        MerchantSku,
        PlatformStore,
    } = require('../../models');
 
    const { platformProductId, merchantSkuId } = body;
 
    // ── 1. Load the platform product row ─────────────────────────────────────
    const platformProduct = await PlatformProduct.findOne({
        where: { id: platformProductId, company_id: user.companyId },
        include: [{
            model:      PlatformStore,
            as:         'platformStore',
            attributes: ['id', 'platform', 'store_shop_id', 'store_open_id', 'store_cipher'],
        }],
    });
    if (!platformProduct) {
        const err = new Error('Platform product not found');
        err.statusCode = 404;
        throw err;
    }
 
    // ── 2. Load the merchant SKU row ──────────────────────────────────────────
    const merchantSku = await MerchantSku.findOne({
        where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
        attributes: ['id', 'sku_name', 'warehouse_id'],
    });
    if (!merchantSku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }
 
    // ── 3. Prevent duplicate active mapping ───────────────────────────────────
    const existing = await PlatformSkuMapping.findOne({
        where: {
            company_id:            user.companyId,
            platform_store_id:     platformProduct.platform_store_id,
            platform_listing_id:   platformProduct.platform_product_id,
            platform_sku_id:       platformProduct.platform_sku_id,
            merchant_sku_id:       merchantSkuId,
            is_active:             true,
            deleted_at:            null,
        },
    });
    if (existing) {
        const err = new Error(
            `${merchantSku.sku_name} is already mapped to this platform product`
        );
        err.statusCode = 409;
        throw err;
    }
 
    // ── 4. Create/restore the mapping row for this exact child SKU ──────────
    await PlatformSkuMapping.update(
        { is_active: false, deleted_at: new Date() },
        {
            where: {
                company_id: user.companyId,
                platform_store_id: platformProduct.platform_store_id,
                platform_listing_id: platformProduct.platform_product_id,
                platform_sku_id: platformProduct.platform_sku_id,
                is_active: true,
                deleted_at: null,
                merchant_sku_id: { [Op.ne]: merchantSkuId },
            },
        }
    );

    const mappingDefaults = {
        company_id:      user.companyId,
        merchant_sku_id: merchantSkuId,
        combine_sku_id:  null,
        ...buildPlatformMappingFields(platformProduct, platformProduct.platformStore, merchantSku.warehouse_id, user.userId),
    };

    const [mapping, createdMapping] = await PlatformSkuMapping.findOrCreate({
        where: {
            company_id: user.companyId,
            merchant_sku_id: merchantSkuId,
            platform_store_id: platformProduct.platform_store_id,
            platform_listing_id: platformProduct.platform_product_id,
            platform_sku_id: platformProduct.platform_sku_id,
        },
        defaults: mappingDefaults,
        paranoid: false,
    });
    if (!createdMapping) {
        await mapping.update({ ...mappingDefaults, is_active: true, deleted_at: null }, { paranoid: false });
    }
 
    // ── 5. Mark the platform product row as mapped ────────────────────────────
    await PlatformProduct.update(
        { is_mapped: 1 },
        {
            where: {
                company_id:          user.companyId,
                platform_store_id:   platformProduct.platform_store_id,
                platform_product_id: platformProduct.platform_product_id,
                platform_sku_id:     platformProduct.platform_sku_id,
            },
        }
    );
 
    return {
        message:     `${merchantSku.sku_name} mapped successfully`,
        mappingId:   mapping.id,
        merchantSku: merchantSku.sku_name,
        platform:    platformProduct.platform,
    };
};

module.exports = {
    syncAllStores,
    getPlatformProducts,
    getPlatformProductCounts,
    generateMerchantSku,
    autoMapping,
    updatePlatformStock,
    unlinkMapping,
    getMerchantSkuOptionsForProduct,
    mapMerchantSkuToProduct,
};
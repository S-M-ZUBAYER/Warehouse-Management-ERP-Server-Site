// 'use strict';

// /**
//  * platformProducts.service.js
//  *
//  * Handles syncing products from:
//  *   - Shopee  → via Java proxy at JAVA_API_URL/shopee-open-shop/api/dev/
//  *   - TikTok  → via Java proxy at JAVA_API_URL/tiktokshop-partner/api/dev/
//  *
//  * Stores results into platform_products table (migration 017).
//  *
//  * Exports:
//  *   syncAllStores(user)            → sync all active stores for the company
//  *   syncStore(user, platformStore) → sync one store
//  *   getPlatformProducts(user, q)   → paginated list for ByProduct page
//  *   getPlatformProductCounts(user) → { all, mapped, unmapped } for tabs
//  *   generateMerchantSku(user, body)→ create merchant SKU from platform product
//  *   autoMapping(user, body)        → auto-match platform products to merchant SKUs
//  *   updatePlatformStock(user,body) → push stock back to platform after mapping
//  *   unlinkMapping(user, mappingId) → remove a platform_sku_mapping row
//  */

// const axios  = require('axios');
// const { Op } = require('sequelize');

// const JAVA_BASE = process.env.JAVA_API_URL ?? 'http://localhost:8080';

// // ─── Axios instance for Java proxy ───────────────────────────────────────────
// const javaApi = axios.create({
//     baseURL: JAVA_BASE,
//     timeout: 30000,
//     headers: { 'Content-Type': 'application/json' },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // INTERNAL: Sync helpers per platform
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * syncShopeeStore
//  * Calls Java proxy: GET /shopee-open-shop/api/dev/product/get_item_list/:shopId
//  * Paginates using next_offset until has_next_page = false.
//  * For each item, calls GET /shopee-open-shop/api/dev/product/get_item/:shopId?itemId=
//  * to retrieve models (variations) with their model_id, model_sku, stock, location_id.
//  */
// const syncShopeeStore = async (store, PlatformProduct) => {
//     console.log("Start syncShop");

//     const shopId    = store.store_shop_id;
//     const storeId   = store.id;
//     const companyId = store.company_id;
//     const storeName = store.store_name;

//     let offset      = 0;
//     const pageSize  = 100;
//     let hasNextPage = true;
//     let totalSynced = 0;

//     while (hasNextPage) {
//         const listRes = await javaApi.post(
//             `http://192.168.1.222:8080/shopee-open-shop/api/dev/product/get`,
//             {
//                 offset,
//                 page_size:   pageSize,
//                 item_status: ['NORMAL'],
//             },
//             { params: { shopId } }
//         );

//         const items      = listRes.data?.products ?? [];
//         hasNextPage      = listRes.data?.has_next_page ?? false;   // ✅ fixed path
//         const nextOffset = listRes.data?.next_offset ?? 0;         // ✅ fixed path

//         console.log('list res:', items);

//         for (const item of items) {
//             const itemId      = item.item_id;
//             const imageUrl    = item.image?.image_url_list?.[0] ?? null;
//             const productName = item.item_name ?? '';
//             const models      = item.models ?? [];                 // ✅ already in /get response

//             console.log("current item:", item);

//             // Upsert parent row
//             await PlatformProduct.upsert({
//                 company_id:           companyId,
//                 platform_store_id:    storeId,
//                 platform:             'shopee',
//                 platform_product_id:  String(itemId),
//                 platform_sku_id:      null,
//                 platform_model_id:    null,
//                 platform_location_id: null,
//                 product_name:         productName,
//                 variation_name:       null,
//                 parent_sku:           item.item_sku ?? null,
//                 seller_sku:           null,
//                 image_url:            imageUrl,
//                 store_name:           storeName,
//                 platform_stock:       0,
//                 platform_price:       null,
//                 currency:             null,
//                 row_type:             'parent',
//                 synced_at:            new Date(),
//             });

//             // Upsert each model (child row)
//             for (const model of models) {
//                 const modelId    = String(model.model_id ?? '');
//                 const stock      = model.stock_info_v2?.summary_info?.total_available_stock ?? 0;
//                 const locationId = model.stock_info_v2?.seller_stock?.[0]?.location_id ?? null;
//                 const price      = model.price_info?.[0]?.current_price ?? null;
//                 const currency   = model.price_info?.[0]?.currency ?? null;

//                 await PlatformProduct.upsert({
//                     company_id:           companyId,
//                     platform_store_id:    storeId,
//                     platform:             'shopee',
//                     platform_product_id:  String(itemId),
//                     platform_sku_id:      modelId,
//                     platform_model_id:    modelId,
//                     platform_location_id: locationId,
//                     product_name:         productName,
//                     variation_name:       model.model_name ?? null,
//                     parent_sku:           item.item_sku ?? null,
//                     seller_sku:           model.model_sku ?? null,
//                     image_url:            imageUrl,
//                     store_name:           storeName,
//                     platform_stock:       stock,
//                     platform_price:       price,
//                     currency,
//                     row_type:             'child',
//                     synced_at:            new Date(),
//                 });
//             }

//             totalSynced++;
//         }

//         if (!hasNextPage || items.length === 0) break;
//         offset = nextOffset;
//     }

//     return totalSynced;
// };

// /**
//  * syncTikTokStore
//  * Calls Java proxy: POST /tiktokshop-partner/api/dev/products/get/pagination
//  * Paginates using nextPageToken until it is null/empty.
//  * Each product has skus[] — each SKU is a child row.
//  */
// const syncTikTokStore = async (store, PlatformProduct) => {
//     const openId     = store.store_open_id;
//     const cipher     = store.store_cipher;
//     const storeId    = store.id;
//     const companyId  = store.company_id;
//     const storeName  = store.store_name;

//     let pageToken    = null;
//     const pageSize   = 100;
//     let totalSynced  = 0;

//     do {
//         const params = { openId, cipher, pageSize };
//         if (pageToken) params.pageToken = pageToken;

//         const res = await javaApi.post(
//             `http://192.168.1.222:8080/tiktokshop-partner/api/dev/products/get/pagination`,
//             { status: 'ACTIVATE' },
//             { params }
//         );

//         if (res.data?.code !== 0) {
//             console.error('[TikTok sync] API error:', res.data);
//             break;
//         }

//         const products = res.data?.data?.products ?? [];
//         pageToken      = res.data?.data?.nextPageToken ?? null;

//         for (const product of products) {
//             const productId   = String(product.id ?? '');
//             const productName = product.title ?? '';

//             // Parent row
//             await PlatformProduct.upsert({
//                 company_id:           companyId,
//                 platform_store_id:    storeId,
//                 platform:             'tiktok',
//                 platform_product_id:  productId,
//                 platform_sku_id:      null,
//                 platform_warehouse_id:null,
//                 product_name:         productName,
//                 variation_name:       null,
//                 parent_sku:           null,
//                 seller_sku:           null,
//                 image_url:            null,
//                 store_name:           storeName,
//                 platform_stock:       0,
//                 platform_price:       null,
//                 currency:             null,
//                 row_type:             'parent',
//                 synced_at:            new Date(),
//             });

//             // Child rows — one per SKU
//             for (const sku of (product.skus ?? [])) {
//                 const skuId       = String(sku.id ?? '');
//                 const warehouseId = sku.inventory?.[0]?.warehouseId ?? null;
//                 const stock       = sku.inventory?.[0]?.quantity ?? 0;
//                 const price       = sku.price?.taxExclusivePrice ?? null;
//                 const currency    = sku.price?.currency ?? null;

//                 await PlatformProduct.upsert({
//                     company_id:           companyId,
//                     platform_store_id:    storeId,
//                     platform:             'tiktok',
//                     platform_product_id:  productId,
//                     platform_sku_id:      skuId,
//                     platform_warehouse_id:warehouseId,
//                     product_name:         productName,
//                     variation_name:       sku.sellerSku ?? null,
//                     parent_sku:           null,
//                     seller_sku:           sku.sellerSku ?? null,
//                     image_url:            null,
//                     store_name:           storeName,
//                     platform_stock:       stock,
//                     platform_price:       price ? parseFloat(price) : null,
//                     currency,
//                     row_type:             'child',
//                     synced_at:            new Date(),
//                 });
//             }

//             totalSynced++;
//         }

//     } while (pageToken && pageToken.length > 0);

//     return totalSynced;
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 1. syncAllStores — triggered by "Sync Product" button
// // ─────────────────────────────────────────────────────────────────────────────
// const syncAllStores = async (user, filters = {}) => {
//     console.log("syncAllStores")
//     const { PlatformStore, PlatformProduct } = require('../../models');
//     const { platformStoreId } = filters;

//     // const storeWhere = { company_id: user.companyId, status: 'active' };
//     const storeWhere = { company_id: user.companyId, is_active: true };
//     if (platformStoreId) storeWhere.id = parseInt(platformStoreId, 10);

//     const stores = await PlatformStore.findAll({ where: storeWhere });

//     if (!stores.length) {
//         return { synced: 0, results: [], message: 'No active stores found' };
//     }

//     const results = [];
//     for (const store of stores) {
//         try {
//             let count = 0;
//             if (store.platform === 'shopee') {
//                 count = await syncShopeeStore(store, PlatformProduct);
//             } else if (store.platform === 'tiktok') {
//                 count = await syncTikTokStore(store, PlatformProduct);
//             }
//             results.push({ storeName: store.store_name, platform: store.platform, synced: count });
//         } catch (err) {
//             console.error(`[sync] Error syncing store ${store.id}:`, err.message);
//             results.push({ storeName: store.store_name, platform: store.platform, synced: 0, error: err.message });
//         }
//     }

//     const totalSynced = results.reduce((s, r) => s + r.synced, 0);
//     return {
//         synced:  totalSynced,
//         results,
//         message: `Sync complete — ${totalSynced} product(s) updated across ${results.length} store(s)`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 2. getPlatformProducts — ByProductSKUMappingPage table
// // ─────────────────────────────────────────────────────────────────────────────
// const getPlatformProducts = async (user, filters = {}) => {
//     const { PlatformProduct, PlatformStore, PlatformSkuMapping, MerchantSku } = require('../../models');

//     const {
//         page            = 1,
//         limit           = 20,
//         platformStoreId,
//         platform,
//         search,
//         skuType         = 'product_name',  // product_name | seller_sku | platform_product_id
//         mappingStatus   = 'all',           // all | mapped | unmapped
//     } = filters;

//     const where = {
//         company_id: user.companyId,
//         row_type:   'child',   // only show child rows in the main table
//     };

//     if (platformStoreId) where.platform_store_id = parseInt(platformStoreId, 10);
//     if (platform && platform !== 'all') where.platform = platform;

//     if (search?.trim()) {
//         const q = `%${search.trim()}%`;
//         if (skuType === 'seller_sku')          where.seller_sku          = { [Op.like]: q };
//         else if (skuType === 'platform_product_id') where.platform_product_id = { [Op.like]: q };
//         else                                   where.product_name        = { [Op.like]: q };
//     }

//     if (mappingStatus === 'mapped')   where.is_mapped = 1;
//     if (mappingStatus === 'unmapped') where.is_mapped = 0;

//     const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

//     const { count, rows } = await PlatformProduct.findAndCountAll({
//         where,
//         include: [
//             {
//                 model:      PlatformStore,
//                 as:         'platformStore',
//                 attributes: ['id', 'store_name', 'platform'],
//                 required:   false,
//             },
//             {
//                 model:      PlatformSkuMapping,
//                 // as:         'skuMapping',
//                 as:         'skuMappings',
//                 attributes: ['id', 'merchant_sku_id', 'sync_status'],
//                 required:   false,
//                 where:      { is_active: true, deleted_at: null },
//                 include: [{
//                     model:      MerchantSku,
//                     as:         'merchantSku',
//                     attributes: ['id', 'sku_name', 'sku_title'],
//                     required:   false,
//                 }],
//             },
//         ],
//         order:    [['platform_product_id', 'ASC'], ['id', 'ASC']],
//         limit:    parseInt(limit, 10),
//         offset,
//         distinct: true,
//         subQuery: false,
//     });

//     const data = rows.map((p) => ({
//         id:                   p.id,
//         platform:             p.platform,
//         platform_product_id:  p.platform_product_id,
//         platform_sku_id:      p.platform_sku_id,
//         platform_model_id:    p.platform_model_id,
//         platform_location_id: p.platform_location_id,
//         platform_warehouse_id:p.platform_warehouse_id,
//         product_name:         p.product_name,
//         variation_name:       p.variation_name,
//         parent_sku:           p.parent_sku,
//         seller_sku:           p.seller_sku,
//         image_url:            p.image_url,
//         store_name:           p.platformStore?.store_name ?? p.store_name,
//         platform_stock:       p.platform_stock,
//         platform_price:       p.platform_price,
//         currency:             p.currency,
//         is_mapped:            !!p.is_mapped,
//         mapping_id:   p.skuMappings?.[0]?.id ?? null,
// merchant_sku: p.skuMappings?.[0]?.merchantSku ?? null,
// sync_status:  p.skuMappings?.[0]?.sync_status ?? null,
//         row_type:             p.row_type,
//     }));

//     return {
//         data,
//         pagination: {
//             total:      count,
//             page:       parseInt(page, 10),
//             limit:      parseInt(limit, 10),
//             totalPages: Math.ceil(count / parseInt(limit, 10)),
//         },
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 3. getPlatformProductCounts — tab badges
// // ─────────────────────────────────────────────────────────────────────────────
// const getPlatformProductCounts = async (user, filters = {}) => {
//     const { sequelize } = require('../../config/database');
//     const { platformStoreId, platform } = filters;

//     const storeClause    = platformStoreId ? `AND pp.platform_store_id = :storeId` : '';
//     const platformClause = platform && platform !== 'all' ? `AND pp.platform = :platform` : '';

//     const [result] = await sequelize.query(
//         `SELECT
//              COUNT(*)                                                          AS \`all\`,
//              SUM(CASE WHEN pp.is_mapped = 1 THEN 1 ELSE 0 END)                AS mapped,
//              SUM(CASE WHEN pp.is_mapped = 0 THEN 1 ELSE 0 END)                AS unmapped
//          FROM platform_products pp
//          WHERE pp.company_id = :companyId
//            AND pp.row_type   = 'child'
//            ${storeClause}
//            ${platformClause}`,
//         {
//             replacements: {
//                 companyId: user.companyId,
//                 storeId:   platformStoreId ? parseInt(platformStoreId, 10) : null,
//                 platform:  platform ?? null,
//             },
//             type: sequelize.QueryTypes.SELECT,
//         }
//     );

//     return {
//         all:      parseInt(result?.all      ?? 0, 10),
//         mapped:   parseInt(result?.mapped   ?? 0, 10),
//         unmapped: parseInt(result?.unmapped ?? 0, 10),
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 4. generateMerchantSku
// //    Creates a merchant_sku record from a selected platform product row.
// //    Then creates a platform_sku_mapping linking them.
// //    Body: { platformProductIds: [1,2,3], warehouseId: 1 }
// // ─────────────────────────────────────────────────────────────────────────────
// const generateMerchantSku = async (user, body) => {
//     const { PlatformProduct, MerchantSku, SkuWarehouseStock, PlatformSkuMapping } = require('../../models');
//     const { sequelize } = require('../../config/database');

//     const { platformProductIds, warehouseId } = body;

//     if (!Array.isArray(platformProductIds) || !platformProductIds.length) {
//         const err = new Error('Select at least one product to generate Merchant SKU');
//         err.statusCode = 400; throw err;
//     }
//     if (!warehouseId) {
//         const err = new Error('Warehouse is required');
//         err.statusCode = 400; throw err;
//     }

//     const products = await PlatformProduct.findAll({
//         where: { id: { [Op.in]: platformProductIds }, company_id: user.companyId },
//     });

//     if (!products.length) {
//         const err = new Error('No valid platform products found');
//         err.statusCode = 404; throw err;
//     }

//     const created = [];

//     for (const product of products) {
//         // Generate a unique SKU name from seller_sku or product name + id
//         const baseSku  = product.seller_sku ?? `SKU-${product.platform_product_id}`;
//         const skuName  = baseSku.length > 64 ? baseSku.substring(0, 64) : baseSku;

//         // Create merchant SKU (findOrCreate so re-running is safe)
//         const [msku, wasCreated] = await MerchantSku.findOrCreate({
//             where:    { company_id: user.companyId, sku_name: skuName },
//             defaults: {
//                 company_id:  user.companyId,
//                 sku_name:    skuName,
//                 sku_title:   product.product_name,
//                 image_url:   product.image_url,
//                 status:      'active',
//                 created_by:  user.userId,
//             },
//         });

//         // Ensure stock row exists
//         await SkuWarehouseStock.findOrCreate({
//             where:    { merchant_sku_id: msku.id, warehouse_id: parseInt(warehouseId, 10) },
//             defaults: {
//                 company_id:   user.companyId,
//                 merchant_sku_id: msku.id,
//                 warehouse_id: parseInt(warehouseId, 10),
//                 qty_on_hand:  0,
//                 qty_reserved: 0,
//                 qty_inbound:  0,
//             },
//         });

//         // Create platform_sku_mapping
//         await PlatformSkuMapping.findOrCreate({
//             where: {
//                 company_id:          user.companyId,
//                 merchant_sku_id:     msku.id,
//                 platform_store_id:   product.platform_store_id,
//                 platform_listing_id: product.platform_product_id,
//                 platform_sku_id:     product.platform_sku_id,
//             },
//             defaults: {
//                 company_id:            user.companyId,
//                 merchant_sku_id:       msku.id,
//                 platform_store_id:     product.platform_store_id,
//                 fulfillment_warehouse_id: parseInt(warehouseId, 10),
//                 platform_shop_id:      null,
//                 platform_listing_id:   product.platform_product_id,
//                 platform_sku_id:       product.platform_sku_id,
//                 platform_model_id:     product.platform_model_id,
//                 platform_location_id:  product.platform_location_id,
//                 platform_warehouse_id: product.platform_warehouse_id,
//                 sync_status:           'pending',
//                 is_active:             true,
//             },
//         });

//         // Mark platform product as mapped
//         await product.update({ is_mapped: 1 });

//         created.push({ merchantSkuId: msku.id, skuName: msku.sku_name, wasCreated });
//     }

//     return {
//         created: created.length,
//         skus:    created,
//         message: `${created.length} Merchant SKU(s) generated successfully`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 5. autoMapping
// //    Matches platform products to merchant SKUs by comparing seller_sku → sku_name.
// //    Body: { platformProductIds?: [1,2], warehouseId: 1 }
// //    If platformProductIds is empty → try to auto-map ALL unmapped products.
// // ─────────────────────────────────────────────────────────────────────────────
// const autoMapping = async (user, body) => {
//     const { PlatformProduct, MerchantSku, SkuWarehouseStock, PlatformSkuMapping } = require('../../models');

//     const { platformProductIds = [], warehouseId } = body;

//     if (!warehouseId) {
//         const err = new Error('Warehouse is required for auto mapping');
//         err.statusCode = 400; throw err;
//     }

//     const productWhere = { company_id: user.companyId, row_type: 'child', is_mapped: 0 };
//     if (platformProductIds.length) productWhere.id = { [Op.in]: platformProductIds };

//     const products = await PlatformProduct.findAll({ where: productWhere });

//     let matched = 0, skipped = 0;

//     for (const product of products) {
//         if (!product.seller_sku) { skipped++; continue; }

//         // Try to find a matching merchant SKU by sku_name
//         const msku = await MerchantSku.findOne({
//             where: { company_id: user.companyId, sku_name: product.seller_sku, deleted_at: null },
//         });

//         if (!msku) { skipped++; continue; }

//         // Ensure stock row exists
//         const [stockRow] = await SkuWarehouseStock.findOrCreate({
//             where:    { merchant_sku_id: msku.id, warehouse_id: parseInt(warehouseId, 10) },
//             defaults: {
//                 company_id:   user.companyId,
//                 merchant_sku_id: msku.id,
//                 warehouse_id: parseInt(warehouseId, 10),
//                 qty_on_hand:  0, qty_reserved: 0, qty_inbound: 0,
//             },
//         });

//         // Create mapping
//         const [, wasCreated] = await PlatformSkuMapping.findOrCreate({
//             where: {
//                 company_id:          user.companyId,
//                 merchant_sku_id:     msku.id,
//                 platform_store_id:   product.platform_store_id,
//                 platform_listing_id: product.platform_product_id,
//                 platform_sku_id:     product.platform_sku_id,
//             },
//             defaults: {
//                 company_id:            user.companyId,
//                 merchant_sku_id:       msku.id,
//                 platform_store_id:     product.platform_store_id,
//                 fulfillment_warehouse_id: parseInt(warehouseId, 10),
//                 platform_listing_id:   product.platform_product_id,
//                 platform_sku_id:       product.platform_sku_id,
//                 platform_model_id:     product.platform_model_id,
//                 platform_location_id:  product.platform_location_id,
//                 platform_warehouse_id: product.platform_warehouse_id,
//                 sync_status:           'pending',
//                 is_active:             true,
//             },
//         });

//         if (wasCreated) {
//             await product.update({ is_mapped: 1 });
//             matched++;
//         } else {
//             skipped++;
//         }
//     }

//     return {
//         matched,
//         skipped,
//         total:   products.length,
//         message: `Auto mapping complete — ${matched} matched, ${skipped} skipped`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 6. updatePlatformStock
// //    Pushes stock quantity back to the platform after mapping or stock change.
// //    Called after mapping is created and when stock changes in Node.js.
// //    Body: { mappingId, newQty }
// // ─────────────────────────────────────────────────────────────────────────────
// const updatePlatformStock = async (user, body) => {
//     const { PlatformSkuMapping, PlatformStore } = require('../../models');

//     const { mappingId, newQty } = body;

//     const mapping = await PlatformSkuMapping.findOne({
//         where:   { id: mappingId, company_id: user.companyId, is_active: true },
//         include: [{ model: PlatformStore, as: 'platformStore' }],
//     });

//     if (!mapping) {
//         const err = new Error('Mapping not found');
//         err.statusCode = 404; throw err;
//     }

//     const platform = mapping.platformStore?.platform;
//     let result;

//     if (platform === 'shopee') {
//         // POST /shopee-open-shop/api/dev/product/update_stock/:shopId
//         const shopId = mapping.platformStore?.store_shop_id;
//         result = await javaApi.post(
//             `http://192.168.1.222:8080/shopee-open-shop/api/dev/product/update_stock/${shopId}`,
//             {
//                 item_id:  parseInt(mapping.platform_listing_id, 10),
//                 model_id: parseInt(mapping.platform_model_id, 10),
//                 stock:    newQty,
//             }
//         );
//     } else if (platform === 'tiktok') {
//         // POST /tiktokshop-partner/api/dev/products/updateStock
//         const openId  = mapping.platformStore?.store_open_id;
//         const cipher  = mapping.platformStore?.store_cipher;
//         result = await javaApi.post(
//             `http://192.168.1.222:8080/tiktokshop-partner/api/dev/products/updateStock`,
//             {
//                 skus: [{
//                     id:        mapping.platform_sku_id,
//                     inventory: [{ quantity: newQty, warehouseId: mapping.platform_warehouse_id }],
//                 }],
//             },
//             { params: { productId: mapping.platform_listing_id, openId, cipher } }
//         );
//     } else {
//         return { skipped: true, reason: `Platform ${platform} stock push not implemented yet` };
//     }

//     // Update sync status
//     await mapping.update({ sync_status: 'synced', last_synced_at: new Date() });

//     return { pushed: true, platform, newQty, response: result?.data };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 7. unlinkMapping — remove a platform_sku_mapping (unmap action)
// // ─────────────────────────────────────────────────────────────────────────────
// const unlinkMapping = async (user, mappingId) => {
//     const { PlatformSkuMapping, PlatformProduct } = require('../../models');

//     const mapping = await PlatformSkuMapping.findOne({
//         where: { id: mappingId, company_id: user.companyId },
//     });
//     if (!mapping) {
//         const err = new Error('Mapping not found');
//         err.statusCode = 404; throw err;
//     }

//     // Soft-delete the mapping
//     await mapping.update({ is_active: false, deleted_at: new Date() });

//     // Clear is_mapped flag on the platform product
//     await PlatformProduct.update(
//         { is_mapped: 0 },
//         {
//             where: {
//                 company_id:          user.companyId,
//                 platform_product_id: mapping.platform_listing_id,
//                 platform_sku_id:     mapping.platform_sku_id,
//             },
//         }
//     );

//     return { unlinked: mappingId };
// };

// /**
//  * mapMerchantSkuToProduct
//  *
//  * Creates a platform_sku_mapping row that links a platform product row
//  * (from platform_products table) to a merchant SKU — triggered when
//  * the user clicks "Add Mapping with Store" on an UNMAPPED product row
//  * in ByProductSKUMappingPage and selects a merchant SKU from the modal.
//  *
//  * @param {object} user            - req.user (companyId, userId)
//  * @param {object} body
//  * @param {number} body.platformProductId - ID from platform_products table
//  * @param {number} body.merchantSkuId     - ID from merchant_skus table
//  */
// const mapMerchantSkuToProduct = async (user, body) => {
//     const {
//         PlatformProduct,
//         PlatformSkuMapping,
//         MerchantSku,
//         PlatformStore,
//     } = require('../../models');
 
//     const { platformProductId, merchantSkuId } = body;
 
//     // ── 1. Load the platform product row ─────────────────────────────────────
//     const platformProduct = await PlatformProduct.findOne({
//         where: { id: platformProductId, company_id: user.companyId },
//         include: [{
//             model:      PlatformStore,
//             as:         'platformStore',
//             attributes: ['id', 'platform', 'store_shop_id', 'store_open_id', 'store_cipher'],
//         }],
//     });
//     if (!platformProduct) {
//         const err = new Error('Platform product not found');
//         err.statusCode = 404;
//         throw err;
//     }
 
//     // ── 2. Load the merchant SKU row ──────────────────────────────────────────
//     const merchantSku = await MerchantSku.findOne({
//         where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
//         attributes: ['id', 'sku_name', 'warehouse_id'],
//     });
//     if (!merchantSku) {
//         const err = new Error('Merchant SKU not found');
//         err.statusCode = 404;
//         throw err;
//     }
 
//     // ── 3. Prevent duplicate active mapping ───────────────────────────────────
//     const existing = await PlatformSkuMapping.findOne({
//         where: {
//             company_id:            user.companyId,
//             platform_store_id:     platformProduct.platform_store_id,
//             platform_listing_id:   platformProduct.platform_product_id,
//             platform_sku_id:       platformProduct.platform_sku_id,
//             merchant_sku_id:       merchantSkuId,
//             is_active:             true,
//             deleted_at:            null,
//         },
//     });
//     if (existing) {
//         const err = new Error(
//             `${merchantSku.sku_name} is already mapped to this platform product`
//         );
//         err.statusCode = 409;
//         throw err;
//     }
 
//     // ── 4. Create the mapping row ─────────────────────────────────────────────
//     const mapping = await PlatformSkuMapping.create({
//         company_id:               user.companyId,
//         platform_store_id:        platformProduct.platform_store_id,
//         merchant_sku_id:          merchantSkuId,
//         combine_sku_id:           null,
//         platform:                 platformProduct.platform,
//         platform_listing_id:      platformProduct.platform_product_id,  // item_id / product_id
//         platform_sku_id:          platformProduct.platform_sku_id,       // model_id / sku_id
//         platform_model_id:        platformProduct.platform_model_id,
//         platform_warehouse_id:    null,
//         fulfillment_warehouse_id: merchantSku.warehouse_id,
//         is_active:                true,
//         sync_status:              'pending',
//         created_by:               user.userId,
//     });
 
//     // ── 5. Mark the platform product row as mapped ────────────────────────────
//     await PlatformProduct.update(
//         { is_mapped: 1 },
//         {
//             where: {
//                 company_id:          user.companyId,
//                 platform_product_id: platformProduct.platform_product_id,
//                 platform_sku_id:     platformProduct.platform_sku_id,
//             },
//         }
//     );
 
//     return {
//         message:     `${merchantSku.sku_name} mapped successfully`,
//         mappingId:   mapping.id,
//         merchantSku: merchantSku.sku_name,
//         platform:    platformProduct.platform,
//     };
// };

// module.exports = {
//     syncAllStores,
//     getPlatformProducts,
//     getPlatformProductCounts,
//     generateMerchantSku,
//     autoMapping,
//     updatePlatformStock,
//     unlinkMapping,
//     mapMerchantSkuToProduct,
// };






// 'use strict';

// /**
//  * platformProducts.service.js  (updated per SKU_Mapping_Requirements_v1)
//  *
//  * Changes vs previous version:
//  *  1. generateMerchantSku  — SKU name now uses [Platform Prefix]-[Seller SKU]-[Warehouse Code]
//  *  2. getPlatformProducts  — returns parent rows with expanded child rows + level-3 platform mappings
//  *  3. autoMapping          — now handles "all unmapped SKUs that have a Merchant SKU" when no IDs given
//  *  4. getProductHierarchy  — NEW: returns the full 3-level tree for ByProductSKUMappingPage
//  */

// const axios  = require('axios');
// const { Op } = require('sequelize');

// const JAVA_BASE = process.env.JAVA_API_URL ?? 'http://192.168.1.222:8080';



// const javaApi = axios.create({
//     baseURL: JAVA_BASE,
//     timeout: 30000,
//     headers: { 'Content-Type': 'application/json' },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // INTERNAL: Sync helpers per platform
// // ─────────────────────────────────────────────────────────────────────────────

// const syncShopeeStore = async (store, PlatformProduct) => {
//     const shopId    = store.store_shop_id;
//     const storeId   = store.id;
//     const companyId = store.company_id;
//     const storeName = store.store_name;

//     let offset      = 0;
//     const pageSize  = 100;
//     let hasNextPage = true;
//     let totalSynced = 0;

//     while (hasNextPage) {
//         const listRes = await javaApi.post(
//             `/shopee-open-shop/api/dev/product/get`,
//             { offset, page_size: pageSize, item_status: ['NORMAL'] },
//             { params: { shopId } }
//         );

//         const items      = listRes.data?.products ?? [];
//         hasNextPage      = listRes.data?.has_next_page ?? false;
//         const nextOffset = listRes.data?.next_offset ?? 0;

//         for (const item of items) {
//             const itemId      = item.item_id;
//             const imageUrl    = item.image?.image_url_list?.[0] ?? null;
//             const productName = item.item_name ?? '';
//             const models      = item.models ?? [];
//             const parentSku   = item.item_sku ?? null;
//             const hasVariants = models.length > 1;

//             // Upsert parent row
//             await PlatformProduct.upsert({
//                 company_id:           companyId,
//                 platform_store_id:    storeId,
//                 platform:             'shopee',
//                 platform_product_id:  String(itemId),
//                 platform_sku_id:      null,
//                 platform_model_id:    null,
//                 platform_location_id: null,
//                 platform_warehouse_id:null,
//                 product_name:         productName,
//                 variation_name:       null,
//                 parent_sku:           parentSku,
//                 seller_sku:           null,
//                 image_url:            imageUrl,
//                 store_name:           storeName,
//                 platform_stock:       0,
//                 platform_price:       null,
//                 currency:             null,
//                 row_type:             'parent',
//                 synced_at:            new Date(),
//             });

//             // Upsert child rows (one per model)
//             for (const model of models) {
//                 const modelId    = String(model.model_id ?? '');
//                 const stock      = model.stock_info_v2?.summary_info?.total_available_stock ?? 0;
//                 const locationId = model.stock_info_v2?.seller_stock?.[0]?.location_id ?? null;
//                 const price      = model.price_info?.[0]?.current_price ?? null;
//                 const currency   = model.price_info?.[0]?.currency ?? null;

//                 await PlatformProduct.upsert({
//                     company_id:           companyId,
//                     platform_store_id:    storeId,
//                     platform:             'shopee',
//                     platform_product_id:  String(itemId),
//                     platform_sku_id:      modelId,
//                     platform_model_id:    modelId,
//                     platform_location_id: locationId,
//                     platform_warehouse_id:null,
//                     product_name:         productName,
//                     variation_name:       model.model_name ?? null,
//                     parent_sku:           parentSku,
//                     seller_sku:           model.model_sku ?? null,
//                     image_url:            imageUrl,
//                     store_name:           storeName,
//                     platform_stock:       stock,
//                     platform_price:       price,
//                     currency,
//                     row_type:             'child',
//                     synced_at:            new Date(),
//                 });
//             }

//             totalSynced++;
//         }

//         if (!hasNextPage || items.length === 0) break;
//         offset = nextOffset;
//     }

//     return totalSynced;
// };

// const syncTikTokStore = async (store, PlatformProduct) => {
//     const openId    = store.store_open_id;
//     const cipher    = store.store_cipher;
//     const storeId   = store.id;
//     const companyId = store.company_id;
//     const storeName = store.store_name;

//     let pageToken   = null;
//     const pageSize  = 100;
//     let totalSynced = 0;

//     do {
//         const params = { openId, cipher, pageSize };
//         if (pageToken) params.pageToken = pageToken;

//         const res = await javaApi.post(
//             `/tiktokshop-partner/api/dev/products/get/pagination`,
//             { status: 'ACTIVATE' },
//             { params }
//         );

//         if (res.data?.code !== 0) {
//             console.error('[TikTok sync] API error:', res.data);
//             break;
//         }

//         const products = res.data?.data?.products ?? [];
//         pageToken      = res.data?.data?.nextPageToken ?? null;

//         for (const product of products) {
//             const productId   = String(product.id ?? '');
//             const productName = product.title ?? '';
//             const skus        = product.skus ?? [];

//             // Derive parent_sku from first child sellerSku (TikTok has no separate parent SKU)
//             const parentSku = skus[0]?.sellerSku ?? null;

//             // Parent row
//             await PlatformProduct.upsert({
//                 company_id:           companyId,
//                 platform_store_id:    storeId,
//                 platform:             'tiktok',
//                 platform_product_id:  productId,
//                 platform_sku_id:      null,
//                 platform_warehouse_id:null,
//                 product_name:         productName,
//                 variation_name:       null,
//                 parent_sku:           parentSku,
//                 seller_sku:           null,
//                 image_url:            null,
//                 store_name:           storeName,
//                 platform_stock:       0,
//                 platform_price:       null,
//                 currency:             null,
//                 row_type:             'parent',
//                 synced_at:            new Date(),
//             });

//             // Child rows — one per SKU
//             for (const sku of skus) {
//                 const skuId       = String(sku.id ?? '');
//                 const warehouseId = sku.inventory?.[0]?.warehouseId ?? null;
//                 const stock       = sku.inventory?.[0]?.quantity ?? 0;
//                 const price       = sku.price?.taxExclusivePrice ?? null;
//                 const currency    = sku.price?.currency ?? null;

//                 await PlatformProduct.upsert({
//                     company_id:           companyId,
//                     platform_store_id:    storeId,
//                     platform:             'tiktok',
//                     platform_product_id:  productId,
//                     platform_sku_id:      skuId,
//                     platform_warehouse_id:warehouseId,
//                     product_name:         productName,
//                     // TikTok has no model_name; use sellerSku as variant name
//                     variation_name:       sku.sellerSku ?? null,
//                     parent_sku:           parentSku,
//                     seller_sku:           sku.sellerSku ?? null,
//                     image_url:            null,
//                     store_name:           storeName,
//                     platform_stock:       stock,
//                     platform_price:       price ? parseFloat(price) : null,
//                     currency,
//                     row_type:             'child',
//                     synced_at:            new Date(),
//                 });
//             }

//             totalSynced++;
//         }

//     } while (pageToken && pageToken.length > 0);

//     return totalSynced;
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 1. syncAllStores
// // ─────────────────────────────────────────────────────────────────────────────
// const syncAllStores = async (user, filters = {}) => {
//     const { PlatformStore, PlatformProduct } = require('../../models');
//     const { platformStoreId } = filters;

//     const storeWhere = { company_id: user.companyId, is_active: true };
//     if (platformStoreId) storeWhere.id = parseInt(platformStoreId, 10);

//     const stores = await PlatformStore.findAll({ where: storeWhere });

//     if (!stores.length) {
//         return { synced: 0, results: [], message: 'No active stores found' };
//     }

//     const results = [];
//     for (const store of stores) {
//         try {
//             let count = 0;
//             if (store.platform === 'shopee') {
//                 count = await syncShopeeStore(store, PlatformProduct);
//             } else if (store.platform === 'tiktok') {
//                 count = await syncTikTokStore(store, PlatformProduct);
//             }
//             results.push({ storeName: store.store_name, platform: store.platform, synced: count });
//         } catch (err) {
//             console.error(`[sync] Error syncing store ${store.id}:`, err.message);
//             results.push({ storeName: store.store_name, platform: store.platform, synced: 0, error: err.message });
//         }
//     }

//     const totalSynced = results.reduce((s, r) => s + r.synced, 0);
//     return {
//         synced:  totalSynced,
//         results,
//         message: `Sync complete — ${totalSynced} product(s) updated across ${results.length} store(s)`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 2. getProductHierarchy — 3-level tree for ByProductSKUMappingPage
// //    Level 1: parent rows
// //    Level 2: child SKU rows (expanded under parent)
// //    Level 3: platform store mappings per child SKU
// // ─────────────────────────────────────────────────────────────────────────────
// const getProductHierarchy = async (user, filters = {}) => {
//     const {
//         PlatformProduct,
//         PlatformStore,
//         PlatformSkuMapping,
//         MerchantSku,
//     } = require('../../models');

//     const {
//         page          = 1,
//         limit         = 20,
//         platformStoreId,
//         platform,
//         search,
//         skuType       = 'product_name',
//         mappingStatus = 'all',
//     } = filters;

//     // ── Step 1: Find parent rows matching filters ──────────────────────────
//     const parentWhere = {
//         company_id: user.companyId,
//         row_type:   'parent',
//     };

//     if (platformStoreId) parentWhere.platform_store_id = parseInt(platformStoreId, 10);
//     if (platform && platform !== 'all') parentWhere.platform = platform;

//     if (search?.trim()) {
//         const q = `%${search.trim()}%`;
//         if (skuType === 'seller_sku')              parentWhere.parent_sku          = { [Op.like]: q };
//         else if (skuType === 'platform_product_id') parentWhere.platform_product_id = { [Op.like]: q };
//         else                                        parentWhere.product_name        = { [Op.like]: q };
//     }

//     const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

//     // ── Step 2: Get parents (paginated) ───────────────────────────────────
//     const { count: totalParents, rows: parentRows } = await PlatformProduct.findAndCountAll({
//         where:    parentWhere,
//         include:  [{
//             model:      PlatformStore,
//             as:         'platformStore',
//             attributes: ['id', 'store_name', 'platform'],
//             required:   false,
//         }],
//         order:    [['platform_product_id', 'ASC'], ['id', 'ASC']],
//         limit:    parseInt(limit, 10),
//         offset,
//         distinct: true,
//     });

//     if (!parentRows.length) {
//         return {
//             data:       [],
//             pagination: {
//                 total:      totalParents,
//                 page:       parseInt(page, 10),
//                 limit:      parseInt(limit, 10),
//                 totalPages: Math.ceil(totalParents / parseInt(limit, 10)),
//             },
//         };
//     }

//     // ── Step 3: Load child rows for all parents in page ───────────────────
//     const parentProductIds = parentRows.map((p) => p.platform_product_id);
//     const parentStoreIds   = [...new Set(parentRows.map((p) => p.platform_store_id))];

//     const childWhere = {
//         company_id:          user.companyId,
//         row_type:            'child',
//         platform_product_id: { [Op.in]: parentProductIds },
//         platform_store_id:   { [Op.in]: parentStoreIds },
//     };

//     if (mappingStatus === 'mapped')   childWhere.is_mapped = 1;
//     if (mappingStatus === 'unmapped') childWhere.is_mapped = 0;

//     const childRows = await PlatformProduct.findAll({
//         where:   childWhere,
//         include: [
//             {
//                 model:      PlatformStore,
//                 as:         'platformStore',
//                 attributes: ['id', 'store_name', 'platform'],
//                 required:   false,
//             },
//             {
//                 model:      PlatformSkuMapping,
//                 as:         'skuMappings',
//                 attributes: ['id', 'merchant_sku_id', 'platform_store_id', 'sync_status'],
//                 required:   false,
//                 where:      { is_active: true, deleted_at: null },
//                 include: [
//                     {
//                         model:      MerchantSku,
//                         as:         'merchantSku',
//                         attributes: ['id', 'sku_name', 'sku_title'],
//                         required:   false,
//                     },
//                     {
//                         model:      PlatformStore,
//                         as:         'platformStore',
//                         attributes: ['id', 'store_name', 'platform'],
//                         required:   false,
//                     },
//                 ],
//             },
//         ],
//         order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
//     });

//     // ── Step 4: Group children by platform_product_id + platform_store_id ─
//     const childByParent = {};
//     for (const child of childRows) {
//         const key = `${child.platform_product_id}__${child.platform_store_id}`;
//         if (!childByParent[key]) childByParent[key] = [];

//         // Build Level-3: platform mapping details per child SKU
//         const level3Mappings = (child.skuMappings ?? []).map((m) => ({
//             mapping_id:          m.id,
//             platform:            m.platformStore?.platform ?? child.platform,
//             shop_name:           m.platformStore?.store_name ?? null,
//             store_name:          m.platformStore?.store_name ?? null,
//             merchant_sku_id:     m.merchant_sku_id,
//             merchant_sku_name:   m.merchantSku?.sku_name ?? null,
//             sync_status:         m.sync_status,
//         }));

//         childByParent[key].push({
//             id:                   child.id,
//             platform:             child.platform,
//             platform_product_id:  child.platform_product_id,
//             platform_sku_id:      child.platform_sku_id,
//             platform_model_id:    child.platform_model_id,
//             platform_location_id: child.platform_location_id,
//             platform_warehouse_id:child.platform_warehouse_id,
//             product_name:         child.product_name,
//             variation_name:       child.variation_name,
//             parent_sku:           child.parent_sku,
//             seller_sku:           child.seller_sku,
//             image_url:            child.image_url,
//             store_name:           child.platformStore?.store_name ?? child.store_name,
//             platform_stock:       child.platform_stock,
//             platform_price:       child.platform_price,
//             currency:             child.currency,
//             is_mapped:            !!child.is_mapped,
//             row_type:             'child',
//             mapping_id:           child.skuMappings?.[0]?.id ?? null,
//             merchant_sku:         child.skuMappings?.[0]?.merchantSku ?? null,
//             sync_status:          child.skuMappings?.[0]?.sync_status ?? null,
//             // Level-3 platform mappings
//             platform_mappings:    level3Mappings,
//         });
//     }

//     // ── Step 5: Build output tree ──────────────────────────────────────────
//     const data = parentRows.map((p) => {
//         const key      = `${p.platform_product_id}__${p.platform_store_id}`;
//         const children = childByParent[key] ?? [];

//         // If filtering by mappingStatus, hide parents with no matching children
//         // (keep parent if at least one child matches, or if mappingStatus is 'all')
//         return {
//             id:                   p.id,
//             platform:             p.platform,
//             platform_product_id:  p.platform_product_id,
//             platform_sku_id:      null,
//             product_name:         p.product_name,
//             parent_sku:           p.parent_sku,
//             image_url:            p.image_url,
//             store_name:           p.platformStore?.store_name ?? p.store_name,
//             row_type:             'parent',
//             is_mapped:            children.some((c) => c.is_mapped),
//             child_count:          children.length,
//             // Level-2 children
//             children,
//         };
//     }).filter((p) => {
//         if (mappingStatus === 'all') return true;
//         return p.children.length > 0;
//     });

//     return {
//         data,
//         pagination: {
//             total:      totalParents,
//             page:       parseInt(page, 10),
//             limit:      parseInt(limit, 10),
//             totalPages: Math.ceil(totalParents / parseInt(limit, 10)),
//         },
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 3. getPlatformProducts — flat list (kept for backward compat / Merchant page)
// // ─────────────────────────────────────────────────────────────────────────────
// const getPlatformProducts = async (user, filters = {}) => {
//     const { PlatformProduct, PlatformStore, PlatformSkuMapping, MerchantSku } = require('../../models');

//     const {
//         page            = 1,
//         limit           = 20,
//         platformStoreId,
//         platform,
//         search,
//         skuType         = 'product_name',
//         mappingStatus   = 'all',
//     } = filters;

//     const where = {
//         company_id: user.companyId,
//         row_type:   'child',
//     };

//     if (platformStoreId) where.platform_store_id = parseInt(platformStoreId, 10);
//     if (platform && platform !== 'all') where.platform = platform;

//     if (search?.trim()) {
//         const q = `%${search.trim()}%`;
//         if (skuType === 'seller_sku')              where.seller_sku          = { [Op.like]: q };
//         else if (skuType === 'platform_product_id') where.platform_product_id = { [Op.like]: q };
//         else                                        where.product_name        = { [Op.like]: q };
//     }

//     if (mappingStatus === 'mapped')   where.is_mapped = 1;
//     if (mappingStatus === 'unmapped') where.is_mapped = 0;

//     const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

//     const { count, rows } = await PlatformProduct.findAndCountAll({
//         where,
//         include: [
//             {
//                 model:      PlatformStore,
//                 as:         'platformStore',
//                 attributes: ['id', 'store_name', 'platform'],
//                 required:   false,
//             },
//             {
//                 model:      PlatformSkuMapping,
//                 as:         'skuMappings',
//                 attributes: ['id', 'merchant_sku_id', 'sync_status'],
//                 required:   false,
//                 where:      { is_active: true, deleted_at: null },
//                 include: [{
//                     model:      MerchantSku,
//                     as:         'merchantSku',
//                     attributes: ['id', 'sku_name', 'sku_title'],
//                     required:   false,
//                 }],
//             },
//         ],
//         order:    [['platform_product_id', 'ASC'], ['id', 'ASC']],
//         limit:    parseInt(limit, 10),
//         offset,
//         distinct: true,
//         subQuery: false,
//     });

//     const data = rows.map((p) => ({
//         id:                   p.id,
//         platform:             p.platform,
//         platform_product_id:  p.platform_product_id,
//         platform_sku_id:      p.platform_sku_id,
//         platform_model_id:    p.platform_model_id,
//         platform_location_id: p.platform_location_id,
//         platform_warehouse_id:p.platform_warehouse_id,
//         product_name:         p.product_name,
//         variation_name:       p.variation_name,
//         parent_sku:           p.parent_sku,
//         seller_sku:           p.seller_sku,
//         image_url:            p.image_url,
//         store_name:           p.platformStore?.store_name ?? p.store_name,
//         platform_stock:       p.platform_stock,
//         platform_price:       p.platform_price,
//         currency:             p.currency,
//         is_mapped:            !!p.is_mapped,
//         mapping_id:           p.skuMappings?.[0]?.id ?? null,
//         merchant_sku:         p.skuMappings?.[0]?.merchantSku ?? null,
//         sync_status:          p.skuMappings?.[0]?.sync_status ?? null,
//         row_type:             p.row_type,
//     }));

//     return {
//         data,
//         pagination: {
//             total:      count,
//             page:       parseInt(page, 10),
//             limit:      parseInt(limit, 10),
//             totalPages: Math.ceil(count / parseInt(limit, 10)),
//         },
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 4. getPlatformProductCounts
// // ─────────────────────────────────────────────────────────────────────────────
// const getPlatformProductCounts = async (user, filters = {}) => {
//     const { sequelize } = require('../../config/database');
//     const { platformStoreId, platform } = filters;

//     const storeClause    = platformStoreId ? `AND pp.platform_store_id = :storeId` : '';
//     const platformClause = platform && platform !== 'all' ? `AND pp.platform = :platform` : '';

//     const [result] = await sequelize.query(
//         `SELECT
//              COUNT(*)                                                          AS \`all\`,
//              SUM(CASE WHEN pp.is_mapped = 1 THEN 1 ELSE 0 END)                AS mapped,
//              SUM(CASE WHEN pp.is_mapped = 0 THEN 1 ELSE 0 END)                AS unmapped
//          FROM platform_products pp
//          WHERE pp.company_id = :companyId
//            AND pp.row_type   = 'child'
//            ${storeClause}
//            ${platformClause}`,
//         {
//             replacements: {
//                 companyId: user.companyId,
//                 storeId:   platformStoreId ? parseInt(platformStoreId, 10) : null,
//                 platform:  platform ?? null,
//             },
//             type: sequelize.QueryTypes.SELECT,
//         }
//     );

//     return {
//         all:      parseInt(result?.all      ?? 0, 10),
//         mapped:   parseInt(result?.mapped   ?? 0, 10),
//         unmapped: parseInt(result?.unmapped ?? 0, 10),
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 5. generateMerchantSku
// //    Format: [PlatformPrefix]-[SellerSKU]-[WarehouseCode]
// //    Example: TT-Aface01N-WH01 (TikTok, sellerSku Aface01N, warehouse code WH01)
// // ─────────────────────────────────────────────────────────────────────────────
// const generateMerchantSku = async (user, body) => {
//     const { PlatformProduct, MerchantSku, SkuWarehouseStock, PlatformSkuMapping, Warehouse } = require('../../models');

//     const { platformProductIds, warehouseId } = body;

//     if (!Array.isArray(platformProductIds) || !platformProductIds.length) {
//         const err = new Error('Select at least one product to generate Merchant SKU');
//         err.statusCode = 400; throw err;
//     }
//     if (!warehouseId) {
//         const err = new Error('Warehouse is required');
//         err.statusCode = 400; throw err;
//     }

//     // Load warehouse to get its code for SKU generation
//     const warehouse = await Warehouse.findOne({
//         where:      { id: parseInt(warehouseId, 10), company_id: user.companyId },
//         attributes: ['id', 'code', 'name'],
//     });
//     if (!warehouse) {
//         const err = new Error('Warehouse not found');
//         err.statusCode = 404; throw err;
//     }

//     const warehouseCode = warehouse.code ?? `WH${warehouse.id}`;

//     const products = await PlatformProduct.findAll({
//         where: { id: { [Op.in]: platformProductIds }, company_id: user.companyId, row_type: 'child' },
//     });

//     if (!products.length) {
//         const err = new Error('No valid platform products found');
//         err.statusCode = 404; throw err;
//     }

//     const created = [];

//     for (const product of products) {
//         // ── Requirement §2.3: [PlatformPrefix]-[SellerSKU]-[WarehouseCode] ──
//         const platformPrefix = product.platform === 'tiktok' ? 'TT'
//                              : product.platform === 'shopee'  ? 'SP'
//                              : product.platform?.toUpperCase().substring(0, 3) ?? 'MK';

//         const baseSku    = product.seller_sku ?? `PROD-${product.platform_product_id}`;
//         const rawSkuName = `${platformPrefix}-${baseSku}-${warehouseCode}`;
//         // Enforce DB column limit (100 chars)
//         const skuName    = rawSkuName.length > 96 ? rawSkuName.substring(0, 96) : rawSkuName;

//         const [msku, wasCreated] = await MerchantSku.findOrCreate({
//             where:    { company_id: user.companyId, sku_name: skuName },
//             defaults: {
//                 company_id:   user.companyId,
//                 warehouse_id: parseInt(warehouseId, 10),
//                 sku_name:     skuName,
//                 sku_title:    product.product_name,
//                 image_url:    product.image_url,
//                 status:       'active',
//                 created_by:   user.userId,
//             },
//         });

//         // Ensure warehouse_id is set on merchant SKU
//         if (!msku.warehouse_id) {
//             await msku.update({ warehouse_id: parseInt(warehouseId, 10) });
//         }

//         // Ensure stock row exists
//         await SkuWarehouseStock.findOrCreate({
//             where:    { merchant_sku_id: msku.id, warehouse_id: parseInt(warehouseId, 10) },
//             defaults: {
//                 company_id:      user.companyId,
//                 merchant_sku_id: msku.id,
//                 warehouse_id:    parseInt(warehouseId, 10),
//                 qty_on_hand:     0,
//                 qty_reserved:    0,
//                 qty_inbound:     0,
//             },
//         });

//         // Create platform_sku_mapping linking platform product to merchant SKU
//         await PlatformSkuMapping.findOrCreate({
//             where: {
//                 company_id:          user.companyId,
//                 merchant_sku_id:     msku.id,
//                 platform_store_id:   product.platform_store_id,
//                 platform_listing_id: product.platform_product_id,
//                 platform_sku_id:     product.platform_sku_id,
//             },
//             defaults: {
//                 company_id:               user.companyId,
//                 merchant_sku_id:          msku.id,
//                 platform_store_id:        product.platform_store_id,
//                 fulfillment_warehouse_id: parseInt(warehouseId, 10),
//                 platform_listing_id:      product.platform_product_id,
//                 platform_sku_id:          product.platform_sku_id,
//                 platform_model_id:        product.platform_model_id,
//                 platform_location_id:     product.platform_location_id,
//                 platform_warehouse_id:    product.platform_warehouse_id,
//                 sync_status:              'pending',
//                 is_active:                true,
//             },
//         });

//         await product.update({ is_mapped: 1 });

//         created.push({ merchantSkuId: msku.id, skuName: msku.sku_name, wasCreated });
//     }

//     return {
//         created: created.length,
//         skus:    created,
//         message: `${created.length} Merchant SKU(s) generated successfully`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 6. autoMapping
// //    Requirement §2.4:
// //    - If no IDs selected → map ALL SKUs that have a Merchant SKU generated
// //    - If specific IDs selected → map only those
// //    - Body: { platformProductIds?: [], platformStoreId, warehouseId }
// // ─────────────────────────────────────────────────────────────────────────────
// const autoMapping = async (user, body) => {
//     const { PlatformProduct, MerchantSku, SkuWarehouseStock, PlatformSkuMapping, PlatformStore } = require('../../models');

//     const { platformProductIds = [], platformStoreId, warehouseId } = body;

//     if (!warehouseId) {
//         const err = new Error('Warehouse is required for auto mapping');
//         err.statusCode = 400; throw err;
//     }

//     if (!platformStoreId) {
//         const err = new Error('Store is required for auto mapping');
//         err.statusCode = 400; throw err;
//     }

//     const productWhere = {
//         company_id:        user.companyId,
//         row_type:          'child',
//         platform_store_id: parseInt(platformStoreId, 10),
//     };

//     if (platformProductIds.length) {
//         // Map only selected
//         productWhere.id = { [Op.in]: platformProductIds };
//     } else {
//         // Map all unmapped products in this store
//         productWhere.is_mapped = 0;
//     }

//     const products = await PlatformProduct.findAll({ where: productWhere });

//     let matched = 0, skipped = 0;
//     const mappedList = [];
//     const failedList = [];

//     for (const product of products) {
//         if (!product.seller_sku) {
//             skipped++;
//             failedList.push({ sellerSku: null, productName: product.product_name, reason: 'No seller SKU' });
//             continue;
//         }

//         // Try to find matching merchant SKU by sku_name
//         const msku = await MerchantSku.findOne({
//             where: {
//                 company_id:  user.companyId,
//                 deleted_at:  null,
//                 warehouse_id: parseInt(warehouseId, 10),
//                 // Match: the sku_name should contain the seller_sku
//                 sku_name: { [Op.like]: `%${product.seller_sku}%` },
//             },
//         });

//         if (!msku) {
//             skipped++;
//             failedList.push({ sellerSku: product.seller_sku, productName: product.product_name, reason: 'No matching Merchant SKU' });
//             continue;
//         }

//         await SkuWarehouseStock.findOrCreate({
//             where:    { merchant_sku_id: msku.id, warehouse_id: parseInt(warehouseId, 10) },
//             defaults: {
//                 company_id:      user.companyId,
//                 merchant_sku_id: msku.id,
//                 warehouse_id:    parseInt(warehouseId, 10),
//                 qty_on_hand:     0, qty_reserved: 0, qty_inbound: 0,
//             },
//         });

//         const [, wasCreated] = await PlatformSkuMapping.findOrCreate({
//             where: {
//                 company_id:          user.companyId,
//                 merchant_sku_id:     msku.id,
//                 platform_store_id:   product.platform_store_id,
//                 platform_listing_id: product.platform_product_id,
//                 platform_sku_id:     product.platform_sku_id,
//             },
//             defaults: {
//                 company_id:               user.companyId,
//                 merchant_sku_id:          msku.id,
//                 platform_store_id:        product.platform_store_id,
//                 fulfillment_warehouse_id: parseInt(warehouseId, 10),
//                 platform_listing_id:      product.platform_product_id,
//                 platform_sku_id:          product.platform_sku_id,
//                 platform_model_id:        product.platform_model_id,
//                 platform_location_id:     product.platform_location_id,
//                 platform_warehouse_id:    product.platform_warehouse_id,
//                 sync_status:              'pending',
//                 is_active:                true,
//             },
//         });

//         if (wasCreated) {
//             await product.update({ is_mapped: 1 });
//             matched++;
//             mappedList.push({ sellerSku: product.seller_sku, productName: product.product_name, merchantSku: msku.sku_name });
//         } else {
//             skipped++;
//             failedList.push({ sellerSku: product.seller_sku, productName: product.product_name, reason: 'Already mapped' });
//         }
//     }

//     return {
//         matched,
//         skipped,
//         total:   products.length,
//         mapped:  mappedList,
//         failed:  failedList,
//         message: `Auto mapping complete — ${matched} matched, ${skipped} skipped`,
//     };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 7. updatePlatformStock
// // ─────────────────────────────────────────────────────────────────────────────
// const updatePlatformStock = async (user, body) => {
//     const { PlatformSkuMapping, PlatformStore } = require('../../models');

//     const { mappingId, newQty } = body;

//     const mapping = await PlatformSkuMapping.findOne({
//         where:   { id: mappingId, company_id: user.companyId, is_active: true },
//         include: [{ model: PlatformStore, as: 'platformStore' }],
//     });

//     if (!mapping) {
//         const err = new Error('Mapping not found');
//         err.statusCode = 404; throw err;
//     }

//     const platform = mapping.platformStore?.platform;
//     let result;

//     if (platform === 'shopee') {
//         const shopId = mapping.platformStore?.store_shop_id;
//         result = await javaApi.post(
//             `/shopee-open-shop/api/dev/product/update_stock/${shopId}`,
//             {
//                 item_id:  parseInt(mapping.platform_listing_id, 10),
//                 model_id: parseInt(mapping.platform_model_id, 10),
//                 stock:    newQty,
//             }
//         );
//     } else if (platform === 'tiktok') {
//         const openId  = mapping.platformStore?.store_open_id;
//         const cipher  = mapping.platformStore?.store_cipher;
//         result = await javaApi.post(
//             `/tiktokshop-partner/api/dev/products/updateStock`,
//             {
//                 skus: [{
//                     id:        mapping.platform_sku_id,
//                     inventory: [{ quantity: newQty, warehouseId: mapping.platform_warehouse_id }],
//                 }],
//             },
//             { params: { productId: mapping.platform_listing_id, openId, cipher } }
//         );
//     } else {
//         return { skipped: true, reason: `Platform ${platform} stock push not implemented yet` };
//     }

//     await mapping.update({ sync_status: 'synced', last_synced_at: new Date() });

//     return { pushed: true, platform, newQty, response: result?.data };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 8. unlinkMapping
// // ─────────────────────────────────────────────────────────────────────────────
// const unlinkMapping = async (user, mappingId) => {
//     const { PlatformSkuMapping, PlatformProduct } = require('../../models');

//     const mapping = await PlatformSkuMapping.findOne({
//         where: { id: mappingId, company_id: user.companyId },
//     });
//     if (!mapping) {
//         const err = new Error('Mapping not found');
//         err.statusCode = 404; throw err;
//     }

//     await mapping.update({ is_active: false, deleted_at: new Date() });

//     // Clear is_mapped on platform product
//     await PlatformProduct.update(
//         { is_mapped: 0 },
//         {
//             where: {
//                 company_id:          user.companyId,
//                 platform_product_id: mapping.platform_listing_id,
//                 platform_sku_id:     mapping.platform_sku_id,
//             },
//         }
//     );

//     return { unlinked: mappingId };
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 9. mapMerchantSkuToProduct — "Add Mapping with Store" from product side
// // ─────────────────────────────────────────────────────────────────────────────
// const mapMerchantSkuToProduct = async (user, body) => {
//     const {
//         PlatformProduct,
//         PlatformSkuMapping,
//         MerchantSku,
//         PlatformStore,
//     } = require('../../models');

//     const { platformProductId, merchantSkuId } = body;

//     const platformProduct = await PlatformProduct.findOne({
//         where:   { id: platformProductId, company_id: user.companyId },
//         include: [{
//             model:      PlatformStore,
//             as:         'platformStore',
//             attributes: ['id', 'platform', 'store_shop_id', 'store_open_id', 'store_cipher'],
//         }],
//     });
//     if (!platformProduct) {
//         const err = new Error('Platform product not found');
//         err.statusCode = 404; throw err;
//     }

//     const merchantSku = await MerchantSku.findOne({
//         where:      { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
//         attributes: ['id', 'sku_name', 'warehouse_id'],
//     });
//     if (!merchantSku) {
//         const err = new Error('Merchant SKU not found');
//         err.statusCode = 404; throw err;
//     }

//     const existing = await PlatformSkuMapping.findOne({
//         where: {
//             company_id:          user.companyId,
//             platform_store_id:   platformProduct.platform_store_id,
//             platform_listing_id: platformProduct.platform_product_id,
//             platform_sku_id:     platformProduct.platform_sku_id,
//             merchant_sku_id:     merchantSkuId,
//             is_active:           true,
//             deleted_at:          null,
//         },
//     });
//     if (existing) {
//         const err = new Error(`${merchantSku.sku_name} is already mapped to this platform product`);
//         err.statusCode = 409; throw err;
//     }

//     const mapping = await PlatformSkuMapping.create({
//         company_id:               user.companyId,
//         platform_store_id:        platformProduct.platform_store_id,
//         merchant_sku_id:          merchantSkuId,
//         combine_sku_id:           null,
//         platform_listing_id:      platformProduct.platform_product_id,
//         platform_sku_id:          platformProduct.platform_sku_id,
//         platform_model_id:        platformProduct.platform_model_id,
//         platform_warehouse_id:    null,
//         fulfillment_warehouse_id: merchantSku.warehouse_id,
//         is_active:                true,
//         sync_status:              'pending',
//         created_by:               user.userId,
//     });

//     await PlatformProduct.update(
//         { is_mapped: 1 },
//         {
//             where: {
//                 company_id:          user.companyId,
//                 platform_product_id: platformProduct.platform_product_id,
//                 platform_sku_id:     platformProduct.platform_sku_id,
//             },
//         }
//     );

//     return {
//         message:     `${merchantSku.sku_name} mapped successfully`,
//         mappingId:   mapping.id,
//         merchantSku: merchantSku.sku_name,
//         platform:    platformProduct.platform,
//     };
// };

// module.exports = {
//     syncAllStores,
//     getProductHierarchy,
//     getPlatformProducts,
//     getPlatformProductCounts,
//     generateMerchantSku,
//     autoMapping,
//     updatePlatformStock,
//     unlinkMapping,
//     mapMerchantSkuToProduct,
// };



'use strict';

/**
 * platformProducts.service.js
 *
 * Handles syncing products from:
 *   - Shopee  → via Java proxy at JAVA_API_URL/shopee-open-shop/api/dev/
 *   - TikTok  → via Java proxy at JAVA_API_URL/tiktokshop-partner/api/dev/
 *
 * Stores results into platform_products table (migration 017).
 *
 * Exports:
 *   syncAllStores(user)            → sync all active stores for the company
 *   syncStore(user, platformStore) → sync one store
 *   getPlatformProducts(user, q)   → paginated list for ByProduct page
 *   getPlatformProductCounts(user) → { all, mapped, unmapped } for tabs
 *   generateMerchantSku(user, body)→ create merchant SKU from platform product
 *   autoMapping(user, body)        → auto-match platform products to merchant SKUs
 *   updatePlatformStock(user,body) → push stock back to platform after mapping
 *   unlinkMapping(user, mappingId) → remove a platform_sku_mapping row
 */

const axios  = require('axios');
const { Op } = require('sequelize');

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
    const prefix = platformPrefix(platform);
    const sku = safeSkuPart(sellerSku, `${productId}-${skuId || 'SKU'}`);
    const wh = safeSkuPart(warehouseCode, 'WH');
    return `${prefix}-${sku}-${wh}`.slice(0, 100);
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
    sync_status:              'pending',
    is_active:                true,
    deleted_at:               null,
    created_by:               userId || null,
});


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

            // Upsert parent row
            await PlatformProduct.upsert({
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

                await PlatformProduct.upsert({
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
    const openId     = store.store_open_id;
    const cipher     = store.store_cipher;
    const storeId    = store.id;
    const companyId  = store.company_id;
    const storeName  = store.store_name;

    let pageToken    = null;
    const pageSize   = 100;
    let totalSynced  = 0;

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

        for (const product of products) {
            const productId   = String(product.id ?? '');
            const productName = product.title ?? '';
            const skus = product.skus ?? [];
            const parentSku = skus[0]?.sellerSku ?? null;
            const hasVariants = skus.length > 1;

            // Parent row
            await PlatformProduct.upsert({
                company_id:           companyId,
                platform_store_id:    storeId,
                platform:             'tiktok',
                platform_product_id:  productId,
                platform_sku_id:      null,
                platform_warehouse_id:null,
                product_name:         productName,
                variation_name:       null,
                parent_sku:           parentSku,
                seller_sku:           null,
                image_url:            null,
                store_name:           storeName,
                platform_stock:       0,
                platform_price:       null,
                currency:             null,
                product_status:       product.status ?? null,
                has_variants:         hasVariants,
                row_type:             'parent',
                synced_at:            new Date(),
            });

            // Child rows — one per SKU
            for (const sku of skus) {
                const skuId       = String(sku.id ?? '');
                const warehouseId = sku.inventory?.[0]?.warehouseId ?? null;
                const stock       = sku.inventory?.[0]?.quantity ?? 0;
                const price       = sku.price?.taxExclusivePrice ?? null;
                const currency    = sku.price?.currency ?? null;

                await PlatformProduct.upsert({
                    company_id:           companyId,
                    platform_store_id:    storeId,
                    platform:             'tiktok',
                    platform_product_id:  productId,
                    platform_sku_id:      skuId,
                    platform_warehouse_id:warehouseId,
                    product_name:         productName,
                    variation_name:       sku.sellerSku ?? null,
                    parent_sku:           parentSku,
                    seller_sku:           sku.sellerSku ?? null,
                    image_url:            null,
                    store_name:           storeName,
                    platform_stock:       stock,
                    platform_price:       price ? parseFloat(price) : null,
                    currency,
                    product_status:       product.status ?? null,
                    has_variants:         hasVariants,
                    row_type:             'child',
                    synced_at:            new Date(),
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

    const parentWhere = { ...baseWhere, row_type: 'parent' };
    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        if (skuType === 'seller_sku') parentWhere.parent_sku = { [Op.like]: q };
        else if (skuType === 'platform_product_id') parentWhere.platform_product_id = { [Op.like]: q };
        else parentWhere.product_name = { [Op.like]: q };
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let { count, rows } = await PlatformProduct.findAndCountAll({
        where: parentWhere,
        include: [{
            model: PlatformStore,
            as: 'platformStore',
            attributes: ['id', 'store_name', 'platform'],
            required: false,
        }],
        order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
        limit: parseInt(limit, 10),
        offset,
        distinct: true,
        subQuery: false,
    });

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

    const children = childOrParentKeys.length ? await PlatformProduct.findAll({
        where: childWhere,
        include: [
            { model: PlatformStore, as: 'platformStore', attributes: ['id', 'store_name', 'platform'], required: false },
            {
                model: PlatformSkuMapping,
                as: 'skuMappings',
                attributes: ['id', 'merchant_sku_id', 'sync_status'],
                required: false,
                where: { is_active: true, deleted_at: null },
                include: [{ model: MerchantSku, as: 'merchantSku', attributes: ['id', 'sku_name', 'sku_title'], required: false }],
            },
        ],
        order: [['platform_product_id', 'ASC'], ['id', 'ASC']],
    }) : [];

    const mapChild = (p) => ({
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
        mappings:             (p.skuMappings ?? []).map((m) => ({ id: m.id, merchant_sku_id: m.merchant_sku_id, merchant_sku: m.merchantSku, sync_status: m.sync_status })),
        is_mapped:            !!p.is_mapped,
        mapping_id:           p.skuMappings?.[0]?.id ?? null,
        merchant_sku:         p.skuMappings?.[0]?.merchantSku ?? null,
        sync_status:          p.skuMappings?.[0]?.sync_status ?? null,
        row_type:             'child',
    });

    let data = rows.map((p) => {
        const childRows = children.filter((c) => c.platform_store_id === p.platform_store_id && c.platform_product_id === p.platform_product_id);
        const mappedChildren = childRows.filter((c) => !!c.is_mapped);
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
    console.log("...........................................Merchant sku........................");

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

        const [mapping, mappingCreated] = await PlatformSkuMapping.findOrCreate({
            where: {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                platform_store_id: product.platform_store_id,
            },
            defaults: {
                company_id: user.companyId,
                merchant_sku_id: msku.id,
                ...buildPlatformMappingFields(product, product.platformStore, parsedWarehouseId, user.userId),
            },
        });

        if (!mappingCreated) {
            await mapping.update({
                ...buildPlatformMappingFields(product, product.platformStore, parsedWarehouseId, user.userId),
            });
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

        const existingMapping = await PlatformSkuMapping.findOne({
            where: {
                company_id: user.companyId,
                platform_store_id: product.platform_store_id,
                platform_listing_id: product.platform_product_id,
                platform_sku_id: product.platform_sku_id,
                merchant_sku_id: { [Op.ne]: null },
            },
            paranoid: false,
        });

        if (existingMapping?.merchant_sku_id) {
            merchantSku = await MerchantSku.findOne({
                where: { id: existingMapping.merchant_sku_id, company_id: user.companyId, deleted_at: null },
            });
        }

        if (!merchantSku && product.seller_sku) {
            merchantSku = await MerchantSku.findOne({
                where: {
                    company_id: user.companyId,
                    deleted_at: null,
                    [Op.or]: [
                        { sku_name: product.seller_sku },
                        { sku_name: { [Op.like]: `%${product.seller_sku}%` } },
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

    // Clear is_mapped flag on the platform product
    await PlatformProduct.update(
        { is_mapped: 0 },
        {
            where: {
                company_id:          user.companyId,
                platform_product_id: mapping.platform_listing_id,
                platform_sku_id:     mapping.platform_sku_id,
            },
        }
    );

    return { unlinked: mappingId };
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
 
    // ── 4. Create the mapping row ─────────────────────────────────────────────
    const mapping = await PlatformSkuMapping.create({
        company_id:      user.companyId,
        merchant_sku_id: merchantSkuId,
        combine_sku_id:  null,
        ...buildPlatformMappingFields(platformProduct, platformProduct.platformStore, merchantSku.warehouse_id, user.userId),
    });
 
    // ── 5. Mark the platform product row as mapped ────────────────────────────
    await PlatformProduct.update(
        { is_mapped: 1 },
        {
            where: {
                company_id:          user.companyId,
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
    mapMerchantSkuToProduct,
};
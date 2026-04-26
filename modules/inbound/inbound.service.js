// 'use strict';

// const { Op } = require('sequelize');
// const { sequelize } = require('../../config/database');
// const redis = require('../../config/redis');

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /** Generate inbound_id: IB-YYYY-NNNNNN (zero-padded, per company) */
// const generateInboundId = async (companyId, t) => {
//     const { InboundOrder } = require('../../models');
//     const year = new Date().getFullYear();
//     const prefix = `IB-${year}-`;
//     const last = await InboundOrder.findOne({
//         where: {
//             company_id: companyId,
//             inbound_id: { [Op.like]: `${prefix}%` },
//         },
//         order: [['id', 'DESC']],
//         lock: t.LOCK.UPDATE,
//         transaction: t,
//     });
//     const seq = last
//         ? parseInt(last.inbound_id.replace(prefix, ''), 10) + 1
//         : 1;
//     return `${prefix}${String(seq).padStart(6, '0')}`;
// };

// /** Push combine SKU IDs into Redis for background recomputation */
// const queueCombineRecompute = async (companyId, merchantSkuIds) => {
//     if (!merchantSkuIds.length) return;
//     const { CombineSkuItem } = require('../../models');
//     const items = await CombineSkuItem.findAll({
//         where: { merchant_sku_id: { [Op.in]: merchantSkuIds }, company_id: companyId },
//         attributes: ['combine_sku_id'],
//         group: ['combine_sku_id'],
//         raw: true,
//     });
//     const ids = [...new Set(items.map(i => i.combine_sku_id))];
//     if (!ids.length) return;
//     // Push each combine SKU ID as a JSON task to the recompute queue
//     const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
//     ids.forEach(id =>
//         pipeline.rpush('queue:combine_sku_recompute', JSON.stringify({ companyId, combineSkuId: id }))
//     );
//     await pipeline.exec();
// };

// // ─── List Inbound Orders ──────────────────────────────────────────────────────
// const getInboundOrders = async (user, filters = {}) => {
//     const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse } = require('../../models');

//     const {
//         page = 1, limit = 20,
//         search, warehouseId, status,
//         dateFrom, dateTo,
//         sortBy = 'created_at', sortOrder = 'DESC',
//     } = filters;

//     const where = { company_id: user.companyId, deleted_at: null };

//     if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;
//     if (status && status !== 'all') where.status = status;
//     if (search) {
//         where[Op.or] = [
//             { inbound_id: { [Op.like]: `%${search}%` } },
//             { tracking_number: { [Op.like]: `%${search}%` } },
//             { supplier_name: { [Op.like]: `%${search}%` } },
//         ];
//     }
//     if (dateFrom || dateTo) {
//         where.created_at = {};
//         if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
//         if (dateTo) where.created_at[Op.lte] = new Date(dateTo + ' 23:59:59');
//     }

//     const validSort = {
//         created_at: 'created_at', updated_at: 'updated_at',
//         estimated_arrival: 'estimated_arrival', inbound_id: 'inbound_id',
//     };
//     const orderField = validSort[sortBy] || 'created_at';
//     const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
//     const offset = (parseInt(page) - 1) * parseInt(limit);

//     const { count, rows } = await InboundOrder.findAndCountAll({
//         where,
//         include: [
//             { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
//             {
//                 model: InboundOrderLine, as: 'lines',
//                 include: [{
//                     model: MerchantSku, as: 'merchantSku',
//                     attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
//                 }],
//             },
//         ],
//         order: [[orderField, orderDir]],
//         limit: parseInt(limit),
//         offset,
//         distinct: true,
//     });

//     return {
//         data: rows,
//         pagination: {
//             total: count,
//             page: parseInt(page),
//             limit: parseInt(limit),
//             totalPages: Math.ceil(count / parseInt(limit)),
//         },
//     };
// };

// // ─── Get Single Inbound Order ─────────────────────────────────────────────────
// const getInboundOrderById = async (user, inboundOrderId) => {
//     const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse } = require('../../models');

//     const order = await InboundOrder.findOne({
//         where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
//         include: [
//             { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
//             {
//                 model: InboundOrderLine, as: 'lines',
//                 include: [{
//                     model: MerchantSku, as: 'merchantSku',
//                     attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price'],
//                 }],
//             },
//         ],
//     });

//     if (!order) {
//         const err = new Error('Inbound order not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     return order;
// };

// // ─── Create Draft Inbound ─────────────────────────────────────────────────────
// const createInboundOrder = async (user, data) => {
//     const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

//     const { warehouseId, supplierName, supplierReference, notes, lines } = data;

//     // Validate warehouse belongs to company
//     const warehouse = await Warehouse.findOne({
//         where: { id: warehouseId, company_id: user.companyId },
//     });
//     if (!warehouse) {
//         const err = new Error('Invalid warehouse');
//         err.statusCode = 400;
//         throw err;
//     }

//     // Validate all merchant SKU IDs
//     const merchantSkuIds = lines.map(l => l.merchantSkuId);
//     const validSkus = await MerchantSku.findAll({
//         where: {
//             id: { [Op.in]: merchantSkuIds },
//             company_id: user.companyId,
//             deleted_at: null,
//         },
//         attributes: ['id', 'warehouse_id'],
//     });
//     if (validSkus.length !== merchantSkuIds.length) {
//         const err = new Error('One or more merchant SKUs are invalid or belong to a different company');
//         err.statusCode = 400;
//         throw err;
//     }

//     // Check for duplicate SKU IDs in the lines
//     const uniqueSkuIds = new Set(merchantSkuIds);
//     if (uniqueSkuIds.size !== merchantSkuIds.length) {
//         const err = new Error('Duplicate merchant SKUs in lines — each SKU may appear only once per inbound');
//         err.statusCode = 400;
//         throw err;
//     }

//     const result = await sequelize.transaction(async (t) => {
//         const inboundId = await generateInboundId(user.companyId, t);

//         const order = await InboundOrder.create({
//             company_id: user.companyId,
//             warehouse_id: warehouseId,
//             inbound_id: inboundId,
//             status: 'draft',
//             supplier_name: supplierName || null,
//             supplier_reference: supplierReference || null,
//             notes: notes || null,
//             created_by: user.userId,
//         }, { transaction: t });

//         await InboundOrderLine.bulkCreate(
//             lines.map(line => ({
//                 company_id: user.companyId,
//                 inbound_order_id: order.id,
//                 merchant_sku_id: line.merchantSkuId,
//                 qty_expected: line.qtyExpected,
//                 qty_received: 0,
//                 unit_cost: line.unitCost || null,
//                 currency: line.currency || null,
//             })),
//             { transaction: t }
//         );

//         return order;
//     });

//     return getInboundOrderById(user, result.id);
// };

// // ─── Update Draft ─────────────────────────────────────────────────────────────
// const updateDraftInbound = async (user, inboundOrderId, data) => {
//     const { InboundOrder, InboundOrderLine, MerchantSku } = require('../../models');

//     const order = await InboundOrder.findOne({
//         where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
//     });
//     if (!order) {
//         const err = new Error('Inbound order not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     if (order.status !== 'draft') {
//         const err = new Error(`Cannot edit — inbound is already "${order.status}"`);
//         err.statusCode = 400;
//         throw err;
//     }

//     await sequelize.transaction(async (t) => {
//         const updates = {};
//         if (data.supplierName !== undefined) updates.supplier_name = data.supplierName;
//         if (data.supplierReference !== undefined) updates.supplier_reference = data.supplierReference;
//         if (data.notes !== undefined) updates.notes = data.notes;
//         if (data.warehouseId !== undefined) updates.warehouse_id = data.warehouseId;

//         if (Object.keys(updates).length) await order.update(updates, { transaction: t });

//         if (data.lines && data.lines.length > 0) {
//             const merchantSkuIds = data.lines.map(l => l.merchantSkuId);
//             const validSkus = await MerchantSku.count({
//                 where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
//             });
//             if (validSkus !== merchantSkuIds.length) {
//                 const err = new Error('One or more merchant SKUs are invalid');
//                 err.statusCode = 400;
//                 throw err;
//             }

//             await InboundOrderLine.destroy({
//                 where: { inbound_order_id: inboundOrderId, company_id: user.companyId },
//                 transaction: t,
//             });

//             await InboundOrderLine.bulkCreate(
//                 data.lines.map(line => ({
//                     company_id: user.companyId,
//                     inbound_order_id: inboundOrderId,
//                     merchant_sku_id: line.merchantSkuId,
//                     qty_expected: line.qtyExpected,
//                     qty_received: 0,
//                     unit_cost: line.unitCost || null,
//                     currency: line.currency || null,
//                 })),
//                 { transaction: t }
//             );
//         }
//     });

//     return getInboundOrderById(user, inboundOrderId);
// };

// // ─── Ship: Draft → On The Way ─────────────────────────────────────────────────
// // Locks in the shipment details and increments qty_inbound for each SKU
// const shipInboundOrder = async (user, inboundOrderId, data) => {
//     const {
//         InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry,
//     } = require('../../models');

//     const order = await InboundOrder.findOne({
//         where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
//         include: [{ model: InboundOrderLine, as: 'lines' }],
//     });
//     if (!order) {
//         const err = new Error('Inbound order not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     if (order.status !== 'draft') {
//         const err = new Error(`Cannot ship — inbound status is "${order.status}"`);
//         err.statusCode = 400;
//         throw err;
//     }
//     if (!order.lines || order.lines.length === 0) {
//         const err = new Error('Cannot ship — inbound has no lines');
//         err.statusCode = 400;
//         throw err;
//     }

//     await sequelize.transaction(async (t) => {
//         // Update order status + shipping info
//         await order.update({
//             status: 'on_the_way',
//             tracking_number: data.trackingNumber,
//             purchase_currency: data.purchaseCurrency,
//             exchange_rate: data.exchangeRate || null,
//             estimated_arrival: data.estimatedArrival,
//             shipping_cost: data.shippingCost || null,
//             notes: data.notes || order.notes,
//             shipped_at: new Date(),
//         }, { transaction: t });

//         // Increment qty_inbound for each line's SKU in target warehouse
//         for (const line of order.lines) {
//             const [stockRecord] = await SkuWarehouseStock.findOrCreate({
//                 where: {
//                     merchant_sku_id: line.merchant_sku_id,
//                     warehouse_id: order.warehouse_id,
//                 },
//                 defaults: {
//                     company_id: user.companyId,
//                     merchant_sku_id: line.merchant_sku_id,
//                     warehouse_id: order.warehouse_id,
//                     qty_on_hand: 0,
//                     qty_reserved: 0,
//                     qty_inbound: 0,
//                 },
//                 transaction: t,
//                 lock: t.LOCK.UPDATE,
//             });

//             const newInbound = (stockRecord.qty_inbound || 0) + line.qty_expected;
//             await stockRecord.update({ qty_inbound: newInbound }, { transaction: t });

//             // Ledger entry
//             // await StockLedgerEntry.create({
//             //     company_id: user.companyId,
//             //     merchant_sku_id: line.merchant_sku_id,
//             //     warehouse_id: order.warehouse_id,
//             //     sku_warehouse_stock_id: stockRecord.id,
//             //     movement_type: 'inbound_receipt',  // pre-receipt: records the inbound intent
//             //     quantity_delta: line.qty_expected,
//             //     qty_on_hand_after: stockRecord.qty_on_hand,
//             //     reference_type: 'inbound_order',
//             //     reference_id: String(order.id),
//             //     notes: `Shipped — tracking: ${data.trackingNumber}`,
//             //     created_by: user.userId,
//             // }, { transaction: t });
//         }
//     });

//     return getInboundOrderById(user, inboundOrderId);
// };

// // ─── Receive: On The Way → Completed ─────────────────────────────────────────
// // Atomic: increments qty_on_hand, decrements qty_inbound, writes ledger, recomputes combine SKUs
// const receiveInboundOrder = async (user, inboundOrderId, data) => {
//     const {
//         InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry,
//     } = require('../../models');

//     const order = await InboundOrder.findOne({
//         where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
//         include: [{ model: InboundOrderLine, as: 'lines' }],
//     });
//     if (!order) {
//         const err = new Error('Inbound order not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     if (order.status !== 'on_the_way') {
//         const err = new Error(`Cannot receive — inbound status is "${order.status}"`);
//         err.statusCode = 400;
//         throw err;
//     }

//     // Build a map of lineId → receive data
//     const receiveMap = new Map(data.lines.map(l => [l.lineId, l]));

//     // Validate all provided lineIds belong to this order
//     const orderLineIds = new Set(order.lines.map(l => l.id));
//     for (const [lineId] of receiveMap) {
//         if (!orderLineIds.has(lineId)) {
//             const err = new Error(`Line ID ${lineId} does not belong to this inbound order`);
//             err.statusCode = 400;
//             throw err;
//         }
//     }

//     const affectedSkuIds = [];

//     await sequelize.transaction(async (t) => {
//         for (const line of order.lines) {
//             const receiveData = receiveMap.get(line.id);
//             const qtyReceived = receiveData ? receiveData.qtyReceived : 0;
//             const hasDiscrepancy = qtyReceived !== line.qty_expected;

//             // Update line with actual received qty
//             await line.update({
//                 qty_received: qtyReceived,
//                 has_discrepancy: hasDiscrepancy,
//                 discrepancy_notes: (receiveData && receiveData.discrepancyNotes) || null,
//             }, { transaction: t });

//             if (qtyReceived === 0) continue; // Nothing received for this line — skip stock update

//             // Lock stock row and update atomically
//             const stockRecord = await SkuWarehouseStock.findOne({
//                 where: {
//                     merchant_sku_id: line.merchant_sku_id,
//                     warehouse_id: order.warehouse_id,
//                 },
//                 lock: t.LOCK.UPDATE,
//                 transaction: t,
//             });

//             if (!stockRecord) {
//                 // Edge case: stock row missing (should have been created at ship time)
//                 const err = new Error(`Stock record missing for SKU ID ${line.merchant_sku_id}`);
//                 err.statusCode = 500;
//                 throw err;
//             }

//             const newQtyOnHand = (stockRecord.qty_on_hand || 0) + qtyReceived;
//             const newQtyInbound = Math.max(0, (stockRecord.qty_inbound || 0) - line.qty_expected);

//             await stockRecord.update({
//                 qty_on_hand: newQtyOnHand,
//                 qty_inbound: newQtyInbound,
//             }, { transaction: t });

//             await StockLedgerEntry.create({
//                 company_id: user.companyId,
//                 merchant_sku_id: line.merchant_sku_id,
//                 warehouse_id: order.warehouse_id,
//                 sku_warehouse_stock_id: stockRecord.id,
//                 movement_type: 'inbound_receipt',
//                 quantity_delta: qtyReceived,
//                 qty_on_hand_after: newQtyOnHand,
//                 reference_type: 'inbound_order',
//                 reference_id: String(order.id),
//                 notes: hasDiscrepancy
//                     ? `Discrepancy: expected ${line.qty_expected}, received ${qtyReceived}`
//                     : `Received at warehouse`,
//                 created_by: user.userId,
//             }, { transaction: t });

//             affectedSkuIds.push(line.merchant_sku_id);
//         }

//         // Mark order completed
//         await order.update({
//             status: 'completed',
//             arrived_at: new Date(),
//             notes: data.notes || order.notes,
//         }, { transaction: t });
//     });

//     // After commit: push combine SKU recompute jobs to Redis
//     if (affectedSkuIds.length > 0) {
//         await queueCombineRecompute(user.companyId, affectedSkuIds).catch(err =>
//             console.error('[queueCombineRecompute] Failed to enqueue:', err.message)
//         );
//     }

//     return getInboundOrderById(user, inboundOrderId);
// };

// // ─── Cancel Inbound ───────────────────────────────────────────────────────────
// const cancelInboundOrder = async (user, inboundOrderId) => {
//     const { InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry } = require('../../models');

//     const order = await InboundOrder.findOne({
//         where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
//         include: [{ model: InboundOrderLine, as: 'lines' }],
//     });
//     if (!order) {
//         const err = new Error('Inbound order not found');
//         err.statusCode = 404;
//         throw err;
//     }
//     if (order.status === 'completed') {
//         const err = new Error('Cannot cancel a completed inbound order');
//         err.statusCode = 400;
//         throw err;
//     }
//     if (order.status === 'cancelled') {
//         const err = new Error('Inbound order is already cancelled');
//         err.statusCode = 400;
//         throw err;
//     }

//     await sequelize.transaction(async (t) => {
//         // If it was on_the_way, reverse the qty_inbound increments
//         if (order.status === 'on_the_way') {
//             for (const line of order.lines) {
//                 const stockRecord = await SkuWarehouseStock.findOne({
//                     where: { merchant_sku_id: line.merchant_sku_id, warehouse_id: order.warehouse_id },
//                     lock: t.LOCK.UPDATE,
//                     transaction: t,
//                 });
//                 if (!stockRecord) continue;

//                 const newQtyInbound = Math.max(0, (stockRecord.qty_inbound || 0) - line.qty_expected);
//                 await stockRecord.update({ qty_inbound: newQtyInbound }, { transaction: t });

//                 await StockLedgerEntry.create({
//                     company_id: user.companyId,
//                     merchant_sku_id: line.merchant_sku_id,
//                     warehouse_id: order.warehouse_id,
//                     sku_warehouse_stock_id: stockRecord.id,
//                     movement_type: 'manual_adjustment',
//                     quantity_delta: 0,
//                     qty_on_hand_after: stockRecord.qty_on_hand,
//                     reference_type: 'inbound_order',
//                     reference_id: String(order.id),
//                     notes: 'Inbound cancelled — qty_inbound reversed',
//                     created_by: user.userId,
//                 }, { transaction: t });
//             }
//         }

//         await order.update({ status: 'cancelled' }, { transaction: t });
//     });

//     return getInboundOrderById(user, inboundOrderId);
// };

// // ─── Dropdowns ────────────────────────────────────────────────────────────────
// const getInboundDropdowns = async (user) => {
//     const { Warehouse, MerchantSku } = require('../../models');

//     const [warehouses, currencies] = await Promise.all([
//         Warehouse.findAll({
//             where: { company_id: user.companyId, status: 'active' },
//             attributes: ['id', 'name', 'code', 'is_default'],
//             order: [['is_default', 'DESC'], ['name', 'ASC']],
//         }),
//         Promise.resolve([
//             { code: 'USD', name: 'US Dollar' },
//             { code: 'MYR', name: 'Malaysian Ringgit' },
//             { code: 'SGD', name: 'Singapore Dollar' },
//             { code: 'THB', name: 'Thai Baht' },
//             { code: 'IDR', name: 'Indonesian Rupiah' },
//             { code: 'PHP', name: 'Philippine Peso' },
//             { code: 'VND', name: 'Vietnamese Dong' },
//             { code: 'CNY', name: 'Chinese Yuan' },
//         ]),
//     ]);

//     return { warehouses, currencies };
// };

// // ─── Get SKUs for inbound picker (filtered by warehouse) ─────────────────────
// const getSkusForInboundPicker = async (user, { warehouseId, search, page = 1, limit = 20 }) => {
//     const { MerchantSku, SkuWarehouseStock } = require('../../models');

//     const where = {
//         company_id: user.companyId,
//         status: 'active',
//         deleted_at: null,
//     };
//     if (warehouseId) where.warehouse_id = warehouseId;
//     if (search) {
//         where[Op.or] = [
//             { sku_name: { [Op.like]: `%${search}%` } },
//             { sku_title: { [Op.like]: `%${search}%` } },
//         ];
//     }

//     const offset = (parseInt(page) - 1) * parseInt(limit);
//     const { count, rows } = await MerchantSku.findAndCountAll({
//         where,
//         attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price', 'warehouse_id'],
//         include: [{
//             model: SkuWarehouseStock, as: 'stock',
//             attributes: ['qty_on_hand', 'qty_inbound', 'qty_reserved'],
//             required: false,
//             where: warehouseId ? { warehouse_id: warehouseId } : undefined,
//         }],
//         order: [['sku_name', 'ASC']],
//         limit: parseInt(limit),
//         offset,
//     });

//     return {
//         data: rows.map(s => {
//             const stock = s.stock || { qty_on_hand: 0, qty_inbound: 0, qty_reserved: 0 };
//             return {
//                 ...s.toJSON(),
//                 qty_on_hand: stock.qty_on_hand || 0,
//                 qty_inbound: stock.qty_inbound || 0,
//                 qty_available: Math.max(0, (stock.qty_on_hand || 0) - (stock.qty_reserved || 0)),
//             };
//         }),
//         pagination: {
//             total: count,
//             page: parseInt(page),
//             limit: parseInt(limit),
//             totalPages: Math.ceil(count / parseInt(limit)),
//         },
//     };
// };

// module.exports = {
//     getInboundOrders,
//     getInboundOrderById,
//     createInboundOrder,
//     updateDraftInbound,
//     shipInboundOrder,
//     receiveInboundOrder,
//     cancelInboundOrder,
//     getInboundDropdowns,
//     getSkusForInboundPicker,
// };



'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate inbound_id: IB-YYYY-NNNNNN (zero-padded, per company) */
const generateInboundId = async (companyId, t) => {
    const { InboundOrder } = require('../../models');
    const year = new Date().getFullYear();
    const prefix = `IB-${year}-`;
    const last = await InboundOrder.findOne({
        where: {
            company_id: companyId,
            inbound_id: { [Op.like]: `${prefix}%` },
        },
        order: [['id', 'DESC']],
        lock: t.LOCK.UPDATE,
        transaction: t,
    });
    const seq = last
        ? parseInt(last.inbound_id.replace(prefix, ''), 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(6, '0')}`;
};

/** Push combine SKU IDs into Redis for background recomputation */
const queueCombineRecompute = async (companyId, merchantSkuIds) => {
    if (!merchantSkuIds.length) return;
    const { CombineSkuItem } = require('../../models');
    const items = await CombineSkuItem.findAll({
        where: { merchant_sku_id: { [Op.in]: merchantSkuIds }, company_id: companyId },
        attributes: ['combine_sku_id'],
        group: ['combine_sku_id'],
        raw: true,
    });
    const ids = [...new Set(items.map(i => i.combine_sku_id))];
    if (!ids.length) return;
    // Push each combine SKU ID as a JSON task to the recompute queue
    const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
    ids.forEach(id =>
        pipeline.rpush('queue:combine_sku_recompute', JSON.stringify({ companyId, combineSkuId: id }))
    );
    await pipeline.exec();
};

// ─── List Inbound Orders ──────────────────────────────────────────────────────
const getInboundOrders = async (user, filters = {}) => {
    const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse } = require('../../models');

    const {
        page = 1, limit = 20,
        search, warehouseId, status,
        dateFrom, dateTo,
        sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const where = { company_id: user.companyId, deleted_at: null };

    if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;
    if (status && status !== 'all') where.status = status;
    if (search) {
        where[Op.or] = [
            { inbound_id: { [Op.like]: `%${search}%` } },
            { tracking_number: { [Op.like]: `%${search}%` } },
            { supplier_name: { [Op.like]: `%${search}%` } },
        ];
    }
    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) where.created_at[Op.lte] = new Date(dateTo + ' 23:59:59');
    }

    const validSort = {
        created_at: 'created_at', updated_at: 'updated_at',
        estimated_arrival: 'estimated_arrival', inbound_id: 'inbound_id',
    };
    const orderField = validSort[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await InboundOrder.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            {
                model: InboundOrderLine, as: 'lines',
                include: [{
                    model: MerchantSku, as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
                }],
            },
        ],
        order: [[orderField, orderDir]],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    return {
        data: rows,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
};

// ─── Get Single Inbound Order ─────────────────────────────────────────────────
const getInboundOrderById = async (user, inboundOrderId) => {
    const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse } = require('../../models');

    const order = await InboundOrder.findOne({
        where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            {
                model: InboundOrderLine, as: 'lines',
                include: [{
                    model: MerchantSku, as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price'],
                }],
            },
        ],
    });

    if (!order) {
        const err = new Error('Inbound order not found');
        err.statusCode = 404;
        throw err;
    }
    return order;
};

// ─── Create Draft Inbound ─────────────────────────────────────────────────────
const createInboundOrder = async (user, data) => {
    const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const { warehouseId, supplierName, supplierReference, notes, lines } = data;

    // Validate warehouse belongs to company
    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId },
    });
    if (!warehouse) {
        const err = new Error('Invalid warehouse');
        err.statusCode = 400;
        throw err;
    }

    // Validate all merchant SKU IDs
    const merchantSkuIds = lines.map(l => l.merchantSkuId);
    const validSkus = await MerchantSku.findAll({
        where: {
            id: { [Op.in]: merchantSkuIds },
            company_id: user.companyId,
            deleted_at: null,
        },
        attributes: ['id', 'warehouse_id'],
    });
    if (validSkus.length !== merchantSkuIds.length) {
        const err = new Error('One or more merchant SKUs are invalid or belong to a different company');
        err.statusCode = 400;
        throw err;
    }

    // Check for duplicate SKU IDs in the lines
    const uniqueSkuIds = new Set(merchantSkuIds);
    if (uniqueSkuIds.size !== merchantSkuIds.length) {
        const err = new Error('Duplicate merchant SKUs in lines — each SKU may appear only once per inbound');
        err.statusCode = 400;
        throw err;
    }

    const result = await sequelize.transaction(async (t) => {
        const inboundId = await generateInboundId(user.companyId, t);

        const order = await InboundOrder.create({
            company_id: user.companyId,
            warehouse_id: warehouseId,
            inbound_id: inboundId,
            status: 'draft',
            supplier_name: supplierName || null,
            supplier_reference: supplierReference || null,
            notes: notes || null,
            created_by: user.userId,
        }, { transaction: t });

        await InboundOrderLine.bulkCreate(
            lines.map(line => ({
                company_id: user.companyId,
                inbound_order_id: order.id,
                merchant_sku_id: line.merchantSkuId,
                qty_expected: line.qtyExpected,
                qty_received: 0,
                unit_cost: line.unitCost || null,
                currency: line.currency || null,
            })),
            { transaction: t }
        );

        return order;
    });

    return getInboundOrderById(user, result.id);
};

// ─── Update Draft ─────────────────────────────────────────────────────────────
const updateDraftInbound = async (user, inboundOrderId, data) => {
    const { InboundOrder, InboundOrderLine, MerchantSku } = require('../../models');

    const order = await InboundOrder.findOne({
        where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
    });
    if (!order) {
        const err = new Error('Inbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'draft') {
        const err = new Error(`Cannot edit — inbound is already "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }

    await sequelize.transaction(async (t) => {
        const updates = {};
        if (data.supplierName !== undefined) updates.supplier_name = data.supplierName;
        if (data.supplierReference !== undefined) updates.supplier_reference = data.supplierReference;
        if (data.notes !== undefined) updates.notes = data.notes;
        if (data.warehouseId !== undefined) updates.warehouse_id = data.warehouseId;

        if (Object.keys(updates).length) await order.update(updates, { transaction: t });

        if (data.lines && data.lines.length > 0) {
            const merchantSkuIds = data.lines.map(l => l.merchantSkuId);
            const validSkus = await MerchantSku.count({
                where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
            });
            if (validSkus !== merchantSkuIds.length) {
                const err = new Error('One or more merchant SKUs are invalid');
                err.statusCode = 400;
                throw err;
            }

            await InboundOrderLine.destroy({
                where: { inbound_order_id: inboundOrderId, company_id: user.companyId },
                transaction: t,
            });

            await InboundOrderLine.bulkCreate(
                data.lines.map(line => ({
                    company_id: user.companyId,
                    inbound_order_id: inboundOrderId,
                    merchant_sku_id: line.merchantSkuId,
                    qty_expected: line.qtyExpected,
                    qty_received: 0,
                    unit_cost: line.unitCost || null,
                    currency: line.currency || null,
                })),
                { transaction: t }
            );
        }
    });

    return getInboundOrderById(user, inboundOrderId);
};

// ─── Ship: Draft → On The Way ─────────────────────────────────────────────────
// Locks in the shipment details and increments qty_inbound for each SKU
const shipInboundOrder = async (user, inboundOrderId, data) => {
    const {
        InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry,
    } = require('../../models');

    const order = await InboundOrder.findOne({
        where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [{ model: InboundOrderLine, as: 'lines' }],
    });
    if (!order) {
        const err = new Error('Inbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'draft') {
        const err = new Error(`Cannot ship — inbound status is "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }
    if (!order.lines || order.lines.length === 0) {
        const err = new Error('Cannot ship — inbound has no lines');
        err.statusCode = 400;
        throw err;
    }

    await sequelize.transaction(async (t) => {
        // Update order status + shipping info
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

        // Increment qty_inbound for each line's SKU in target warehouse
        for (const line of order.lines) {
            const [stockRecord] = await SkuWarehouseStock.findOrCreate({
                where: {
                    merchant_sku_id: line.merchant_sku_id,
                    warehouse_id: order.warehouse_id,
                },
                defaults: {
                    company_id: user.companyId,
                    merchant_sku_id: line.merchant_sku_id,
                    warehouse_id: order.warehouse_id,
                    qty_on_hand: 0,
                    qty_reserved: 0,
                    qty_inbound: 0,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const newInbound = (stockRecord.qty_inbound || 0) + line.qty_expected;
            await stockRecord.update({ qty_inbound: newInbound }, { transaction: t });

            // Ledger entry
            // await StockLedgerEntry.create({
            //     company_id: user.companyId,
            //     merchant_sku_id: line.merchant_sku_id,
            //     warehouse_id: order.warehouse_id,
            //     sku_warehouse_stock_id: stockRecord.id,
            //     movement_type: 'inbound_receipt',  // pre-receipt: records the inbound intent
            //     quantity_delta: line.qty_expected,
            //     qty_on_hand_after: stockRecord.qty_on_hand,
            //     reference_type: 'inbound_order',
            //     reference_id: String(order.id),
            //     notes: `Shipped — tracking: ${data.trackingNumber}`,
            //     created_by: user.userId,
            // }, { transaction: t });
        }
    });

    return getInboundOrderById(user, inboundOrderId);
};

// ─── Receive: On The Way → Completed ─────────────────────────────────────────
// Atomic: increments qty_on_hand, decrements qty_inbound, writes ledger, recomputes combine SKUs
const receiveInboundOrder = async (user, inboundOrderId, data) => {
    const {
        InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry,
    } = require('../../models');

    const order = await InboundOrder.findOne({
        where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [{ model: InboundOrderLine, as: 'lines' }],
    });
    if (!order) {
        const err = new Error('Inbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status !== 'on_the_way') {
        const err = new Error(`Cannot receive — inbound status is "${order.status}"`);
        err.statusCode = 400;
        throw err;
    }

    // Build a map of lineId → receive data
    const receiveMap = new Map(data.lines.map(l => [l.lineId, l]));

    // Validate all provided lineIds belong to this order
    const orderLineIds = new Set(order.lines.map(l => l.id));
    for (const [lineId] of receiveMap) {
        if (!orderLineIds.has(lineId)) {
            const err = new Error(`Line ID ${lineId} does not belong to this inbound order`);
            err.statusCode = 400;
            throw err;
        }
    }

    const affectedSkuIds = [];

    await sequelize.transaction(async (t) => {
        for (const line of order.lines) {
            const receiveData = receiveMap.get(line.id);
            const qtyReceived = receiveData ? receiveData.qtyReceived : 0;
            const hasDiscrepancy = qtyReceived !== line.qty_expected;

            // Update line with actual received qty
            await line.update({
                qty_received: qtyReceived,
                has_discrepancy: hasDiscrepancy,
                discrepancy_notes: (receiveData && receiveData.discrepancyNotes) || null,
            }, { transaction: t });

            if (qtyReceived === 0) continue; // Nothing received for this line — skip stock update

            // Lock stock row and update atomically
            const stockRecord = await SkuWarehouseStock.findOne({
                where: {
                    merchant_sku_id: line.merchant_sku_id,
                    warehouse_id: order.warehouse_id,
                },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });

            if (!stockRecord) {
                // Edge case: stock row missing (should have been created at ship time)
                const err = new Error(`Stock record missing for SKU ID ${line.merchant_sku_id}`);
                err.statusCode = 500;
                throw err;
            }

            const newQtyOnHand = (stockRecord.qty_on_hand || 0) + qtyReceived;
            const newQtyInbound = Math.max(0, (stockRecord.qty_inbound || 0) - line.qty_expected);

            await stockRecord.update({
                qty_on_hand: newQtyOnHand,
                qty_inbound: newQtyInbound,
            }, { transaction: t });

            await StockLedgerEntry.create({
                company_id: user.companyId,
                merchant_sku_id: line.merchant_sku_id,
                warehouse_id: order.warehouse_id,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: 'inbound_receipt',
                quantity_delta: qtyReceived,
                qty_on_hand_after: newQtyOnHand,
                reference_type: 'inbound_order',
                reference_id: String(order.id),
                notes: hasDiscrepancy
                    ? `Discrepancy: expected ${line.qty_expected}, received ${qtyReceived}`
                    : `Received at warehouse`,
                created_by: user.userId,
            }, { transaction: t });

            affectedSkuIds.push(line.merchant_sku_id);
        }

        // Mark order completed
        await order.update({
            status: 'completed',
            arrived_at: new Date(),
            notes: data.notes || order.notes,
        }, { transaction: t });
    });

    // After commit: push combine SKU recompute jobs to Redis
    if (affectedSkuIds.length > 0) {
        await queueCombineRecompute(user.companyId, affectedSkuIds).catch(err =>
            console.error('[queueCombineRecompute] Failed to enqueue:', err.message)
        );
    }

    return getInboundOrderById(user, inboundOrderId);
};

// ─── Cancel Inbound ───────────────────────────────────────────────────────────
const cancelInboundOrder = async (user, inboundOrderId) => {
    const { InboundOrder, InboundOrderLine, SkuWarehouseStock, StockLedgerEntry } = require('../../models');

    const order = await InboundOrder.findOne({
        where: { id: inboundOrderId, company_id: user.companyId, deleted_at: null },
        include: [{ model: InboundOrderLine, as: 'lines' }],
    });
    if (!order) {
        const err = new Error('Inbound order not found');
        err.statusCode = 404;
        throw err;
    }
    if (order.status === 'completed') {
        const err = new Error('Cannot cancel a completed inbound order');
        err.statusCode = 400;
        throw err;
    }
    if (order.status === 'cancelled') {
        const err = new Error('Inbound order is already cancelled');
        err.statusCode = 400;
        throw err;
    }

    await sequelize.transaction(async (t) => {
        // If it was on_the_way, reverse the qty_inbound increments
        if (order.status === 'on_the_way') {
            for (const line of order.lines) {
                const stockRecord = await SkuWarehouseStock.findOne({
                    where: { merchant_sku_id: line.merchant_sku_id, warehouse_id: order.warehouse_id },
                    lock: t.LOCK.UPDATE,
                    transaction: t,
                });
                if (!stockRecord) continue;

                const newQtyInbound = Math.max(0, (stockRecord.qty_inbound || 0) - line.qty_expected);
                await stockRecord.update({ qty_inbound: newQtyInbound }, { transaction: t });

                await StockLedgerEntry.create({
                    company_id: user.companyId,
                    merchant_sku_id: line.merchant_sku_id,
                    warehouse_id: order.warehouse_id,
                    sku_warehouse_stock_id: stockRecord.id,
                    movement_type: 'manual_adjustment',
                    quantity_delta: 0,
                    qty_on_hand_after: stockRecord.qty_on_hand,
                    reference_type: 'inbound_order',
                    reference_id: String(order.id),
                    notes: 'Inbound cancelled — qty_inbound reversed',
                    created_by: user.userId,
                }, { transaction: t });
            }
        }

        await order.update({ status: 'cancelled' }, { transaction: t });
    });

    return getInboundOrderById(user, inboundOrderId);
};

// ─── Create Manual Inbound (direct → completed, stock updated immediately) ────
const createManualInbound = async (user, data) => {
    const {
        InboundOrder, InboundOrderLine, MerchantSku, Warehouse,
        SkuWarehouseStock, StockLedgerEntry,
    } = require('../../models');

    const { warehouseId, supplierName, supplierReference, notes, lines } = data;

    // Validate warehouse belongs to company
    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId },
    });
    if (!warehouse) {
        const err = new Error('Invalid warehouse');
        err.statusCode = 400;
        throw err;
    }

    // Validate all merchant SKU IDs
    const merchantSkuIds = lines.map(l => l.merchantSkuId);
    const validSkus = await MerchantSku.findAll({
        where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
        attributes: ['id'],
    });
    if (validSkus.length !== merchantSkuIds.length) {
        const err = new Error('One or more merchant SKUs are invalid or belong to a different company');
        err.statusCode = 400;
        throw err;
    }

    // Check for duplicate SKU IDs in lines
    if (new Set(merchantSkuIds).size !== merchantSkuIds.length) {
        const err = new Error('Duplicate merchant SKUs in lines — each SKU may appear only once');
        err.statusCode = 400;
        throw err;
    }

    const affectedSkuIds = [];

    const result = await sequelize.transaction(async (t) => {
        const inboundId = await generateInboundId(user.companyId, t);

        const order = await InboundOrder.create({
            company_id: user.companyId,
            warehouse_id: warehouseId,
            inbound_id: inboundId,
            status: 'completed',
            is_manual: true,
            supplier_name: supplierName || null,
            supplier_reference: supplierReference || null,
            notes: notes || null,
            shipped_at: new Date(),
            arrived_at: new Date(),
            created_by: user.userId,
        }, { transaction: t });

        // Create lines with qty_received = qty_expected (full receipt)
        const createdLines = await InboundOrderLine.bulkCreate(
            lines.map(line => ({
                company_id: user.companyId,
                inbound_order_id: order.id,
                merchant_sku_id: line.merchantSkuId,
                qty_expected: line.qtyReceived,
                qty_received: line.qtyReceived,
                unit_cost: line.unitCost || null,
                currency: line.currency || null,
                has_discrepancy: false,
            })),
            { transaction: t, returning: true }
        );

        // Immediately update stock (qty_on_hand) for each line
        for (const line of lines) {
            const qtyReceived = line.qtyReceived;
            if (qtyReceived === 0) continue;

            const [stockRecord] = await SkuWarehouseStock.findOrCreate({
                where: { merchant_sku_id: line.merchantSkuId, warehouse_id: warehouseId },
                defaults: {
                    company_id: user.companyId,
                    merchant_sku_id: line.merchantSkuId,
                    warehouse_id: warehouseId,
                    qty_on_hand: 0,
                    qty_reserved: 0,
                    qty_inbound: 0,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const newQtyOnHand = (stockRecord.qty_on_hand || 0) + qtyReceived;
            await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction: t });

            await StockLedgerEntry.create({
                company_id: user.companyId,
                merchant_sku_id: line.merchantSkuId,
                warehouse_id: warehouseId,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: 'inbound_receipt',
                quantity_delta: qtyReceived,
                qty_on_hand_after: newQtyOnHand,
                reference_type: 'inbound_order',
                reference_id: String(order.id),
                notes: `Manual inbound receipt`,
                created_by: user.userId,
            }, { transaction: t });

            affectedSkuIds.push(line.merchantSkuId);
        }

        return order;
    });

    // After commit: recompute combine SKUs
    if (affectedSkuIds.length > 0) {
        await queueCombineRecompute(user.companyId, affectedSkuIds).catch(err =>
            console.error('[queueCombineRecompute] Failed to enqueue:', err.message)
        );
    }

    return getInboundOrderById(user, result.id);
};

// ─── List Manual Inbound Orders ───────────────────────────────────────────────
const getManualInboundOrders = async (user, filters = {}) => {
    const { InboundOrder, InboundOrderLine, MerchantSku, Warehouse } = require('../../models');

    const {
        page = 1, limit = 20,
        search, warehouseId,
        dateFrom, dateTo,
        sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const where = { company_id: user.companyId, deleted_at: null, is_manual: true };

    if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;
    if (search) {
        where[Op.or] = [
            { inbound_id: { [Op.like]: `%${search}%` } },
            { supplier_name: { [Op.like]: `%${search}%` } },
            { supplier_reference: { [Op.like]: `%${search}%` } },
        ];
    }
    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) where.created_at[Op.lte] = new Date(dateTo + ' 23:59:59');
    }

    const validSort = {
        created_at: 'created_at', updated_at: 'updated_at',
        inbound_id: 'inbound_id',
    };
    const orderField = validSort[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await InboundOrder.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            {
                model: InboundOrderLine, as: 'lines',
                include: [{
                    model: MerchantSku, as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
                }],
            },
        ],
        order: [[orderField, orderDir]],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    return {
        data: rows,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
};

// ─── Dropdowns ────────────────────────────────────────────────────────────────
const getInboundDropdowns = async (user) => {
    const { Warehouse, MerchantSku } = require('../../models');

    const [warehouses, currencies] = await Promise.all([
        Warehouse.findAll({
            where: { company_id: user.companyId, status: 'active' },
            attributes: ['id', 'name', 'code', 'is_default'],
            order: [['is_default', 'DESC'], ['name', 'ASC']],
        }),
        Promise.resolve([
            { code: 'USD', name: 'US Dollar' },
            { code: 'MYR', name: 'Malaysian Ringgit' },
            { code: 'SGD', name: 'Singapore Dollar' },
            { code: 'THB', name: 'Thai Baht' },
            { code: 'IDR', name: 'Indonesian Rupiah' },
            { code: 'PHP', name: 'Philippine Peso' },
            { code: 'VND', name: 'Vietnamese Dong' },
            { code: 'CNY', name: 'Chinese Yuan' },
        ]),
    ]);

    return { warehouses, currencies };
};

// ─── Get SKUs for inbound picker (filtered by warehouse) ─────────────────────
const getSkusForInboundPicker = async (user, { warehouseId, search, page = 1, limit = 20 }) => {
    const { MerchantSku, SkuWarehouseStock } = require('../../models');

    const where = {
        company_id: user.companyId,
        status: 'active',
        deleted_at: null,
    };
    if (warehouseId) where.warehouse_id = warehouseId;
    if (search) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price', 'warehouse_id'],
        include: [{
            model: SkuWarehouseStock, as: 'stock',
            attributes: ['qty_on_hand', 'qty_inbound', 'qty_reserved'],
            required: false,
            where: warehouseId ? { warehouse_id: warehouseId } : undefined,
        }],
        order: [['sku_name', 'ASC']],
        limit: parseInt(limit),
        offset,
    });

    return {
        data: rows.map(s => {
            const stock = s.stock || { qty_on_hand: 0, qty_inbound: 0, qty_reserved: 0 };
            return {
                ...s.toJSON(),
                qty_on_hand: stock.qty_on_hand || 0,
                qty_inbound: stock.qty_inbound || 0,
                qty_available: Math.max(0, (stock.qty_on_hand || 0) - (stock.qty_reserved || 0)),
            };
        }),
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
};

module.exports = {
    getInboundOrders,
    getInboundOrderById,
    createInboundOrder,
    updateDraftInbound,
    shipInboundOrder,
    receiveInboundOrder,
    cancelInboundOrder,
    getInboundDropdowns,
    getSkusForInboundPicker,
    createManualInbound,
    getManualInboundOrders,
};
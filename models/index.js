'use strict';
const { sequelize } = require('../config/database');

// ─── Import all models ────────────────────────────────────────────────────────
const Company = require('./Company')(sequelize);
const Role = require('./Role')(sequelize);
const User = require('./User')(sequelize);
const Pages = require('./Pages')(sequelize);
const UserStorePermission = require('./UserStorePermission')(sequelize);
const UserWarehousePermission = require('./UserWarehousePermission')(sequelize);
const Warehouse = require('./Warehouse')(sequelize);

// ── Inventory: SKU management ─────────────────────────────────────────────────
// Use the updated versions that include the new associations
const MerchantSku = require('./MerchantSku')(sequelize);       // updated version
const CombineSku = require('./CombineSku')(sequelize);        // updated version
const CombineSkuItem = require('./CombineSkuItem')(sequelize);

// ── Inventory: Stock ──────────────────────────────────────────────────────────
const SkuWarehouseStock = require('./SkuWarehouseStock')(sequelize);   // NEW
const StockLedgerEntry = require('./StockLedgerEntry')(sequelize);    // NEW

// ── Inventory: Inbound ────────────────────────────────────────────────────────
const InboundOrder = require('./InboundOrder')(sequelize);        // NEW
const InboundOrderLine = require('./InboundOrderLine')(sequelize);    // NEW
const OutboundOrder = require('./OutboundOrder')(sequelize);
const OutboundOrderLine = require('./OutboundOrderLine')(sequelize);

// ── Platform integration ──────────────────────────────────────────────────────
const PlatformStore = require('./PlatformStore')(sequelize);       // NEW
const PlatformSkuMapping = require('./PlatformSkuMapping')(sequelize);  // NEW
const OrderSaleLine = require('./OrderSaleLine')(sequelize);       // NEW
const PlatformProduct = require('./PlatformProduct')(sequelize);       // NEW
const PackFailedOrder = require('./PackFailedOrder')(sequelize);       // NEW
const PushSuccessfulOrder = require('./PushSuccessfulOrder')(sequelize);       // NEW
const WithdrawOrder = require('./WithdrawOrder')(sequelize);       // NEW
const ManualOrder = require('./ManualOrder')(sequelize);       // NEW
const ManualOrderItem = require('./ManualOrderItem')(sequelize);       // NEW
const ManualOrderStatusHistory = require('./ManualOrderStatusHistory')(sequelize);       // NEW
const PlatformOrderItemSkuOverride = require('./PlatformOrderItemSkuOverride')(sequelize);       // NEW
const PlatformManualOrder = require('./PlatformManualOrder')(sequelize);       // NEW
const PlatformManualOrderItem = require('./PlatformManualOrderItem')(sequelize);       // NEW
const ReturnOrder = require('./ReturnOrder')(sequelize);
const ReturnOrderLine = require('./ReturnOrderLine')(sequelize);
const ReturnOrderSyncState = require('./ReturnOrderSyncState')(sequelize);

// ── MerchantSku Sync integration ──────────────────────────────────────────────────────
const MerchantSkuSyncGroup=require('./MerchantSkuSyncGroup')(sequelize);   //New
const MerchantSkuSyncMember=require('./MerchantSkuSyncMember')(sequelize);   //New


// TODO: Uncomment as you build each module
// const WarehouseZone         = require('./WarehouseZone')(sequelize);
// const RackLocation          = require('./RackLocation')(sequelize);
// const PlatformConnection    = require('./PlatformConnection')(sequelize);
// const Product               = require('./Product')(sequelize);
// const MerchantSku           = require('./MerchantSku')(sequelize);
// const CombineSku            = require('./CombineSku')(sequelize);
// const CombineSkuItem        = require('./CombineSkuItem')(sequelize);
// const PlatformProductBinding= require('./PlatformProductBinding')(sequelize);
// const Inventory             = require('./Inventory')(sequelize);
// const InventoryMovement     = require('./InventoryMovement')(sequelize);
// const InboundOrder          = require('./InboundOrder')(sequelize);
// const InboundOrderItem      = require('./InboundOrderItem')(sequelize);
// const Order                 = require('./Order')(sequelize);
// const OrderItem             = require('./OrderItem')(sequelize);
// const OrderLog              = require('./OrderLog')(sequelize);
// const AuditLog              = require('./AuditLog')(sequelize);
// const Notification          = require('./Notification')(sequelize);

const models = {
    sequelize,
    Company,
    Role,
    Pages,
    User,
    UserStorePermission,
    UserWarehousePermission,
    Warehouse,

    // SKU management
    MerchantSku,
    CombineSku,
    CombineSkuItem,

    // Stock
    SkuWarehouseStock,
    StockLedgerEntry,

    // Inbound
    InboundOrder,
    InboundOrderLine,

    // Outbound
    OutboundOrder,
    OutboundOrderLine,

    // Platform
    PlatformStore,
    PlatformSkuMapping,
    OrderSaleLine,
    PlatformProduct,
    PackFailedOrder,
    PushSuccessfulOrder,
    WithdrawOrder,
    ManualOrder,
    ManualOrderItem,
    ManualOrderStatusHistory,
    PlatformOrderItemSkuOverride,
    PlatformManualOrder,
    PlatformManualOrderItem,
    ReturnOrder,
    ReturnOrderLine,
    ReturnOrderSyncState,
    MerchantSkuSyncGroup,
    MerchantSkuSyncMember
    // Add here as you uncomment above
};

// ─── Run all associations ─────────────────────────────────────────────────────
Object.values(models).forEach((model) => {
    if (model?.associate) model.associate(models);
});

module.exports = models;

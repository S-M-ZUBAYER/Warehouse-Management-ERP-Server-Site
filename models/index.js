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

// ── Platform integration ──────────────────────────────────────────────────────
const PlatformStore = require('./PlatformStore')(sequelize);       // NEW
const PlatformSkuMapping = require('./PlatformSkuMapping')(sequelize);  // NEW
const OrderSaleLine = require('./OrderSaleLine')(sequelize);       // NEW

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

    // Platform
    PlatformStore,
    PlatformSkuMapping,
    OrderSaleLine,
    // Add here as you uncomment above
};

// ─── Run all associations ─────────────────────────────────────────────────────
Object.values(models).forEach((model) => {
    if (model?.associate) model.associate(models);
});

module.exports = models;
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
const MerchantSku = require('./MerchantSku')(sequelize);
const CombineSku = require('./CombineSku')(sequelize);
const CombineSkuItem = require('./CombineSkuItem')(sequelize);

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
    MerchantSku,
    CombineSku,
    CombineSkuItem,
    // Add here as you uncomment above
};

// ─── Run all associations ─────────────────────────────────────────────────────
Object.values(models).forEach((model) => {
    if (model?.associate) model.associate(models);
});

module.exports = models;
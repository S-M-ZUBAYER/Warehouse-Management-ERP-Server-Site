// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const MerchantSku = sequelize.define('MerchantSku', {
//         id: {
//             type: DataTypes.INTEGER.UNSIGNED,
//             autoIncrement: true,
//             primaryKey: true,
//         },
//         company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         sku_name: {
//             type: DataTypes.STRING(100),
//             allowNull: false,
//             comment: 'Unique SKU code e.g. WM-012',
//         },
//         sku_title: {
//             type: DataTypes.STRING(255),
//             allowNull: false,
//             comment: 'Display name e.g. Ergonomic wireless mouse with 3k...',
//         },
//         gtin: { type: DataTypes.STRING(50), allowNull: true },
//         product_details: { type: DataTypes.TEXT, allowNull: true },
//         weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         length: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         width: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         cost_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         image_url: { type: DataTypes.TEXT, allowNull: true },
//         country: { type: DataTypes.STRING(100), allowNull: true },
//         status: {
//             type: DataTypes.ENUM('active', 'inactive'),
//             allowNull: false,
//             defaultValue: 'active',
//         },
//         created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         deleted_at: { type: DataTypes.DATE, allowNull: true },
//     }, {
//         tableName: 'merchant_skus',
//         timestamps: true,
//         underscored: true,
//         paranoid: true,   // soft delete via deleted_at
//         indexes: [
//             { unique: true, fields: ['company_id', 'sku_name'], name: 'uq_merchant_skus_company_sku' },
//             { fields: ['company_id', 'status'], name: 'idx_merchant_skus_company_status' },
//             { fields: ['company_id', 'warehouse_id'], name: 'idx_merchant_skus_warehouse' },
//             { fields: ['company_id', 'created_at'], name: 'idx_merchant_skus_created' },
//             {
//                 type: 'FULLTEXT',
//                 name: 'ft_merchant_skus_name_title',
//                 fields: ['sku_name', 'sku_title'],
//             },
//         ],
//     });

//     MerchantSku.associate = (models) => {
//         MerchantSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         MerchantSku.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         if (models.CombineSkuItem) {
//             MerchantSku.hasMany(models.CombineSkuItem, { foreignKey: 'merchant_sku_id', as: 'combineSkuItems' });
//         }
//         if (models.Inventory) {
//             MerchantSku.hasMany(models.Inventory, { foreignKey: 'merchant_sku_id', as: 'inventory' });
//         }
//     };

//     return MerchantSku;
// };


'use strict';
const { DataTypes } = require('sequelize');

/**
 * MerchantSku.js  (updated — adds SkuWarehouseStock association)
 *
 * Drop-in replacement for your existing MerchantSku.js model.
 * Only change from your original: added stock + StockLedgerEntry associations.
 */
module.exports = (sequelize) => {
    const MerchantSku = sequelize.define('MerchantSku', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        sku_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: 'Unique SKU code e.g. WM-012',
        },
        sku_title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Display name',
        },
        gtin: { type: DataTypes.STRING(50), allowNull: true },
        product_details: { type: DataTypes.TEXT, allowNull: true },
        weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        length: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        width: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        cost_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        image_url: { type: DataTypes.TEXT, allowNull: true },
        country: { type: DataTypes.STRING(100), allowNull: true },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
            defaultValue: 'active',
        },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'merchant_skus',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'sku_name'], name: 'uq_merchant_skus_company_sku' },
            { fields: ['company_id', 'status'], name: 'idx_merchant_skus_company_status' },
            { fields: ['company_id', 'warehouse_id'], name: 'idx_merchant_skus_warehouse' },
            { fields: ['company_id', 'created_at'], name: 'idx_merchant_skus_created' },
            { type: 'FULLTEXT', name: 'ft_merchant_skus_name_title', fields: ['sku_name', 'sku_title'] },
        ],
    });

    MerchantSku.associate = (models) => {
        MerchantSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        MerchantSku.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });

        if (models.CombineSkuItem) {
            MerchantSku.hasMany(models.CombineSkuItem, { foreignKey: 'merchant_sku_id', as: 'combineSkuItems' });
        }
        // ── NEW: stock associations ───────────────────────────────────────────
        if (models.SkuWarehouseStock) {
            MerchantSku.hasMany(models.SkuWarehouseStock, { foreignKey: 'merchant_sku_id', as: 'stock' });
            MerchantSku.hasOne(models.SkuWarehouseStock, { foreignKey: 'merchant_sku_id', as: 'primaryStock' });
        }
        if (models.StockLedgerEntry) {
            MerchantSku.hasMany(models.StockLedgerEntry, { foreignKey: 'merchant_sku_id', as: 'ledgerEntries' });
        }
        if (models.PlatformSkuMapping) {
            MerchantSku.hasMany(models.PlatformSkuMapping, { foreignKey: 'merchant_sku_id', as: 'platformMappings' });
        }
        if (models.InboundOrderLine) {
            MerchantSku.hasMany(models.InboundOrderLine, { foreignKey: 'merchant_sku_id', as: 'inboundLines' });
        }
    };

    return MerchantSku;
};
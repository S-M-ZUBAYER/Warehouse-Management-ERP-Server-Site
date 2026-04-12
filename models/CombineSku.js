// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const CombineSku = sequelize.define('CombineSku', {
//         id: {
//             type: DataTypes.INTEGER.UNSIGNED,
//             autoIncrement: true,
//             primaryKey: true,
//         },
//         company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         combine_name: { type: DataTypes.STRING(255), allowNull: false },
//         combine_sku_code: { type: DataTypes.STRING(100), allowNull: false },
//         gtin: { type: DataTypes.STRING(50), allowNull: true },
//         description: { type: DataTypes.TEXT, allowNull: true },
//         selling_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         cost_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         length: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         width: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
//         image_url: { type: DataTypes.TEXT, allowNull: true },
//         status: {
//             type: DataTypes.ENUM('active', 'inactive'),
//             defaultValue: 'active',
//         },
//         created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         deleted_at: { type: DataTypes.DATE, allowNull: true },
//     }, {
//         tableName: 'combine_skus',
//         timestamps: true,
//         underscored: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'combine_sku_code'], name: 'uq_combine_skus_company_code' },
//             { fields: ['company_id'], name: 'idx_combine_skus_company' },
//             { fields: ['company_id', 'warehouse_id'], name: 'idx_combine_skus_warehouse' },
//             { fields: ['company_id', 'created_at'], name: 'idx_combine_skus_created' },
//         ],
//     });

//     CombineSku.associate = (models) => {
//         CombineSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         CombineSku.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         if (models.CombineSkuItem) {
//             CombineSku.hasMany(models.CombineSkuItem, {
//                 foreignKey: 'combine_sku_id',
//                 as: 'items',
//             });
//         }
//     };

//     return CombineSku;
// };


'use strict';
const { DataTypes } = require('sequelize');

/**
 * CombineSku.js  (updated — adds computed_quantity column + new associations)
 *
 * Drop-in replacement for your existing CombineSku.js model.
 */
module.exports = (sequelize) => {
    const CombineSku = sequelize.define('CombineSku', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        combine_name: { type: DataTypes.STRING(255), allowNull: false },
        combine_sku_code: { type: DataTypes.STRING(100), allowNull: false },
        gtin: { type: DataTypes.STRING(50), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        selling_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        cost_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        length: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        width: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        height: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        image_url: { type: DataTypes.TEXT, allowNull: true },

        // ── NEW: computed by worker using MIN(FLOOR(qty_on_hand / item.quantity)) ──
        computed_quantity: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            comment: 'Auto-computed: MIN(FLOOR(child_qty_on_hand / ratio)) — updated by Redis worker',
        },

        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active',
        },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'combine_skus',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'combine_sku_code'], name: 'uq_combine_skus_company_code' },
            { fields: ['company_id'], name: 'idx_combine_skus_company' },
            { fields: ['company_id', 'warehouse_id'], name: 'idx_combine_skus_warehouse' },
            { fields: ['company_id', 'created_at'], name: 'idx_combine_skus_created' },
        ],
    });

    CombineSku.associate = (models) => {
        CombineSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        CombineSku.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });

        if (models.CombineSkuItem) {
            CombineSku.hasMany(models.CombineSkuItem, { foreignKey: 'combine_sku_id', as: 'items' });
        }
        // ── NEW ──────────────────────────────────────────────────────────────
        if (models.PlatformSkuMapping) {
            CombineSku.hasMany(models.PlatformSkuMapping, { foreignKey: 'combine_sku_id', as: 'platformMappings' });
        }
    };

    return CombineSku;
};
// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const PlatformStore = sequelize.define('PlatformStore', {
//         id: {
//             type: DataTypes.INTEGER.UNSIGNED,
//             autoIncrement: true,
//             primaryKey: true,
//         },
//         company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         platform: { type: DataTypes.ENUM('shopee', 'tiktok', 'lazada'), allowNull: false },
//         store_name: { type: DataTypes.STRING(255), allowNull: false },
//         external_store_id: { type: DataTypes.STRING(100), allowNull: false },
//         external_store_name: { type: DataTypes.STRING(255), allowNull: true },
//         region: { type: DataTypes.STRING(10), allowNull: true },
//         access_token: { type: DataTypes.TEXT, allowNull: true },
//         refresh_token: { type: DataTypes.TEXT, allowNull: true },
//         token_expires_at: { type: DataTypes.DATE, allowNull: true },
//         webhook_secret: { type: DataTypes.STRING(255), allowNull: true },
//         default_warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
//         created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
//         deleted_at: { type: DataTypes.DATE, allowNull: true },
//     }, {
//         tableName: 'platform_stores',
//         timestamps: true,
//         underscored: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'platform', 'external_store_id'], name: 'uq_platform_stores' },
//             { fields: ['company_id'], name: 'idx_ps_company' },
//             { fields: ['company_id', 'is_active'], name: 'idx_ps_active' },
//         ],
//     });

//     PlatformStore.associate = (models) => {
//         PlatformStore.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         PlatformStore.belongsTo(models.Warehouse, { foreignKey: 'default_warehouse_id', as: 'defaultWarehouse' });
//         PlatformStore.hasMany(models.PlatformSkuMapping, { foreignKey: 'platform_store_id', as: 'skuMappings' });
//     };

//     return PlatformStore;
// };

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformStore = sequelize.define('PlatformStore', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('shopee', 'tiktok', 'lazada'), allowNull: false },
        store_name: { type: DataTypes.STRING(255), allowNull: false },
        external_store_id: { type: DataTypes.STRING(100), allowNull: false },
        external_store_name: { type: DataTypes.STRING(255), allowNull: true },

        // Extended platform identifiers (optional)
        store_shop_id: { type: DataTypes.STRING(100), allowNull: true },
        store_open_id: { type: DataTypes.STRING(100), allowNull: true },
        store_cipher: { type: DataTypes.STRING(255), allowNull: true },

        region: { type: DataTypes.STRING(10), allowNull: true },
        access_token: { type: DataTypes.TEXT, allowNull: true },
        refresh_token: { type: DataTypes.TEXT, allowNull: true },
        token_expires_at: { type: DataTypes.DATE, allowNull: true },
        webhook_secret: { type: DataTypes.STRING(255), allowNull: true },
        default_warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'platform_stores',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'platform', 'external_store_id'], name: 'uq_platform_stores' },
            { fields: ['company_id'], name: 'idx_ps_company' },
            { fields: ['company_id', 'is_active'], name: 'idx_ps_active' },
        ],
    });

    PlatformStore.associate = (models) => {
        PlatformStore.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        PlatformStore.belongsTo(models.Warehouse, { foreignKey: 'default_warehouse_id', as: 'defaultWarehouse' });
        PlatformStore.hasMany(models.PlatformSkuMapping, { foreignKey: 'platform_store_id', as: 'skuMappings' });
    };

    return PlatformStore;
};
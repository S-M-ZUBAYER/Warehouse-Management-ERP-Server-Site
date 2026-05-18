// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const PlatformConnection = sequelize.define('PlatformConnection', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         platform_type: {
//             type: DataTypes.ENUM('shopee', 'lazada', 'tiktok_shop', 'tokopedia', 'bukalapak', 'woocommerce', 'shopify', 'manual'),
//             allowNull: false,
//         },
//         shop_name: { type: DataTypes.STRING(150), allowNull: false },
//         shop_id: { type: DataTypes.STRING(100), allowNull: true },
//         access_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
//         refresh_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
//         token_expires_at: { type: DataTypes.DATE, allowNull: true },
//         permissions: { type: DataTypes.JSON, defaultValue: [] },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//         last_sync_at: { type: DataTypes.DATE, allowNull: true },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, comment: 'Default warehouse for this platform' },
//     }, {
//         tableName: 'platform_connections',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { fields: ['company_id'], name: 'idx_platform_company' },
//             { fields: ['company_id', 'platform_type'], name: 'idx_platform_company_type' },
//             { unique: true, fields: ['company_id', 'shop_id', 'platform_type'], name: 'uq_platform_company_shop' },
//             { fields: ['warehouse_id'], name: 'idx_platform_warehouse' },
//         ],
//     });

//     PlatformConnection.associate = (models) => {
//         PlatformConnection.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         PlatformConnection.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         PlatformConnection.hasMany(models.Order, { foreignKey: 'platform_connection_id', as: 'orders' });
//         PlatformConnection.hasMany(models.PlatformProductBinding, { foreignKey: 'platform_connection_id', as: 'bindings' });
//     };

//     return PlatformConnection;
// };
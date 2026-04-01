// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const PlatformProductBinding = sequelize.define('PlatformProductBinding', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         platform_connection_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         combine_sku_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         platform_sku: { type: DataTypes.STRING(150), allowNull: false },
//         platform_item_id: { type: DataTypes.STRING(150), allowNull: true },
//         platform_item_name: { type: DataTypes.STRING(255), allowNull: true },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//     }, {
//         tableName: 'platform_product_bindings',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['platform_connection_id', 'platform_sku'], name: 'uq_binding_platform_sku' },
//             { fields: ['company_id'], name: 'idx_binding_company' },
//             { fields: ['product_id'], name: 'idx_binding_product' },
//             { fields: ['platform_connection_id'], name: 'idx_binding_platform' },
//             { type: 'FULLTEXT', fields: ['platform_sku', 'platform_item_name'], name: 'ft_binding_search' },
//         ],
//     });

//     PlatformProductBinding.associate = (models) => {
//         PlatformProductBinding.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         PlatformProductBinding.belongsTo(models.PlatformConnection, { foreignKey: 'platform_connection_id', as: 'platform' });
//         PlatformProductBinding.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         PlatformProductBinding.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
//     };

//     return PlatformProductBinding;
// };
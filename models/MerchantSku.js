// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const MerchantSku = sequelize.define('MerchantSku', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         sku_code: { type: DataTypes.STRING(100), allowNull: false },
//         platform_type: { type: DataTypes.STRING(50), allowNull: true },
//         platform_connection_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         platform_item_id: { type: DataTypes.STRING(100), allowNull: true },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//     }, {
//         tableName: 'merchant_skus',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'sku_code', 'platform_connection_id'], name: 'uq_merchant_sku' },
//             { fields: ['company_id'], name: 'idx_msku_company' },
//             { fields: ['product_id'], name: 'idx_msku_product' },
//             { fields: ['platform_connection_id'], name: 'idx_msku_platform' },
//             { type: 'FULLTEXT', fields: ['sku_code'], name: 'ft_msku_code' },
//         ],
//     });

//     MerchantSku.associate = (models) => {
//         MerchantSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         MerchantSku.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         MerchantSku.belongsTo(models.PlatformConnection, { foreignKey: 'platform_connection_id', as: 'platform' });
//     };

//     return MerchantSku;
// };
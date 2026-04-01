// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const CombineSkuItem = sequelize.define('CombineSkuItem', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         combine_sku_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
//     }, {
//         tableName: 'combine_sku_items',
//         timestamps: true,
//         indexes: [
//             { unique: true, fields: ['combine_sku_id', 'product_id'], name: 'uq_combine_sku_product' },
//             { fields: ['combine_sku_id'], name: 'idx_csku_item_combine' },
//             { fields: ['product_id'], name: 'idx_csku_item_product' },
//         ],
//     });

//     CombineSkuItem.associate = (models) => {
//         CombineSkuItem.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
//         CombineSkuItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//     };

//     return CombineSkuItem;
// };
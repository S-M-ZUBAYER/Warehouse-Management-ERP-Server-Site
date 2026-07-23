// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const OrderItem = sequelize.define('OrderItem', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         combine_sku_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         platform_sku: { type: DataTypes.STRING(150), allowNull: true },
//         product_name: { type: DataTypes.STRING(255), allowNull: true },
//         quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
//         unit_price: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
//         total_price: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
//         is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Whether platform SKU is mapped to a product' },
//     }, {
//         tableName: 'order_items',
//         timestamps: true,
//         indexes: [
//             { fields: ['order_id'], name: 'idx_oitem_order' },
//             { fields: ['product_id'], name: 'idx_oitem_product' },
//         ],
//     });

//     OrderItem.associate = (models) => {
//         OrderItem.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
//         OrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         OrderItem.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
//     };

//     return OrderItem;
// };
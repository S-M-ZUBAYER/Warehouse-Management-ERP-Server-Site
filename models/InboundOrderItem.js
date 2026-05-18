// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const InboundOrderItem = sequelize.define('InboundOrderItem', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         inbound_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         rack_location_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         expected_quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         received_quantity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
//         unit_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//     }, {
//         tableName: 'inbound_order_items',
//         timestamps: true,
//         indexes: [
//             { fields: ['inbound_order_id'], name: 'idx_inbound_item_order' },
//             { fields: ['product_id'], name: 'idx_inbound_item_product' },
//         ],
//     });

//     InboundOrderItem.associate = (models) => {
//         InboundOrderItem.belongsTo(models.InboundOrder, { foreignKey: 'inbound_order_id', as: 'inboundOrder' });
//         InboundOrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         InboundOrderItem.belongsTo(models.RackLocation, { foreignKey: 'rack_location_id', as: 'rackLocation' });
//     };

//     return InboundOrderItem;
// };
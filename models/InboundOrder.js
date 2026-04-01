// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const InboundOrder = sequelize.define('InboundOrder', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         inbound_no: { type: DataTypes.STRING(50), allowNull: false },
//         status: {
//             type: DataTypes.ENUM('draft', 'submitted', 'on_the_way', 'received', 'completed', 'cancelled'),
//             defaultValue: 'draft',
//         },
//         supplier_name: { type: DataTypes.STRING(150), allowNull: true },
//         expected_arrival: { type: DataTypes.DATEONLY, allowNull: true },
//         arrived_at: { type: DataTypes.DATE, allowNull: true },
//         notes: { type: DataTypes.TEXT, allowNull: true },
//         created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         total_items: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
//         total_quantity: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
//     }, {
//         tableName: 'inbound_orders',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'inbound_no'], name: 'uq_inbound_no' },
//             { fields: ['company_id'], name: 'idx_inbound_company' },
//             { fields: ['warehouse_id'], name: 'idx_inbound_warehouse' },
//             { fields: ['company_id', 'status'], name: 'idx_inbound_company_status' },
//             { fields: ['created_at'], name: 'idx_inbound_created_at' },
//         ],
//     });

//     InboundOrder.associate = (models) => {
//         InboundOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         InboundOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         InboundOrder.hasMany(models.InboundOrderItem, { foreignKey: 'inbound_order_id', as: 'items', onDelete: 'CASCADE' });
//     };

//     return InboundOrder;
// };
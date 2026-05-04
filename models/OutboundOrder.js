// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const OutboundOrder = sequelize.define('OutboundOrder', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         outbound_no: { type: DataTypes.STRING(50), allowNull: false },
//         status: {
//             type: DataTypes.ENUM('pending', 'picking', 'packed', 'dispatched', 'completed', 'cancelled'),
//             defaultValue: 'pending',
//         },
//         dispatched_at: { type: DataTypes.DATE, allowNull: true },
//         completed_at: { type: DataTypes.DATE, allowNull: true },
//         notes: { type: DataTypes.TEXT, allowNull: true },
//     }, {
//         tableName: 'outbound_orders',
//         timestamps: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'outbound_no'], name: 'uq_outbound_no' },
//             { fields: ['company_id'], name: 'idx_outbound_company' },
//             { fields: ['order_id'], name: 'idx_outbound_order' },
//             { fields: ['warehouse_id'], name: 'idx_outbound_warehouse' },
//             { fields: ['company_id', 'status'], name: 'idx_outbound_status' },
//         ],
//     });

//     OutboundOrder.associate = (models) => {
//         OutboundOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         OutboundOrder.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
//         OutboundOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//     };

//     return OutboundOrder;
// };
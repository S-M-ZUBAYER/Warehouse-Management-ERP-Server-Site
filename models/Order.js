// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const Order = sequelize.define('Order', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         platform_connection_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         order_no: { type: DataTypes.STRING(100), allowNull: false },
//         platform_order_id: { type: DataTypes.STRING(150), allowNull: true },
//         status: {
//             type: DataTypes.ENUM('new', 'processing', 'packed', 'pickup', 'shipped', 'completed', 'cancelled', 'returned'),
//             defaultValue: 'new',
//         },
//         is_manual: { type: DataTypes.BOOLEAN, defaultValue: false },
//         buyer_name: { type: DataTypes.STRING(150), allowNull: true },
//         buyer_phone: { type: DataTypes.STRING(30), allowNull: true },
//         shipping_address: { type: DataTypes.TEXT, allowNull: true },
//         shipping_method: { type: DataTypes.STRING(80), allowNull: true },
//         tracking_number: { type: DataTypes.STRING(150), allowNull: true },
//         total_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
//         notes: { type: DataTypes.TEXT, allowNull: true },
//         platform_created_at: { type: DataTypes.DATE, allowNull: true },
//         packed_at: { type: DataTypes.DATE, allowNull: true },
//         shipped_at: { type: DataTypes.DATE, allowNull: true },
//         completed_at: { type: DataTypes.DATE, allowNull: true },
//     }, {
//         tableName: 'orders',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'order_no'], name: 'uq_order_company_no' },
//             { fields: ['company_id'], name: 'idx_order_company' },
//             { fields: ['company_id', 'status'], name: 'idx_order_company_status' },
//             { fields: ['platform_connection_id'], name: 'idx_order_platform' },
//             { fields: ['warehouse_id'], name: 'idx_order_warehouse' },
//             { fields: ['platform_order_id'], name: 'idx_order_platform_id' },
//             { fields: ['created_at'], name: 'idx_order_created_at' },
//             { type: 'FULLTEXT', fields: ['order_no', 'buyer_name', 'tracking_number'], name: 'ft_order_search' },
//         ],
//     });

//     Order.associate = (models) => {
//         Order.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         Order.belongsTo(models.PlatformConnection, { foreignKey: 'platform_connection_id', as: 'platform' });
//         Order.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
//         Order.hasMany(models.OrderLog, { foreignKey: 'order_id', as: 'logs' });
//     };

//     return Order;
// };
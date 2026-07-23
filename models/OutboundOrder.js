'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OutboundOrder = sequelize.define('OutboundOrder', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        outbound_id: { type: DataTypes.STRING(30), allowNull: false },
        status: {
            type: DataTypes.ENUM('draft', 'on_the_way', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'draft',
        },
        tracking_number: { type: DataTypes.STRING(100), allowNull: true },
        purchase_currency: { type: DataTypes.STRING(10), allowNull: true },
        exchange_rate: { type: DataTypes.DECIMAL(15, 6), allowNull: true },
        supplier_name: { type: DataTypes.STRING(255), allowNull: true },
        supplier_reference: { type: DataTypes.STRING(100), allowNull: true },
        receiving_warehouse_name: { type: DataTypes.STRING(255), allowNull: true },
        receiving_warehouse_address: { type: DataTypes.TEXT, allowNull: true },
        shipping_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        estimated_arrival: { type: DataTypes.DATEONLY, allowNull: true },
        shipped_at: { type: DataTypes.DATE, allowNull: true },
        arrived_at: { type: DataTypes.DATE, allowNull: true },
        is_manual: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
},
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'outbound_orders',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'outbound_id'], name: 'uq_outbound_orders_outbound_id' },
            { fields: ['company_id'], name: 'idx_outbound_company' },
            { fields: ['warehouse_id'], name: 'idx_outbound_warehouse' },
            { fields: ['company_id', 'status'], name: 'idx_outbound_status' },
            { fields: ['tracking_number'], name: 'idx_outbound_tracking' },
        ],
    });

    OutboundOrder.associate = (models) => {
        OutboundOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        OutboundOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
        OutboundOrder.hasMany(models.OutboundOrderLine, { foreignKey: 'outbound_order_id', as: 'lines' });
    };

    return OutboundOrder;
};
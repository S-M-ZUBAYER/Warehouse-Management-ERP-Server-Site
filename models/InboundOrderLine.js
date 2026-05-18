'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InboundOrderLine = sequelize.define('InboundOrderLine', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        inbound_order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        qty_expected: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        qty_received: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        unit_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        currency: { type: DataTypes.STRING(10), allowNull: true },
        has_discrepancy: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        discrepancy_notes: { type: DataTypes.STRING(500), allowNull: true },
    }, {
        tableName: 'inbound_order_lines',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['inbound_order_id', 'merchant_sku_id'], name: 'uq_inbound_order_lines' },
            { fields: ['company_id'], name: 'idx_iol_company' },
            { fields: ['inbound_order_id'], name: 'idx_iol_inbound_order' },
            { fields: ['merchant_sku_id'], name: 'idx_iol_merchant_sku' },
        ],
    });

    InboundOrderLine.associate = (models) => {
        InboundOrderLine.belongsTo(models.InboundOrder, { foreignKey: 'inbound_order_id', as: 'inboundOrder' });
        InboundOrderLine.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
    };

    return InboundOrderLine;
};
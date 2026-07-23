'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OrderSaleLine = sequelize.define('OrderSaleLine', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_sku_mapping_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_order_id: { type: DataTypes.STRING(100), allowNull: false },
        platform_order_item_id: { type: DataTypes.STRING(100), allowNull: true },
        quantity_sold: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        deducted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        deducted_at: { type: DataTypes.DATE, allowNull: true },
        sale_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        currency: { type: DataTypes.STRING(10), allowNull: true },
        sold_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'order_sale_lines',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['platform_sku_mapping_id', 'platform_order_id', 'platform_order_item_id'],
                name: 'uq_osl_order_mapping',
            },
            { fields: ['company_id'], name: 'idx_osl_company' },
            { fields: ['platform_sku_mapping_id'], name: 'idx_osl_mapping' },
            { fields: ['platform_order_id'], name: 'idx_osl_platform_order' },
            { fields: ['deducted'], name: 'idx_osl_deducted' },
            { fields: ['sold_at'], name: 'idx_osl_sold_at' },
        ],
    });

    OrderSaleLine.associate = (models) => {
        OrderSaleLine.belongsTo(models.PlatformSkuMapping, {
            foreignKey: 'platform_sku_mapping_id',
            as: 'mapping',
        });
    };

    return OrderSaleLine;
};
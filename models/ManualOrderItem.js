'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ManualOrderItem = sequelize.define('ManualOrderItem', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        manual_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        combine_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        sku: { type: DataTypes.STRING(100), allowNull: false },
        product_name: { type: DataTypes.STRING(255), allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        weight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        line_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        image_url: { type: DataTypes.TEXT('long'), allowNull: true },
        qty_on_hand_before: { type: DataTypes.INTEGER, allowNull: true },
        qty_on_hand_after: { type: DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: 'manual_order_items',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            { fields: ['company_id'], name: 'idx_moi_company' },
            { fields: ['manual_order_id'], name: 'idx_moi_order' },
            { fields: ['merchant_sku_id'], name: 'idx_moi_merchant_sku' },
            { fields: ['combine_sku_id'], name: 'idx_moi_merchant_sku_combine' },
        ],
    });

    ManualOrderItem.associate = (models) => {
        ManualOrderItem.belongsTo(models.ManualOrder, { foreignKey: 'manual_order_id', as: 'order' });
        ManualOrderItem.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
        ManualOrderItem.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
        ManualOrderItem.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
    };

    return ManualOrderItem;
};


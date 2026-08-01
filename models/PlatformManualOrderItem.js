'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformManualOrderItem = sequelize.define('PlatformManualOrderItem', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_manual_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        combine_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        sku: { type: DataTypes.STRING(100), allowNull: false },
        product_name: { type: DataTypes.STRING(255), allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        weight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        qty_on_hand_before: { type: DataTypes.INTEGER, allowNull: true },
        qty_on_hand_after: { type: DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: 'platform_manual_order_items',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            { fields: ['company_id'], name: 'idx_pmoi_company' },
            { fields: ['platform_manual_order_id'], name: 'idx_pmoi_order' },
            { fields: ['merchant_sku_id'], name: 'idx_pmoi_merchant_sku' },
            { fields: ['combine_sku_id'], name: 'idx_pmoi_merchant_sku_combine' },
            { fields: ['sku'], name: 'idx_pmoi_sku' },
        ],
    });

    PlatformManualOrderItem.associate = (models) => {
        PlatformManualOrderItem.belongsTo(models.PlatformManualOrder, { foreignKey: 'platform_manual_order_id', as: 'order' });
        PlatformManualOrderItem.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
        PlatformManualOrderItem.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
        PlatformManualOrderItem.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
    };

    return PlatformManualOrderItem;
};


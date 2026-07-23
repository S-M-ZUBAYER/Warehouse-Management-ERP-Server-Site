'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformOrderItemSkuOverride = sequelize.define('PlatformOrderItemSkuOverride', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('shopee', 'tiktok'), allowNull: false },
        platform_order_id: { type: DataTypes.STRING(100), allowNull: false },
        platform_order_item_id: { type: DataTypes.STRING(100), allowNull: false },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        shop_id: { type: DataTypes.STRING(100), allowNull: true },
        open_id: { type: DataTypes.STRING(100), allowNull: true },
        cipher_id: { type: DataTypes.STRING(255), allowNull: true },
        original_platform_mapping_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        original_merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        original_combine_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        replacement_merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        replacement_warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        reason: { type: DataTypes.STRING(100), allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        status: {
            type: DataTypes.ENUM('active', 'packed', 'cancelled'),
            allowNull: false,
            defaultValue: 'active',
        },
        packed_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'platform_order_item_sku_overrides',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['company_id', 'platform', 'platform_order_id', 'platform_order_item_id'],
                name: 'uq_pois_override_order_item',
            },
            { fields: ['company_id'], name: 'idx_pois_company' },
            { fields: ['platform', 'platform_order_id'], name: 'idx_pois_platform_order' },
            { fields: ['original_platform_mapping_id'], name: 'idx_pois_original_mapping' },
            { fields: ['replacement_merchant_sku_id'], name: 'idx_pois_replacement_sku' },
            { fields: ['status'], name: 'idx_pois_status' },
        ],
    });

    PlatformOrderItemSkuOverride.associate = (models) => {
        PlatformOrderItemSkuOverride.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        PlatformOrderItemSkuOverride.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        PlatformOrderItemSkuOverride.belongsTo(models.PlatformSkuMapping, { foreignKey: 'original_platform_mapping_id', as: 'originalMapping' });
        PlatformOrderItemSkuOverride.belongsTo(models.MerchantSku, { foreignKey: 'original_merchant_sku_id', as: 'originalMerchantSku' });
        PlatformOrderItemSkuOverride.belongsTo(models.CombineSku, { foreignKey: 'original_combine_sku_id', as: 'originalCombineSku' });
        PlatformOrderItemSkuOverride.belongsTo(models.MerchantSku, { foreignKey: 'replacement_merchant_sku_id', as: 'replacementMerchantSku' });
        PlatformOrderItemSkuOverride.belongsTo(models.Warehouse, { foreignKey: 'replacement_warehouse_id', as: 'replacementWarehouse' });
    };

    return PlatformOrderItemSkuOverride;
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformSkuMapping = sequelize.define('PlatformSkuMapping', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        combine_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        fulfillment_warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        platform_sku_id: { type: DataTypes.STRING(100), allowNull: true },
        platform_listing_id: { type: DataTypes.STRING(100), allowNull: true },
        platform_model_id: { type: DataTypes.STRING(100), allowNull: true },
        last_synced_at: { type: DataTypes.DATE, allowNull: true },
        sync_status: {
            type: DataTypes.ENUM('pending', 'synced', 'failed', 'out_of_sync'),
            allowNull: false,
            defaultValue: 'pending',
        },
        sync_error: { type: DataTypes.TEXT, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'platform_sku_mappings',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['platform_store_id', 'merchant_sku_id'], name: 'uq_psm_store_merchant' },
            { unique: true, fields: ['platform_store_id', 'combine_sku_id'], name: 'uq_psm_store_combine' },
            { fields: ['company_id'], name: 'idx_psm_company' },
            { fields: ['platform_store_id'], name: 'idx_psm_platform_store' },
            { fields: ['merchant_sku_id'], name: 'idx_psm_merchant_sku' },
            { fields: ['combine_sku_id'], name: 'idx_psm_combine_sku' },
            { fields: ['sync_status'], name: 'idx_psm_sync_status' },
        ],
    });

    PlatformSkuMapping.associate = (models) => {
        PlatformSkuMapping.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        PlatformSkuMapping.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
        PlatformSkuMapping.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
        PlatformSkuMapping.belongsTo(models.Warehouse, { foreignKey: 'fulfillment_warehouse_id', as: 'fulfillmentWarehouse' });
        PlatformSkuMapping.hasMany(models.OrderSaleLine, { foreignKey: 'platform_sku_mapping_id', as: 'saleLines' });
    };

    return PlatformSkuMapping;
};
'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ReturnOrder = sequelize.define('ReturnOrder', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('manual', 'shopee', 'tiktok'), allowNull: false, defaultValue: 'manual' },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        store_name: { type: DataTypes.STRING(255), allowNull: true },
        platform_return_id: { type: DataTypes.STRING(100), allowNull: true },
        platform_order_id: { type: DataTypes.STRING(100), allowNull: true },
        order_number: { type: DataTypes.STRING(100), allowNull: true },
        platform_created_at: { type: DataTypes.DATE, allowNull: true },
        platform_updated_at: { type: DataTypes.DATE, allowNull: true },
        buyer_username: { type: DataTypes.STRING(255), allowNull: true },
        buyer_email: { type: DataTypes.STRING(255), allowNull: true },
        buyer_portrait_url: { type: DataTypes.TEXT, allowNull: true },
        return_images_json: { type: DataTypes.JSON, allowNull: true },
        warehouse_package_no: { type: DataTypes.STRING(100), allowNull: true },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        platform_return_status: { type: DataTypes.STRING(120), allowNull: true },
        platform_status_label: { type: DataTypes.STRING(120), allowNull: true },
        erp_return_status: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'need_to_check' },
        return_reason: { type: DataTypes.STRING(255), allowNull: true },
        return_reason_text: { type: DataTypes.STRING(500), allowNull: true },
        return_type: { type: DataTypes.STRING(100), allowNull: true },
        local_return_type: { type: DataTypes.STRING(100), allowNull: true },
        return_method: { type: DataTypes.STRING(100), allowNull: true },
        shipment_type: { type: DataTypes.STRING(100), allowNull: true },
        handover_method: { type: DataTypes.STRING(100), allowNull: true },
        return_tracking_number: { type: DataTypes.STRING(150), allowNull: true },
        local_return_tracking_number: { type: DataTypes.STRING(150), allowNull: true },
        return_provider_id: { type: DataTypes.STRING(120), allowNull: true },
        return_provider_name: { type: DataTypes.STRING(255), allowNull: true },
        logistic_name: { type: DataTypes.STRING(255), allowNull: true },
        return_warehouse_address: { type: DataTypes.TEXT, allowNull: true },
        remark: { type: DataTypes.TEXT, allowNull: true },
        refund_currency: { type: DataTypes.STRING(10), allowNull: true },
        refund_total: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        seller_next_action_json: { type: DataTypes.JSON, allowNull: true },
        discount_amount_json: { type: DataTypes.JSON, allowNull: true },
        shipping_fee_amount_json: { type: DataTypes.JSON, allowNull: true },
        raw_json: { type: DataTypes.JSON, allowNull: true },
        is_manual: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_resaleable_inbounded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        resaleable_inbound_order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'return_orders',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'platform', 'platform_return_id'], name: 'uq_return_orders_platform_return' },
            { fields: ['company_id', 'platform'], name: 'idx_return_orders_company_platform' },
            { fields: ['platform_store_id'], name: 'idx_return_orders_store' },
            { fields: ['warehouse_id'], name: 'idx_return_orders_warehouse' },
            { fields: ['company_id', 'platform_order_id'], name: 'idx_return_orders_order' },
            { fields: ['company_id', 'erp_return_status'], name: 'idx_return_orders_status' },
            { fields: ['company_id', 'platform_created_at'], name: 'idx_return_orders_platform_created' },
            { fields: ['company_id', 'platform_updated_at'], name: 'idx_return_orders_platform_updated' },
            { fields: ['company_id', 'updated_at'], name: 'idx_return_orders_updated' },
        ],
    });

    ReturnOrder.associate = (models) => {
        ReturnOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        ReturnOrder.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        ReturnOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
        ReturnOrder.belongsTo(models.InboundOrder, { foreignKey: 'resaleable_inbound_order_id', as: 'resaleableInboundOrder' });
        ReturnOrder.hasMany(models.ReturnOrderLine, { foreignKey: 'return_order_id', as: 'lines' });
    };

    return ReturnOrder;
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformManualOrder = sequelize.define('PlatformManualOrder', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        order_number: { type: DataTypes.STRING(100), allowNull: false },
        order_time: { type: DataTypes.STRING(10), allowNull: false },
        order_date: { type: DataTypes.DATEONLY, allowNull: false },
        waybill_file_name: { type: DataTypes.STRING(255), allowNull: false },
        waybill_url: { type: DataTypes.TEXT('long'), allowNull: false },
        shipment_status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Processed' },
        logistic: { type: DataTypes.JSON, allowNull: false },
        sender: { type: DataTypes.JSON, allowNull: false },
        buyer: { type: DataTypes.JSON, allowNull: false },
        package_details: { type: DataTypes.JSON, allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'platform_manual_orders',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'order_number'], name: 'uq_platform_manual_orders_company_order' },
            { fields: ['company_id', 'warehouse_id'], name: 'idx_pmo_company_warehouse' },
            { fields: ['company_id', 'shipment_status'], name: 'idx_pmo_company_status' },
            { fields: ['company_id', 'order_date'], name: 'idx_pmo_company_order_date' },
        ],
    });

    PlatformManualOrder.associate = (models) => {
        PlatformManualOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        PlatformManualOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
        PlatformManualOrder.hasMany(models.PlatformManualOrderItem, { foreignKey: 'platform_manual_order_id', as: 'items' });
    };

    return PlatformManualOrder;
};

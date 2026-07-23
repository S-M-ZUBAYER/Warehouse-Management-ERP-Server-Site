'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ManualOrder = sequelize.define('ManualOrder', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        order_number: { type: DataTypes.STRING(100), allowNull: false },
        type: {
            type: DataTypes.ENUM('manual_order', 'gift'),
            allowNull: false,
            defaultValue: 'manual_order',
        },
        // Keep status as a string so the manual-order flow can grow without MySQL ENUM failures.
        status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'CREATED' },
        shipment_status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'CREATED' },
        cod_status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'COD_NOT_APPLICABLE' },
        booking_status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'SAVED_ONLY' },
        logistic_service_id: { type: DataTypes.STRING(100), allowNull: true },
        logistic_company: { type: DataTypes.STRING(150), allowNull: true },
        logistic_raw: { type: DataTypes.JSON, allowNull: true },
        tracking_number: { type: DataTypes.STRING(150), allowNull: true },
        awb_number: { type: DataTypes.STRING(150), allowNull: true },
        provider_order_number: { type: DataTypes.STRING(150), allowNull: true },
        provider_shipment_number: { type: DataTypes.STRING(150), allowNull: true },
        parcel_number: { type: DataTypes.STRING(150), allowNull: true },
        waybill_pdf_url: { type: DataTypes.TEXT('long'), allowNull: true },
        waybill_pdf_filename: { type: DataTypes.STRING(255), allowNull: true },
        tracking_url: { type: DataTypes.TEXT('long'), allowNull: true },
        booking_error: { type: DataTypes.TEXT, allowNull: true },
        raw_provider_status: { type: DataTypes.STRING(255), allowNull: true },
        easyparcel_country: { type: DataTypes.STRING(10), allowNull: true },
        sender_name: { type: DataTypes.STRING(150), allowNull: true },
        sender_company: { type: DataTypes.STRING(150), allowNull: true },
        sender_phone: { type: DataTypes.STRING(50), allowNull: true },
        sender_email: { type: DataTypes.STRING(150), allowNull: true },
        sender_address: { type: DataTypes.TEXT, allowNull: true },
        sender_country: { type: DataTypes.STRING(20), allowNull: true },
        sender_state: { type: DataTypes.STRING(100), allowNull: true },
        sender_city: { type: DataTypes.STRING(100), allowNull: true },
        sender_postcode: { type: DataTypes.STRING(30), allowNull: true },
        sender_unit: { type: DataTypes.STRING(100), allowNull: true },
        receiver_email: { type: DataTypes.STRING(150), allowNull: true },
        currency: { type: DataTypes.STRING(10), allowNull: true },
        buyer_name: { type: DataTypes.STRING(150), allowNull: true },
        buyer_phone: { type: DataTypes.STRING(50), allowNull: true },
        buyer_address: { type: DataTypes.TEXT, allowNull: true },
        buyer_country: { type: DataTypes.STRING(100), allowNull: true },
        buyer_state: { type: DataTypes.STRING(100), allowNull: true },
        buyer_city: { type: DataTypes.STRING(100), allowNull: true },
        buyer_area: { type: DataTypes.STRING(100), allowNull: true },
        buyer_zip_code: { type: DataTypes.STRING(30), allowNull: true },
        buyer_unit: { type: DataTypes.STRING(100), allowNull: true },
        payment_type: { type: DataTypes.STRING(30), allowNull: true },
        order_income: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        discounts: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        shipping_fee: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        order_value: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        cod_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        cod_fee: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        cod_settlement_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        cod_paid_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        cod_paid_at: { type: DataTypes.DATE, allowNull: true },
        cod_payout_reference: { type: DataTypes.STRING(150), allowNull: true },
        cod_settlement_note: { type: DataTypes.TEXT, allowNull: true },
        platform_fee: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        payment_certificate_url: { type: DataTypes.TEXT('long'), allowNull: true },
        payment_certificate_filename: { type: DataTypes.STRING(255), allowNull: true },
        order_time: { type: DataTypes.DATE, allowNull: true },
        package_weight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        package_length: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        package_width: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        package_height: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
        package_content: { type: DataTypes.STRING(255), allowNull: true },
        last_status_checked_at: { type: DataTypes.DATE, allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'manual_orders',
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['company_id', 'order_number'], name: 'uq_manual_orders_company_order' },
            { fields: ['company_id', 'status'], name: 'idx_manual_orders_company_status' },
            { fields: ['company_id', 'shipment_status'], name: 'idx_manual_orders_company_shipment_status' },
            { fields: ['company_id', 'payment_type'], name: 'idx_manual_orders_company_payment_type' },
            { fields: ['company_id', 'warehouse_id'], name: 'idx_manual_orders_company_warehouse' },
            { fields: ['created_at'], name: 'idx_manual_orders_created_at' },
        ],
    });

    ManualOrder.associate = (models) => {
        ManualOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        ManualOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
        ManualOrder.hasMany(models.ManualOrderItem, { foreignKey: 'manual_order_id', as: 'items' });
        if (models.ManualOrderStatusHistory) {
            ManualOrder.hasMany(models.ManualOrderStatusHistory, { foreignKey: 'manual_order_id', as: 'statusHistory' });
        }
    };

    return ManualOrder;
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ReturnOrderLine = sequelize.define('ReturnOrderLine', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        return_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        order_line_item_id: { type: DataTypes.STRING(100), allowNull: true },
        return_line_item_id: { type: DataTypes.STRING(100), allowNull: true },
        platform_sku_id: { type: DataTypes.STRING(100), allowNull: true },
        seller_sku: { type: DataTypes.STRING(100), allowNull: true },
        sku_name: { type: DataTypes.STRING(255), allowNull: true },
        product_name: { type: DataTypes.STRING(500), allowNull: true },
        product_image_url: { type: DataTypes.TEXT, allowNull: true },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        refund_currency: { type: DataTypes.STRING(10), allowNull: true },
        refund_total: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        raw_json: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'return_order_lines',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['return_order_id', 'return_line_item_id'], name: 'uq_return_lines_return_line' },
            { fields: ['company_id'], name: 'idx_return_lines_company' },
            { fields: ['return_order_id'], name: 'idx_return_lines_order' },
            { fields: ['merchant_sku_id'], name: 'idx_return_lines_merchant_sku' },
            { fields: ['seller_sku'], name: 'idx_return_lines_seller_sku' },
        ],
    });

    ReturnOrderLine.associate = (models) => {
        ReturnOrderLine.belongsTo(models.ReturnOrder, { foreignKey: 'return_order_id', as: 'returnOrder' });
        ReturnOrderLine.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
    };

    return ReturnOrderLine;
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CombineSkuItem = sequelize.define('CombineSkuItem', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        combine_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        quantity: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
        },
    }, {
        tableName: 'combine_sku_items',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { unique: true, fields: ['combine_sku_id', 'merchant_sku_id'], name: 'uq_combine_sku_items' },
            { fields: ['company_id', 'merchant_sku_id'], name: 'idx_combine_items_merchant_sku' },
        ],
    });

    CombineSkuItem.associate = (models) => {
        CombineSkuItem.belongsTo(models.CombineSku, { foreignKey: 'combine_sku_id', as: 'combineSku' });
        CombineSkuItem.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
    };

    return CombineSkuItem;
};
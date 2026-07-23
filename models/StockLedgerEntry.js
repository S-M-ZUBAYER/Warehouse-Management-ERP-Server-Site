'use strict';
const { DataTypes } = require('sequelize');

const MOVEMENT_TYPES = [
    'inbound_receipt', 'sale_deduction', 'manual_adjustment',
    'return', 'write_off', 'transfer_out', 'transfer_in',
];

module.exports = (sequelize) => {
    const StockLedgerEntry = sequelize.define('StockLedgerEntry', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        merchant_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        sku_warehouse_stock_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        movement_type: {
            type: DataTypes.ENUM(...MOVEMENT_TYPES),
            allowNull: false,
        },
        quantity_delta: { type: DataTypes.INTEGER, allowNull: false },
        qty_on_hand_after: { type: DataTypes.INTEGER, allowNull: false },
        reference_type: { type: DataTypes.STRING(50), allowNull: false },
        reference_id: { type: DataTypes.STRING(100), allowNull: false },
        notes: { type: DataTypes.STRING(500), allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    }, {
        tableName: 'stock_ledger_entries',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { fields: ['merchant_sku_id', 'warehouse_id'], name: 'idx_sle_sku_warehouse' },
            { fields: ['sku_warehouse_stock_id'], name: 'idx_sle_stock_id' },
            { fields: ['company_id', 'created_at'], name: 'idx_sle_company_created' },
            { fields: ['reference_type', 'reference_id'], name: 'idx_sle_reference' },
        ],
    });

    StockLedgerEntry.associate = (models) => {
        StockLedgerEntry.belongsTo(models.SkuWarehouseStock, { foreignKey: 'sku_warehouse_stock_id', as: 'stockRecord' });
        StockLedgerEntry.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
    };

    return StockLedgerEntry;
};
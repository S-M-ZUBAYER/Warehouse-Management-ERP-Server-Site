'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CompanyShippingWalletLedger = sequelize.define('CompanyShippingWalletLedger', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        wallet_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        manual_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        type: { type: DataTypes.STRING(40), allowNull: false },
        amount_myr: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        balance_before_myr: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        balance_after_myr: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        original_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        original_currency: { type: DataTypes.STRING(10), allowNull: true },
        fx_rate_to_myr: { type: DataTypes.DECIMAL(18, 8), allowNull: true },
        provider: { type: DataTypes.STRING(40), allowNull: true },
        reference: { type: DataTypes.STRING(150), allowNull: true },
        status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'succeeded' },
        metadata: { type: DataTypes.JSON, allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    }, {
        tableName: 'company_shipping_wallet_ledger',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { fields: ['company_id', 'created_at'], name: 'idx_cswl_company_created' },
            { fields: ['wallet_id', 'created_at'], name: 'idx_cswl_wallet_created' },
            { fields: ['manual_order_id'], name: 'idx_cswl_manual_order' },
            { fields: ['reference'], name: 'idx_cswl_reference' },
            { fields: ['type', 'status'], name: 'idx_cswl_type_status' },
            { fields: ['company_id', 'type', 'reference', 'status'], name: 'uq_cswl_company_type_reference_status', unique: true },
        ],
    });

    CompanyShippingWalletLedger.associate = (models) => {
        CompanyShippingWalletLedger.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        CompanyShippingWalletLedger.belongsTo(models.CompanyShippingWallet, { foreignKey: 'wallet_id', as: 'wallet' });
        if (models.ManualOrder) {
            CompanyShippingWalletLedger.belongsTo(models.ManualOrder, { foreignKey: 'manual_order_id', as: 'manualOrder' });
        }
    };

    return CompanyShippingWalletLedger;
};


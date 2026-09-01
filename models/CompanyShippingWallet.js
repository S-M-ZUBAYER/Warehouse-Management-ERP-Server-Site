'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CompanyShippingWallet = sequelize.define('CompanyShippingWallet', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'MYR' },
        balance_myr: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        updated_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    }, {
        tableName: 'company_shipping_wallets',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id'], name: 'uq_company_shipping_wallets_company' },
        ],
    });

    CompanyShippingWallet.associate = (models) => {
        CompanyShippingWallet.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        if (models.CompanyShippingWalletLedger) {
            CompanyShippingWallet.hasMany(models.CompanyShippingWalletLedger, { foreignKey: 'wallet_id', as: 'ledger' });
        }
    };

    return CompanyShippingWallet;
};

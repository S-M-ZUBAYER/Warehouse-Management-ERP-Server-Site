'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BillingPlanPrice = sequelize.define('BillingPlanPrice', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        country: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'US' },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
        amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        compare_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        is_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    }, {
        tableName: 'billing_plan_prices',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['plan_id', 'country', 'currency'], name: 'uq_bpp_plan_country_currency' },
            { fields: ['country', 'currency', 'is_available'], name: 'idx_bpp_country_currency_available' },
        ],
    });

    BillingPlanPrice.associate = (models) => {
        BillingPlanPrice.belongsTo(models.BillingPlan, { foreignKey: 'plan_id', as: 'plan' });
    };

    return BillingPlanPrice;
};

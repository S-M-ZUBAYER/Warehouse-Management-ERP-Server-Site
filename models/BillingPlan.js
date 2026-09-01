'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BillingPlan = sequelize.define('BillingPlan', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(80), allowNull: false },
        code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        duration_days: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        is_trial: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        badge_label: { type: DataTypes.STRING(60), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'billing_plans',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['code'], name: 'uq_billing_plans_code' },
            { fields: ['is_active', 'sort_order'], name: 'idx_billing_plans_active_sort' },
        ],
    });

    BillingPlan.associate = (models) => {
        BillingPlan.hasMany(models.BillingPlanTranslation, { foreignKey: 'plan_id', as: 'translations' });
        BillingPlan.hasMany(models.BillingPlanFeature, { foreignKey: 'plan_id', as: 'features' });
        BillingPlan.hasMany(models.BillingPlanPrice, { foreignKey: 'plan_id', as: 'prices' });
    };

    return BillingPlan;
};

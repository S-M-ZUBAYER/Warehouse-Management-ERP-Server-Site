'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BillingPlanFeature = sequelize.define('BillingPlanFeature', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        serial_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        feature_key: { type: DataTypes.STRING(100), allowNull: false },
        title: { type: DataTypes.STRING(255), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        translations: { type: DataTypes.JSON, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    }, {
        tableName: 'billing_plan_features',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['plan_id', 'feature_key'], name: 'uq_bpf_plan_feature' },
            { fields: ['plan_id', 'serial_no'], name: 'idx_bpf_plan_serial' },
        ],
    });

    BillingPlanFeature.associate = (models) => {
        BillingPlanFeature.belongsTo(models.BillingPlan, { foreignKey: 'plan_id', as: 'plan' });
    };

    return BillingPlanFeature;
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BillingPlanTranslation = sequelize.define('BillingPlanTranslation', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        language: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
        display_name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
    }, {
        tableName: 'billing_plan_translations',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['plan_id', 'language'], name: 'uq_bpt_plan_language' },
        ],
    });

    BillingPlanTranslation.associate = (models) => {
        BillingPlanTranslation.belongsTo(models.BillingPlan, { foreignKey: 'plan_id', as: 'plan' });
    };

    return BillingPlanTranslation;
};

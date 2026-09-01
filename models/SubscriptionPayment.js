'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SubscriptionPayment = sequelize.define('SubscriptionPayment', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        payment_uid: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        payment_group_uid: { type: DataTypes.STRING(80), allowNull: false },
        store_subscription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        purchaser_company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        purchaser_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        purchaser_email: { type: DataTypes.STRING(150), allowNull: true },
        plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        currency: { type: DataTypes.STRING(3), allowNull: false },
        amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        payment_provider: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'mock' },
        payment_status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed'), allowNull: false, defaultValue: 'succeeded' },
        paid_at: { type: DataTypes.DATE, allowNull: true },
        previous_expiry: { type: DataTypes.DATE, allowNull: true },
        new_expiry: { type: DataTypes.DATE, allowNull: true },
        coupon_code: { type: DataTypes.STRING(20), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'subscription_payments',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['payment_uid'], name: 'uq_subscription_payments_uid' },
            { fields: ['payment_group_uid'], name: 'idx_subscription_payments_group' },
            { fields: ['store_subscription_id', 'created_at'], name: 'idx_subscription_payments_store' },
            { fields: ['purchaser_company_id', 'payment_status'], name: 'idx_subscription_payments_company_status' },
        ],
    });

    SubscriptionPayment.associate = (models) => {
        SubscriptionPayment.belongsTo(models.StoreSubscription, { foreignKey: 'store_subscription_id', as: 'subscription' });
        SubscriptionPayment.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        SubscriptionPayment.belongsTo(models.BillingPlan, { foreignKey: 'plan_id', as: 'plan' });
    };

    return SubscriptionPayment;
};

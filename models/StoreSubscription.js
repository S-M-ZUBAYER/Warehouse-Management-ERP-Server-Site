'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const StoreSubscription = sequelize.define('StoreSubscription', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        canonical_key: { type: DataTypes.STRING(320), allowNull: false, unique: true },
        platform: { type: DataTypes.STRING(30), allowNull: false },
        marketplace_country: { type: DataTypes.STRING(10), allowNull: true },
        external_shop_id: { type: DataTypes.STRING(120), allowNull: false },
        current_plan_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        status: { type: DataTypes.ENUM('trial', 'active', 'expired'), allowNull: false, defaultValue: 'trial' },
        trial_started_at: { type: DataTypes.DATE, allowNull: true },
        trial_used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        expires_at: { type: DataTypes.DATE, allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'store_subscriptions',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['canonical_key'], name: 'uq_store_subscriptions_canonical' },
            { fields: ['platform', 'marketplace_country', 'external_shop_id'], name: 'idx_ss_store_identity' },
            { fields: ['status', 'expires_at'], name: 'idx_ss_status_expiry' },
        ],
    });

    StoreSubscription.associate = (models) => {
        StoreSubscription.belongsTo(models.BillingPlan, { foreignKey: 'current_plan_id', as: 'currentPlan' });
        StoreSubscription.hasMany(models.SubscriptionPayment, { foreignKey: 'store_subscription_id', as: 'payments' });
    };

    return StoreSubscription;
};

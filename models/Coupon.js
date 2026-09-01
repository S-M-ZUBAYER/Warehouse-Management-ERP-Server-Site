'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Coupon = sequelize.define('Coupon', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        owner_company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        owner_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        source_payment_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        status: { type: DataTypes.ENUM('active', 'redeemed', 'expired', 'cancelled'), allowNull: false, defaultValue: 'active' },
        redeemed_at: { type: DataTypes.DATE, allowNull: true },
        redeemed_by_company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        redeemed_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        redeemed_store_subscription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        gift_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        max_redemption_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        redemption_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    }, {
        tableName: 'coupons',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['code'], name: 'uq_coupons_code' },
            { fields: ['owner_company_id', 'owner_user_id'], name: 'idx_coupons_owner' },
            { fields: ['status'], name: 'idx_coupons_status' },
        ],
    });

    Coupon.associate = (models) => {
        Coupon.belongsTo(models.SubscriptionPayment, { foreignKey: 'source_payment_id', as: 'sourcePayment' });
        Coupon.hasMany(models.CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
    };

    return Coupon;
};

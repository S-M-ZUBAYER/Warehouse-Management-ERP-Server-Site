'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CouponRedemption = sequelize.define('CouponRedemption', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        coupon_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        redeemer_company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        redeemer_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        store_subscription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        source_payment_group_uid: { type: DataTypes.STRING(80), allowNull: true },
        status: { type: DataTypes.ENUM('applied', 'rejected'), allowNull: false, defaultValue: 'applied' },
        metadata: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'coupon_redemptions',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['coupon_id', 'store_subscription_id'], name: 'uq_coupon_store_redemption' },
            { fields: ['redeemer_company_id', 'redeemer_user_id'], name: 'idx_coupon_redemptions_redeemer' },
        ],
    });

    CouponRedemption.associate = (models) => {
        CouponRedemption.belongsTo(models.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
        CouponRedemption.belongsTo(models.StoreSubscription, { foreignKey: 'store_subscription_id', as: 'subscription' });
    };

    return CouponRedemption;
};

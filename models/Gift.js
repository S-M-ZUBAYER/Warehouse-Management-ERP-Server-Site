'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Gift = sequelize.define('Gift', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        coupon_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        coupon_redemption_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        recipient_company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        recipient_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        store_subscription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        status: {
            type: DataTypes.ENUM('PENDING_ADDRESS', 'ADDRESS_SUBMITTED', 'ON_THE_WAY', 'DELIVERED', 'RECEIVED', 'DECLINED', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'PENDING_ADDRESS',
        },
        delivery_address: { type: DataTypes.JSON, allowNull: true },
        tracking_number: { type: DataTypes.STRING(120), allowNull: true },
        modal_seen_at: { type: DataTypes.DATE, allowNull: true },
        received_at: { type: DataTypes.DATE, allowNull: true },
        received_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        declined_at: { type: DataTypes.DATE, allowNull: true },
        declined_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    }, {
        tableName: 'gifts',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['coupon_redemption_id'], name: 'uq_gifts_redemption' },
            { fields: ['recipient_company_id', 'recipient_user_id', 'status'], name: 'idx_gifts_recipient_status' },
        ],
    });

    Gift.associate = (models) => {
        Gift.belongsTo(models.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
        Gift.belongsTo(models.CouponRedemption, { foreignKey: 'coupon_redemption_id', as: 'redemption' });
        Gift.belongsTo(models.StoreSubscription, { foreignKey: 'store_subscription_id', as: 'subscription' });
        Gift.hasMany(models.GiftStatusHistory, { foreignKey: 'gift_id', as: 'history' });
    };

    return Gift;
};

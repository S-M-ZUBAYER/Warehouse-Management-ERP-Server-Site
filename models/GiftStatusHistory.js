'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const GiftStatusHistory = sequelize.define('GiftStatusHistory', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        gift_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        previous_status: { type: DataTypes.STRING(40), allowNull: true },
        new_status: { type: DataTypes.STRING(40), allowNull: false },
        changed_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        tracking_number: { type: DataTypes.STRING(120), allowNull: true },
    }, {
        tableName: 'gift_status_history',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { fields: ['gift_id', 'created_at'], name: 'idx_gift_status_history_gift' },
        ],
    });

    GiftStatusHistory.associate = (models) => {
        GiftStatusHistory.belongsTo(models.Gift, { foreignKey: 'gift_id', as: 'gift' });
    };

    return GiftStatusHistory;
};

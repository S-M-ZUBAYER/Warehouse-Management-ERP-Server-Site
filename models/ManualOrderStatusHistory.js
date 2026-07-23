'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ManualOrderStatusHistory = sequelize.define('ManualOrderStatusHistory', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        manual_order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        old_status: { type: DataTypes.STRING(50), allowNull: true },
        new_status: { type: DataTypes.STRING(50), allowNull: false },
        raw_provider_status: { type: DataTypes.STRING(255), allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    }, {
        tableName: 'manual_order_status_history',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            { fields: ['company_id', 'manual_order_id'], name: 'idx_mosh_company_order' },
            { fields: ['new_status'], name: 'idx_mosh_new_status' },
        ],
    });

    ManualOrderStatusHistory.associate = (models) => {
        ManualOrderStatusHistory.belongsTo(models.ManualOrder, { foreignKey: 'manual_order_id', as: 'order' });
        ManualOrderStatusHistory.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
    };

    return ManualOrderStatusHistory;
};

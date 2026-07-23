'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PushSuccessfulOrder = sequelize.define('PushSuccessfulOrder', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('shopee', 'tiktok'), allowNull: false },
        store_id: { type: DataTypes.STRING(100), allowNull: false },
        order_id: { type: DataTypes.STRING(100), allowNull: false },
    }, {
        tableName: 'push_successful_orders',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['company_id', 'platform', 'store_id', 'order_id'],
                name: 'uq_push_successful_order',
            },
            { fields: ['company_id', 'platform', 'store_id'], name: 'idx_pso_company_platform_store' },
            { fields: ['created_at'], name: 'idx_pso_created_at' },
        ],
    });

    return PushSuccessfulOrder;
};

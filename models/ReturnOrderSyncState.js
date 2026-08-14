'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ReturnOrderSyncState = sequelize.define('ReturnOrderSyncState', {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('shopee', 'tiktok'), allowNull: false },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        last_synced_page: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        previous_last_page: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        first_requested_page: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        fetched_rows: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        last_sync_at: { type: DataTypes.DATE, allowNull: true },
        metadata_json: { type: DataTypes.JSON, allowNull: true },
    }, {
        tableName: 'return_order_sync_states',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'platform', 'platform_store_id'], name: 'uq_return_sync_state_store' },
            { fields: ['company_id', 'platform'], name: 'idx_return_sync_state_company_platform' },
            { fields: ['platform_store_id'], name: 'idx_return_sync_state_store' },
            { fields: ['company_id', 'platform', 'last_sync_at'], name: 'idx_return_sync_state_last_sync' },
        ],
    });

    ReturnOrderSyncState.associate = (models) => {
        ReturnOrderSyncState.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        ReturnOrderSyncState.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
    };

    return ReturnOrderSyncState;
};

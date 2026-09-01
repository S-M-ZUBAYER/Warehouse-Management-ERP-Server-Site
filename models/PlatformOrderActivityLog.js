'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformOrderActivityLog = sequelize.define('PlatformOrderActivityLog', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform: { type: DataTypes.ENUM('shopee', 'tiktok'), allowNull: false },
        platform_store_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        store_id: { type: DataTypes.STRING(100), allowNull: true },
        store_name: { type: DataTypes.STRING(255), allowNull: true },
        platform_order_id: { type: DataTypes.STRING(100), allowNull: false },
        platform_order_item_id: { type: DataTypes.STRING(100), allowNull: true },
        package_number: { type: DataTypes.STRING(150), allowNull: true },
        tracking_number: { type: DataTypes.STRING(150), allowNull: true },
        event_type: { type: DataTypes.STRING(80), allowNull: false },
        title: { type: DataTypes.STRING(180), allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: true },
        old_status: { type: DataTypes.STRING(80), allowNull: true },
        new_status: { type: DataTypes.STRING(80), allowNull: true },
        actor_type: {
            type: DataTypes.ENUM('USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM'),
            allowNull: false,
            defaultValue: 'SYSTEM',
        },
        actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        actor_name: { type: DataTypes.STRING(150), allowNull: true },
        source: { type: DataTypes.STRING(100), allowNull: true },
        source_event_id: { type: DataTypes.STRING(180), allowNull: true },
        platform_region: { type: DataTypes.STRING(10), allowNull: true },
        platform_timezone: { type: DataTypes.STRING(80), allowNull: true },
        platform_local_occurred_at: { type: DataTypes.STRING(30), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
        occurred_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'platform_order_activity_logs',
        timestamps: true,
        updatedAt: false,
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            { fields: ['company_id', 'platform', 'platform_order_id'], name: 'idx_poal_order' },
            { fields: ['company_id', 'platform', 'event_type'], name: 'idx_poal_event_type' },
            { fields: ['platform_store_id'], name: 'idx_poal_platform_store' },
            { fields: ['occurred_at'], name: 'idx_poal_occurred_at' },
            { unique: true, fields: ['company_id', 'platform', 'source_event_id'], name: 'uq_poal_source_event' },
        ],
    });

    PlatformOrderActivityLog.associate = (models) => {
        PlatformOrderActivityLog.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        PlatformOrderActivityLog.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        PlatformOrderActivityLog.belongsTo(models.User, { foreignKey: 'actor_id', as: 'actor' });
    };

    return PlatformOrderActivityLog;
};

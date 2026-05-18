// ─────────────────────────────────────────────────────────────────────────────
// models/MerchantSkuSyncGroup.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MerchantSkuSyncGroup = sequelize.define('MerchantSkuSyncGroup', {
        id:             { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        primary_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        name:           { type: DataTypes.STRING(100), allowNull: true },
        created_by:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        deleted_at:     { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName:  'merchant_sku_sync_groups',
        timestamps:  true,
        underscored: true,
        paranoid:    true,
    });

    MerchantSkuSyncGroup.associate = (models) => {
        MerchantSkuSyncGroup.belongsTo(models.Company,     { foreignKey: 'company_id',     as: 'company' });
        MerchantSkuSyncGroup.belongsTo(models.MerchantSku, { foreignKey: 'primary_sku_id', as: 'primarySku' });
        MerchantSkuSyncGroup.hasMany(models.MerchantSkuSyncMember, { foreignKey: 'group_id', as: 'members' });
    };

    return MerchantSkuSyncGroup;
};
// models/MerchantSkuSyncMember.js
'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MerchantSkuSyncMember = sequelize.define('MerchantSkuSyncMember', {
        id:            { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        group_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        company_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        member_sku_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    }, {
        tableName:   'merchant_sku_sync_members',
        timestamps:   true,
        underscored:  true,
        updatedAt:    false,   // table only has created_at
    });

    MerchantSkuSyncMember.associate = (models) => {
        MerchantSkuSyncMember.belongsTo(models.MerchantSkuSyncGroup, { foreignKey: 'group_id',      as: 'group' });
        MerchantSkuSyncMember.belongsTo(models.Company,              { foreignKey: 'company_id',    as: 'company' });
        MerchantSkuSyncMember.belongsTo(models.MerchantSku,          { foreignKey: 'member_sku_id', as: 'memberSku' });
    };

    return MerchantSkuSyncMember;
};
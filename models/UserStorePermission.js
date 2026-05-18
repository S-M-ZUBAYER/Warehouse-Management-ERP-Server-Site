'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserStorePermission = sequelize.define('UserStorePermission', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        connection_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        can_view: { type: DataTypes.BOOLEAN, defaultValue: true },
        can_edit: { type: DataTypes.BOOLEAN, defaultValue: false },
    }, {
        tableName: 'user_store_permissions',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'user_id', 'connection_id'] },
            { fields: ['company_id', 'user_id'] },
        ],
    });

    UserStorePermission.associate = (models) => {
        UserStorePermission.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        // Only associate when PlatformConnection model is loaded
        if (models.PlatformConnection) {
            UserStorePermission.belongsTo(models.PlatformConnection, { foreignKey: 'connection_id', as: 'connection' });
        }
    };

    return UserStorePermission;
};
'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserWarehousePermission = sequelize.define('UserWarehousePermission', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        company_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        can_view: { type: DataTypes.BOOLEAN, defaultValue: true },
        can_edit: { type: DataTypes.BOOLEAN, defaultValue: false },
    }, {
        tableName: 'user_warehouse_permissions',
        timestamps: true,
        updatedAt: false,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'user_id', 'warehouse_id'] },
        ],
    });

    UserWarehousePermission.associate = (models) => {
        UserWarehousePermission.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        // Only associate when Warehouse model is loaded
        if (models.Warehouse) {
            UserWarehousePermission.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
        }
    };

    return UserWarehousePermission;
};
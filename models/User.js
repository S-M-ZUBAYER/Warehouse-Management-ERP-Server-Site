'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        role_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,   // nullable so owner can be created before role FK exists
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('owner', 'admin', 'manager', 'staff', 'viewer'),
            allowNull: false,
            defaultValue: 'staff',
        },
        avatar_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        account_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Custom employee ID shown in UI (e.g. EMP-001)',
        },
        department: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        designation: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING(30),
            allowNull: true,
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        last_login_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'email'], name: 'uq_users_company_email' },
            { unique: true, fields: ['company_id', 'account_id'], name: 'uq_users_company_account_id' },
            { fields: ['company_id', 'role'], name: 'idx_users_company_role' },
            { fields: ['company_id', 'is_active'], name: 'idx_users_company_active' },
        ],
    });

    User.associate = (models) => {
        User.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'roleInfo' });
        User.hasMany(models.UserStorePermission, { foreignKey: 'user_id', as: 'storePermissions' });
        User.hasMany(models.UserWarehousePermission, { foreignKey: 'user_id', as: 'warehousePermissions' });
    };

    return User;
};
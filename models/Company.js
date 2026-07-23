'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Company = sequelize.define('Company', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(220),
            allowNull: false,
            unique: true,
        },
        email: {
            type: DataTypes.STRING(150),
            allowNull: false,
            unique: true,
        },
        phone: {
            type: DataTypes.STRING(30),
            allowNull: true,
        },
        logo_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        plan: {
            type: DataTypes.ENUM('starter', 'growth', 'enterprise', 'trial'),
            allowNull: false,
            defaultValue: 'trial',
        },
        status: {
            type: DataTypes.ENUM('active', 'suspended', 'trial'),
            allowNull: false,
            defaultValue: 'trial',
        },
        trial_ends_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        timezone: {
            type: DataTypes.STRING(50),
            defaultValue: 'UTC',
        },
        currency: {
            type: DataTypes.CHAR(3),
            defaultValue: 'USD',
        },
        dedicated_db_host: { type: DataTypes.STRING(255), allowNull: true },
        dedicated_db_name: { type: DataTypes.STRING(100), allowNull: true },
        dedicated_db_user: { type: DataTypes.STRING(100), allowNull: true },
        dedicated_db_pass: { type: DataTypes.TEXT, allowNull: true }, // AES-256 encrypted
    }, {
        tableName: 'companies',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['slug'] },
            { unique: true, fields: ['email'] },
            { fields: ['status'] },
        ],
    });

    Company.associate = (models) => {
        Company.hasMany(models.User, { foreignKey: 'company_id', as: 'users' });
        Company.hasMany(models.Role, { foreignKey: 'company_id', as: 'roles' });
        // Add more associations as you build each module:
        // Company.hasMany(models.Warehouse,          { foreignKey: 'company_id', as: 'warehouses'          });
        // Company.hasMany(models.PlatformConnection, { foreignKey: 'company_id', as: 'platformConnections'  });
        // Company.hasMany(models.Product,            { foreignKey: 'company_id', as: 'products'            });
        // Company.hasMany(models.Order,              { foreignKey: 'company_id', as: 'orders'              });
    };

    return Company;
};
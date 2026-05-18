'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Warehouse = sequelize.define('Warehouse', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        code: {
            type: DataTypes.STRING(150),
            allowNull: false,
            comment: 'Short code e.g. WH-A',
        },
        attribute: {
            type: DataTypes.ENUM('own_warehouse', 'third_party_warehouse'),
            allowNull: false,
            defaultValue: 'own_warehouse',
        },
        manager_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING(30),
            allowNull: true,
        },
        location: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Full address / location string',
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        country: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        is_default: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
            defaultValue: 'active',
        },
    }, {
        tableName: 'warehouses',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'code'], name: 'uq_warehouses_company_code' },
            { fields: ['company_id', 'status'], name: 'idx_warehouses_company_status' },
            { fields: ['company_id', 'is_default'], name: 'idx_warehouses_company_default' },
        ],
    });

    Warehouse.associate = (models) => {
        Warehouse.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        if (models.WarehouseZone) {
            Warehouse.hasMany(models.WarehouseZone, { foreignKey: 'warehouse_id', as: 'zones' });
        }
        if (models.Inventory) {
            Warehouse.hasMany(models.Inventory, { foreignKey: 'warehouse_id', as: 'inventory' });
        }
        Warehouse.hasMany(models.UserWarehousePermission, { foreignKey: 'warehouse_id', as: 'userPermissions' });
    };

    return Warehouse;
};
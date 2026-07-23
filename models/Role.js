'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Role = sequelize.define('Role', {
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
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        // Permissions stored as JSON object:
        // {
        //   dashboard:            { access: true },
        //   product_management:   { access: true,  sub: { merchant_sku: true, combine_sku: true } },
        //   inventory_management: { access: false, sub: { inventory_list: false, inbound: false } },
        //   order_management:     { access: true,  sub: { all_orders: true, manual_orders: false } },
        //   warehouse_management: { access: true },
        //   system_configuration: { access: false, sub: { store_authorization: false, sub_account: false, role_management: false } },
        // }
        permissions: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {},
        },
        sub_account_linking_status: {
            type: DataTypes.ENUM('linked', 'not_linked'),
            allowNull: false,
            defaultValue: 'not_linked',
        },
    }, {
        tableName: 'roles',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['company_id', 'name'], name: 'uq_roles_company_name' },
            { fields: ['company_id'], name: 'idx_roles_company_id' },
        ],
    });

    Role.associate = (models) => {
        Role.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
        Role.hasMany(models.User, { foreignKey: 'role_id', as: 'users' });
    };

    return Role;
};
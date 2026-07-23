'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Page = sequelize.define('Page', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        key: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            comment: 'Unique page key e.g. dashboard, product_management',
        },
        label: {
            type: DataTypes.STRING(150),
            allowNull: true,
            comment: 'Display label — optional, frontend can derive from key',
        },
        parent_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null,
            comment: 'Null = top-level. Points to parent Page id for sub/sub-sub pages',
        },
        level: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
            comment: '1 = top-level, 2 = sub, 3 = sub-sub',
        },
        has_sub: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        order: {
            type: DataTypes.SMALLINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            comment: 'Sort order within the same parent',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        tableName: 'pages',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['parent_id'], name: 'idx_pages_parent_id' },
            { fields: ['level'], name: 'idx_pages_level' },
            { unique: true, fields: ['key'], name: 'uq_pages_key' },
        ],
    });

    Page.associate = (models) => {
        // Self-referencing: a page can have many children
        Page.hasMany(models.Pages, { foreignKey: 'parent_id', as: 'children' });
        Page.belongsTo(models.Pages, { foreignKey: 'parent_id', as: 'parent' });
    };

    return Page;
};
// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const WarehouseZone = sequelize.define(
//         'WarehouseZone',
//         {
//             id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 autoIncrement: true,
//                 primaryKey: true,
//             },
//             warehouse_id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 allowNull: false,
//             },
//             company_id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 allowNull: false,
//                 comment: 'Denormalized for fast tenant-scoped queries',
//             },
//             name: {
//                 type: DataTypes.STRING(100),
//                 allowNull: false,
//             },
//             code: {
//                 type: DataTypes.STRING(30),
//                 allowNull: false,
//                 comment: 'e.g. ZONE-A',
//             },
//             description: {
//                 type: DataTypes.TEXT,
//                 allowNull: true,
//             },
//             is_active: {
//                 type: DataTypes.BOOLEAN,
//                 defaultValue: true,
//             },
//             total_rack_locations: {
//                 type: DataTypes.INTEGER.UNSIGNED,
//                 defaultValue: 0,
//             },
//         },
//         {
//             tableName: 'warehouse_zones',
//             timestamps: true,
//             paranoid: true,
//             indexes: [
//                 // ── Composite unique: one zone code per warehouse ────────────────
//                 {
//                     unique: true,
//                     fields: ['warehouse_id', 'code'],
//                     name: 'uq_zone_warehouse_code',
//                 },
//                 { fields: ['warehouse_id'], name: 'idx_zone_warehouse' },
//                 { fields: ['company_id'], name: 'idx_zone_company' },
//                 { fields: ['warehouse_id', 'is_active'], name: 'idx_zone_warehouse_active' },
//             ],
//         }
//     );

//     WarehouseZone.associate = (models) => {
//         WarehouseZone.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         WarehouseZone.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         WarehouseZone.hasMany(models.RackLocation, { foreignKey: 'zone_id', as: 'rackLocations', onDelete: 'CASCADE' });
//     };

//     return WarehouseZone;
// };
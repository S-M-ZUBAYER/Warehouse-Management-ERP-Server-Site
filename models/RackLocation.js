// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const RackLocation = sequelize.define(
//         'RackLocation',
//         {
//             id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 autoIncrement: true,
//                 primaryKey: true,
//             },
//             zone_id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 allowNull: false,
//             },
//             warehouse_id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 allowNull: false,
//                 comment: 'Denormalized for direct warehouse-scoped queries',
//             },
//             company_id: {
//                 type: DataTypes.BIGINT.UNSIGNED,
//                 allowNull: false,
//                 comment: 'Denormalized for tenant isolation',
//             },
//             label: {
//                 type: DataTypes.STRING(50),
//                 allowNull: false,
//                 comment: 'e.g. A-01-03 (zone-row-col)',
//             },
//             row: {
//                 type: DataTypes.TINYINT.UNSIGNED,
//                 allowNull: true,
//             },
//             column: {
//                 type: DataTypes.TINYINT.UNSIGNED,
//                 allowNull: true,
//             },
//             level: {
//                 type: DataTypes.TINYINT.UNSIGNED,
//                 allowNull: true,
//                 comment: 'Shelf level / height',
//             },
//             max_capacity: {
//                 type: DataTypes.INTEGER.UNSIGNED,
//                 allowNull: true,
//                 comment: 'Max units this location can hold',
//             },
//             current_occupancy: {
//                 type: DataTypes.INTEGER.UNSIGNED,
//                 defaultValue: 0,
//             },
//             is_active: {
//                 type: DataTypes.BOOLEAN,
//                 defaultValue: true,
//             },
//         },
//         {
//             tableName: 'rack_locations',
//             timestamps: true,
//             paranoid: true,
//             indexes: [
//                 // ── Composite unique: one label per zone ─────────────────────────
//                 {
//                     unique: true,
//                     fields: ['zone_id', 'label'],
//                     name: 'uq_rack_zone_label',
//                 },
//                 { fields: ['zone_id'], name: 'idx_rack_zone' },
//                 { fields: ['warehouse_id'], name: 'idx_rack_warehouse' },
//                 { fields: ['company_id'], name: 'idx_rack_company' },
//                 { fields: ['warehouse_id', 'is_active'], name: 'idx_rack_warehouse_active' },
//             ],
//         }
//     );

//     RackLocation.associate = (models) => {
//         RackLocation.belongsTo(models.WarehouseZone, { foreignKey: 'zone_id', as: 'zone' });
//         RackLocation.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         RackLocation.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         RackLocation.hasMany(models.Inventory, { foreignKey: 'rack_location_id', as: 'inventory' });
//     };

//     return RackLocation;
// };
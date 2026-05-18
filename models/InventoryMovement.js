// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const InventoryMovement = sequelize.define('InventoryMovement', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         rack_location_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         movement_type: {
//             type: DataTypes.ENUM('inbound', 'outbound', 'adjustment', 'transfer', 'return', 'reserved', 'unreserved'),
//             allowNull: false,
//         },
//         quantity: { type: DataTypes.INTEGER, allowNull: false, comment: 'Positive = in, Negative = out' },
//         quantity_before: { type: DataTypes.INTEGER, allowNull: false },
//         quantity_after: { type: DataTypes.INTEGER, allowNull: false },
//         reference_type: { type: DataTypes.STRING(50), allowNull: true, comment: 'InboundOrder | Order | Manual' },
//         reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         note: { type: DataTypes.STRING(255), allowNull: true },
//         created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//     }, {
//         tableName: 'inventory_movements',
//         timestamps: true,
//         updatedAt: false,
//         indexes: [
//             { fields: ['company_id'], name: 'idx_invmov_company' },
//             { fields: ['product_id'], name: 'idx_invmov_product' },
//             { fields: ['warehouse_id'], name: 'idx_invmov_warehouse' },
//             { fields: ['company_id', 'movement_type'], name: 'idx_invmov_company_type' },
//             { fields: ['reference_type', 'reference_id'], name: 'idx_invmov_reference' },
//             { fields: ['created_at'], name: 'idx_invmov_created_at' },
//         ],
//     });

//     InventoryMovement.associate = (models) => {
//         InventoryMovement.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         InventoryMovement.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         InventoryMovement.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//     };

//     return InventoryMovement;
// };
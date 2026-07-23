// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const Inventory = sequelize.define('Inventory', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         rack_location_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
//         reserved_quantity: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Locked for pending orders' },
//         available_quantity: {
//             type: DataTypes.VIRTUAL,
//             get() { return (this.quantity || 0) - (this.reserved_quantity || 0); },
//         },
//         last_updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
//     }, {
//         tableName: 'inventory',
//         timestamps: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'warehouse_id', 'product_id', 'rack_location_id'], name: 'uq_inventory_location' },
//             { fields: ['company_id'], name: 'idx_inv_company' },
//             { fields: ['warehouse_id'], name: 'idx_inv_warehouse' },
//             { fields: ['product_id'], name: 'idx_inv_product' },
//             { fields: ['company_id', 'product_id'], name: 'idx_inv_company_product' },
//             { fields: ['rack_location_id'], name: 'idx_inv_rack' },
//             { fields: ['quantity'], name: 'idx_inv_quantity' },
//         ],
//     });

//     Inventory.associate = (models) => {
//         Inventory.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         Inventory.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//         Inventory.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         Inventory.belongsTo(models.RackLocation, { foreignKey: 'rack_location_id', as: 'rackLocation' });
//     };

//     return Inventory;
// };
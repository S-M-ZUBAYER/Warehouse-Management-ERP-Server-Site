// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const Product = sequelize.define('Product', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         name: { type: DataTypes.STRING(255), allowNull: false },
//         sku: { type: DataTypes.STRING(100), allowNull: false },
//         barcode: { type: DataTypes.STRING(100), allowNull: true },
//         description: { type: DataTypes.TEXT, allowNull: true },
//         category: { type: DataTypes.STRING(100), allowNull: true },
//         brand: { type: DataTypes.STRING(100), allowNull: true },
//         unit: { type: DataTypes.STRING(30), defaultValue: 'pcs' },
//         weight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
//         dimensions: { type: DataTypes.JSON, allowNull: true, comment: '{length, width, height, unit}' },
//         cost_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         selling_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
//         image_url: { type: DataTypes.STRING(500), allowNull: true },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//         created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//     }, {
//         tableName: 'products',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'sku'], name: 'uq_product_company_sku' },
//             { fields: ['company_id'], name: 'idx_product_company' },
//             { fields: ['company_id', 'is_active'], name: 'idx_product_company_active' },
//             { fields: ['company_id', 'category'], name: 'idx_product_company_category' },
//             { fields: ['barcode'], name: 'idx_product_barcode' },
//             { type: 'FULLTEXT', fields: ['name', 'sku', 'barcode'], name: 'ft_product_search' },
//         ],
//     });

//     Product.associate = (models) => {
//         Product.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         Product.hasMany(models.MerchantSku, { foreignKey: 'product_id', as: 'merchantSkus' });
//         Product.hasMany(models.Inventory, { foreignKey: 'product_id', as: 'inventory' });
//         Product.hasMany(models.PlatformProductBinding, { foreignKey: 'product_id', as: 'platformBindings' });
//     };

//     return Product;
// };
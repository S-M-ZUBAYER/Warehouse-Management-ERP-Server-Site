// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const StockAlertSetting = sequelize.define('StockAlertSetting', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, comment: 'null = applies to all warehouses' },
//         product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         min_quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10 },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//     }, {
//         tableName: 'stock_alert_settings',
//         timestamps: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'product_id', 'warehouse_id'], name: 'uq_alert_company_product_wh' },
//             { fields: ['company_id'], name: 'idx_alert_company' },
//             { fields: ['product_id'], name: 'idx_alert_product' },
//         ],
//     });

//     StockAlertSetting.associate = (models) => {
//         StockAlertSetting.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         StockAlertSetting.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
//         StockAlertSetting.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
//     };

//     return StockAlertSetting;
// };
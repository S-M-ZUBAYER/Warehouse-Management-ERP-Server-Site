// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const CombineSku = sequelize.define('CombineSku', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         name: { type: DataTypes.STRING(255), allowNull: false },
//         combine_sku_code: { type: DataTypes.STRING(100), allowNull: false },
//         is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
//     }, {
//         tableName: 'combine_skus',
//         timestamps: true,
//         paranoid: true,
//         indexes: [
//             { unique: true, fields: ['company_id', 'combine_sku_code'], name: 'uq_combine_sku_company' },
//             { fields: ['company_id'], name: 'idx_csku_company' },
//         ],
//     });

//     CombineSku.associate = (models) => {
//         CombineSku.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         CombineSku.hasMany(models.CombineSkuItem, { foreignKey: 'combine_sku_id', as: 'items', onDelete: 'CASCADE' });
//     };

//     return CombineSku;
// };
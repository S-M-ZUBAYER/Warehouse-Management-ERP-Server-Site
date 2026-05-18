// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const OrderLog = sequelize.define('OrderLog', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         action: { type: DataTypes.STRING(80), allowNull: false },
//         from_status: { type: DataTypes.STRING(50), allowNull: true },
//         to_status: { type: DataTypes.STRING(50), allowNull: true },
//         note: { type: DataTypes.TEXT, allowNull: true },
//         created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//     }, {
//         tableName: 'order_logs',
//         timestamps: true,
//         updatedAt: false,
//         indexes: [
//             { fields: ['order_id'], name: 'idx_olog_order' },
//             { fields: ['company_id'], name: 'idx_olog_company' },
//         ],
//     });

//     OrderLog.associate = (models) => {
//         OrderLog.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
//         OrderLog.belongsTo(models.User, { foreignKey: 'created_by', as: 'actor' });
//     };

//     return OrderLog;
// };
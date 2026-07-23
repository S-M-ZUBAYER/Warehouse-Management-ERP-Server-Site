// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const Notification = sequelize.define('Notification', {
//         id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
//         company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//         user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, comment: 'null = broadcast to all company users' },
//         type: { type: DataTypes.STRING(80), allowNull: false, comment: 'e.g. low_stock | new_order | inbound_arrived' },
//         title: { type: DataTypes.STRING(255), allowNull: false },
//         body: { type: DataTypes.TEXT, allowNull: true },
//         reference_type: { type: DataTypes.STRING(50), allowNull: true },
//         reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
//         is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
//         read_at: { type: DataTypes.DATE, allowNull: true },
//     }, {
//         tableName: 'notifications',
//         timestamps: true,
//         updatedAt: false,
//         indexes: [
//             { fields: ['company_id', 'user_id'], name: 'idx_notif_company_user' },
//             { fields: ['company_id', 'is_read'], name: 'idx_notif_company_read' },
//             { fields: ['user_id', 'is_read'], name: 'idx_notif_user_read' },
//             { fields: ['created_at'], name: 'idx_notif_created_at' },
//         ],
//     });

//     Notification.associate = (models) => {
//         Notification.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
//         Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
//     };

//     return Notification;
// };
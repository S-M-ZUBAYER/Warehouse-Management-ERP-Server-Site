// 'use strict';

// /**
//  * Write an audit log row.
//  * Fails silently — never let audit logging break the main flow.
//  */
// const auditLog = async ({ companyId, userId, action, entity, entityId, data = null }) => {
//     try {
//         const { AuditLog } = require('../models');
//         await AuditLog.create({
//             company_id: companyId,
//             user_id: userId,
//             action,           // 'CREATE' | 'UPDATE' | 'DELETE' | 'SET_DEFAULT' | etc.
//             entity,           // 'Warehouse' | 'WarehouseZone' | 'RackLocation'
//             entity_id: entityId,
//             payload: data ? JSON.stringify(data) : null,
//         });
//     } catch (err) {
//         // Log to console only — never throw
//         console.error('[AuditLog Error]', err.message);
//     }
// };

// module.exports = { auditLog };

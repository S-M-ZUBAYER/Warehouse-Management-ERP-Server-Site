// 'use strict';
// const bcrypt = require('bcryptjs');
// const { Op } = require('sequelize');
// const { User, Role, Company, sequelize } = require('../../models');
// const { paginate } = require('../../utils/pagination');
// const { auditLog } = require('../../utils/auditLogger');

// // ═══════════════════════════════════════════════════════════════════════════
// //  UPSERT SUBACCOUNT
// //
// //  Rules:
// //  1. Only the company owner (is_owner = true) may call this.
// //     → Enforced at route level via ownerOnly middleware.
// //
// //  2. Password is ALWAYS set by the calling company — no exceptions.
// //
// //  3. Email already exists globally (owner of another company):
// //     → Strip is_owner from their original record (they lose ownership)
// //     → Set the calling company's password on their existing record
// //     → Move them into the calling company as a subaccount
// //     → Their original company row stays but now has no owner
// //       (caller is responsible for understanding this — documented in Swagger)
// //
// //  4. Email already exists in THIS company as a subaccount:
// //     → Update role + password + profile fields
// //
// //  5. Email does not exist anywhere:
// //     → Create a fresh subaccount under the calling company
// // ═══════════════════════════════════════════════════════════════════════════
// const upsertSubaccount = async (companyId, actorUserId, data) => {
//     const { email, role_id, password, first_name, last_name, phone } = data;

//     // ── 1. Verify role belongs to the calling company ───────────────────────
//     const role = await Role.findOne({ where: { id: role_id, company_id: companyId } });
//     if (!role) {
//         const err = new Error('Role not found or does not belong to this company');
//         err.status = 404;
//         throw err;
//     }

//     // ── 2. Hash the new password ─────────────────────────────────────────────
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // ── 3. Look up this email anywhere in the system ─────────────────────────
//     const existingUser = await User.findOne({
//         where: { email },
//         paranoid: false, // include soft-deleted
//     });

//     return await sequelize.transaction(async (t) => {

//         // ────────────────────────────────────────────────────────────────────────
//         // CASE A: Email already exists in THIS company
//         // ────────────────────────────────────────────────────────────────────────
//         if (existingUser && existingUser.company_id === parseInt(companyId)) {

//             if (existingUser.is_owner) {
//                 const err = new Error(
//                     'This email belongs to the owner of your company and cannot be converted to a subaccount.'
//                 );
//                 err.status = 400;
//                 throw err;
//             }

//             // Restore if soft-deleted + update everything
//             if (existingUser.deleted_at) await existingUser.restore({ transaction: t });

//             await existingUser.update(
//                 {
//                     role_id,
//                     password: hashedPassword,
//                     is_active: true,
//                     ...(first_name && { first_name }),
//                     ...(last_name !== undefined && { last_name }),
//                     ...(phone && { phone }),
//                 },
//                 { transaction: t }
//             );

//             await auditLog({
//                 companyId,
//                 userId: actorUserId,
//                 action: 'UPSERT_USER',
//                 entity: 'User',
//                 entityId: existingUser.id,
//                 data: { email, role_id, action: 'updated_existing_subaccount' },
//             });

//             return { user: existingUser, action: 'updated' };
//         }

//         // ────────────────────────────────────────────────────────────────────────
//         // CASE B: Email exists in ANOTHER company
//         //         → Convert them: strip is_owner, move to calling company
//         // ────────────────────────────────────────────────────────────────────────
//         if (existingUser && existingUser.company_id !== parseInt(companyId)) {

//             const previousCompanyId = existingUser.company_id;
//             const wasOwner = existingUser.is_owner;

//             // Restore if soft-deleted
//             if (existingUser.deleted_at) await existingUser.restore({ transaction: t });

//             // Move the user: change company, strip owner status, apply new password & role
//             await existingUser.update(
//                 {
//                     company_id: companyId,
//                     role_id,
//                     is_owner: false,   // loses ownership
//                     is_active: true,
//                     password: hashedPassword, // calling company sets a fresh password
//                     ...(first_name && { first_name }),
//                     ...(last_name !== undefined && { last_name }),
//                     ...(phone && { phone }),
//                 },
//                 { transaction: t }
//             );

//             await auditLog({
//                 companyId,
//                 userId: actorUserId,
//                 action: 'UPSERT_USER',
//                 entity: 'User',
//                 entityId: existingUser.id,
//                 data: {
//                     email,
//                     role_id,
//                     action: 'converted_from_other_company',
//                     previous_company_id: previousCompanyId,
//                     was_owner: wasOwner,
//                 },
//             });

//             return {
//                 user: existingUser,
//                 action: 'converted',
//                 warning: wasOwner
//                     ? `This user was the owner of company #${previousCompanyId}. They have been removed from that company and added here as a subaccount. The previous company now has no owner.`
//                     : `This user was a subaccount in company #${previousCompanyId}. They have been moved to your company.`,
//             };
//         }

//         // ────────────────────────────────────────────────────────────────────────
//         // CASE C: Brand new email — create a fresh subaccount
//         // ────────────────────────────────────────────────────────────────────────
//         const newUser = await User.create(
//             {
//                 company_id: companyId,
//                 role_id,
//                 email,
//                 password: hashedPassword,
//                 first_name: first_name || email.split('@')[0],
//                 last_name: last_name || null,
//                 phone: phone || null,
//                 is_owner: false,
//                 is_active: true,
//             },
//             { transaction: t }
//         );

//         await auditLog({
//             companyId,
//             userId: actorUserId,
//             action: 'UPSERT_USER',
//             entity: 'User',
//             entityId: newUser.id,
//             data: { email, role_id, action: 'created_new_subaccount' },
//         });

//         return { user: newUser, action: 'created' };
//     });
// };

// // ═══════════════════════════════════════════════════════════════════════════
// //  LIST SUBACCOUNTS
// // ═══════════════════════════════════════════════════════════════════════════
// const getSubaccounts = async (companyId, { page = 1, limit = 20, search, role_id, is_active } = {}) => {
//     const where = {
//         company_id: companyId,
//         is_owner: false,
//     };

//     if (typeof is_active === 'boolean') where.is_active = is_active;
//     if (role_id) where.role_id = role_id;

//     if (search) {
//         where[Op.or] = [
//             { first_name: { [Op.like]: `%${search}%` } },
//             { last_name: { [Op.like]: `%${search}%` } },
//             { email: { [Op.like]: `%${search}%` } },
//         ];
//     }

//     return paginate(
//         User,
//         {
//             where,
//             include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
//             attributes: { exclude: ['password', 'refresh_token_hash', 'password_reset_token', 'password_reset_expires'] },
//             order: [['created_at', 'DESC']],
//         },
//         { page, limit }
//     );
// };

// // ═══════════════════════════════════════════════════════════════════════════
// //  GET SINGLE SUBACCOUNT
// // ═══════════════════════════════════════════════════════════════════════════
// const getSubaccountById = async (companyId, userId) => {
//     const user = await User.findOne({
//         where: { id: userId, company_id: companyId, is_owner: false },
//         include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'permissions'] }],
//         attributes: { exclude: ['password', 'refresh_token_hash', 'password_reset_token', 'password_reset_expires'] },
//     });

//     if (!user) {
//         const err = new Error('User not found');
//         err.status = 404;
//         throw err;
//     }
//     return user;
// };

// // ═══════════════════════════════════════════════════════════════════════════
// //  TOGGLE ACTIVE STATUS
// // ═══════════════════════════════════════════════════════════════════════════
// const toggleUserStatus = async (companyId, userId, actorUserId) => {
//     const user = await User.findOne({ where: { id: userId, company_id: companyId, is_owner: false } });
//     if (!user) {
//         const err = new Error('User not found');
//         err.status = 404;
//         throw err;
//     }
//     if (user.id === parseInt(actorUserId)) {
//         const err = new Error('You cannot deactivate yourself');
//         err.status = 400;
//         throw err;
//     }
//     await user.update({ is_active: !user.is_active });
//     return user;
// };

// // ═══════════════════════════════════════════════════════════════════════════
// //  REMOVE SUBACCOUNT (soft delete)
// // ═══════════════════════════════════════════════════════════════════════════
// const removeSubaccount = async (companyId, userId, actorUserId) => {
//     const user = await User.findOne({ where: { id: userId, company_id: companyId, is_owner: false } });
//     if (!user) {
//         const err = new Error('User not found');
//         err.status = 404;
//         throw err;
//     }
//     if (user.id === parseInt(actorUserId)) {
//         const err = new Error('You cannot remove yourself');
//         err.status = 400;
//         throw err;
//     }
//     await user.destroy();
//     await auditLog({ companyId, userId: actorUserId, action: 'DELETE', entity: 'User', entityId: userId });
// };

// module.exports = {
//     upsertSubaccount,
//     getSubaccounts,
//     getSubaccountById,
//     toggleUserStatus,
//     removeSubaccount,
// };
// 'use strict';
// const userService = require('./users.service');
// const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

// // ── Helper: strip sensitive fields ──────────────────────────────────────────
// const sanitize = (user) => {
//     const u = user.toJSON ? user.toJSON() : { ...user };
//     delete u.password;
//     delete u.refresh_token_hash;
//     delete u.password_reset_token;
//     delete u.password_reset_expires;
//     return u;
// };

// // ── POST /api/v1/users/upsert ───────────────────────────────────────────────
// const upsertUser = async (req, res) => {
//     try {
//         const { user, action, warning } = await userService.upsertSubaccount(
//             req.user.company_id,
//             req.user.id,
//             req.body
//         );

//         const messages = {
//             created: 'Subaccount created successfully',
//             updated: 'Subaccount updated successfully',
//             converted: 'User converted and added to your company as subaccount',
//         };

//         return res.status(action === 'created' ? 201 : 200).json({
//             success: true,
//             message: messages[action],
//             action,                        // 'created' | 'updated' | 'converted'
//             ...(warning && { warning }),   // only present when previous owner was converted
//             data: sanitize(user),
//         });
//     } catch (err) {
//         return sendError(res, err);
//     }
// };

// // ── GET /api/v1/users ───────────────────────────────────────────────────────
// const listUsers = async (req, res) => {
//     try {
//         const { page = 1, limit = 20, search, role_id, is_active } = req.query;

//         const isActiveFilter =
//             is_active === 'true' ? true : is_active === 'false' ? false : undefined;

//         const result = await userService.getSubaccounts(req.user.company_id, {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             search,
//             role_id: role_id ? parseInt(role_id) : undefined,
//             is_active: isActiveFilter,
//         });

//         return sendPaginated(res, result.data, result.pagination, 'Users fetched successfully');
//     } catch (err) {
//         return sendError(res, err);
//     }
// };

// // ── GET /api/v1/users/:id ───────────────────────────────────────────────────
// const getUser = async (req, res) => {
//     try {
//         const user = await userService.getSubaccountById(req.user.company_id, req.params.id);
//         return sendSuccess(res, user, 'User fetched successfully');
//     } catch (err) {
//         return sendError(res, err);
//     }
// };

// // ── PATCH /api/v1/users/:id/toggle-status ──────────────────────────────────
// const toggleStatus = async (req, res) => {
//     try {
//         const user = await userService.toggleUserStatus(
//             req.user.company_id,
//             req.params.id,
//             req.user.id
//         );
//         return sendSuccess(res, sanitize(user), `User ${user.is_active ? 'activated' : 'deactivated'} successfully`);
//     } catch (err) {
//         return sendError(res, err);
//     }
// };

// // ── DELETE /api/v1/users/:id ────────────────────────────────────────────────
// const removeUser = async (req, res) => {
//     try {
//         await userService.removeSubaccount(req.user.company_id, req.params.id, req.user.id);
//         return sendSuccess(res, null, 'User removed from company successfully');
//     } catch (err) {
//         return sendError(res, err);
//     }
// };

// module.exports = { upsertUser, listUsers, getUser, toggleStatus, removeUser };
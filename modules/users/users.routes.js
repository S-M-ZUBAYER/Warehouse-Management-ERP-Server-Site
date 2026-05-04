'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../auth/auth.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const {
    createSubAccountValidator,
    upsertSubAccountValidator,
    updateSubAccountValidator,
} = require('../auth/auth.validator');

// All routes below require authentication
router.use(authenticate);

// GET  /api/v1/users          — list sub accounts
router.get('/', authController.getSubAccounts);

// POST /api/v1/users          — create sub account (owner/admin only)
router.post('/', requireRole('owner', 'admin'), createSubAccountValidator, authController.createSubAccount);

// GET  /api/v1/users/:id      — get single sub account
router.get('/:id', authController.getSubAccountById);

// PUT  /api/v1/users/:id      — update sub account (owner/admin only)
router.put('/:id', requireRole('owner', 'admin'), updateSubAccountValidator, authController.updateSubAccount);

// Post  /api/v1/users/upsert      — update sub account (owner/admin only)
router.post('/upsert', requireRole('owner', 'admin'), upsertSubAccountValidator, authController.upsertSubAccount);

// DELETE /api/v1/users/:id   — delete sub account (owner/admin only)
router.delete('/:id', requireRole('owner', 'admin'), authController.deleteSubAccount);

module.exports = router;



// 'use strict';
// const express = require('express');
// const router = express.Router();
// const ctrl = require('./users.controller');
// const { authenticate } = require('../../middlewares/auth');
// const { ownerOnly } = require('../../middlewares/ownerOnly');
// const validate = require('../../middlewares/validate');
// const {
//   upsertUserValidator,
//   listUsersValidator,
//   userIdValidator,
// } = require('./users.validator');

// // All user routes require authentication
// router.use(authenticate);

// // ── All user management routes also require is_owner = true ─────────────────
// router.use(ownerOnly);

// // ═══════════════════════════════════════════════════════════════════════════

// /**
//  * @swagger
//  * /users/upsert:
//  *   post:
//  *     summary: Upsert a user as subaccount
//  *     description: |
//  *       **Only the company owner can call this.**
//  *
//  *       Three scenarios:
//  *
//  *       - **New email** → Creates a fresh subaccount under your company.
//  *
//  *       - **Email exists in YOUR company** → Updates their role and password.
//  *
//  *       - **Email exists in ANOTHER company** → Converts them:
//  *         they lose their previous owner status and move to your company as a subaccount.
//  *         The calling company's password is set. A `warning` field is returned
//  *         indicating the previous company now has no owner.
//  *
//  *       The `action` field in the response tells you what happened:
//  *       `created` | `updated` | `converted`
//  *     tags: [Users]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [email, role_id, password]
//  *             properties:
//  *               email:
//  *                 type: string
//  *                 format: email
//  *                 example: sony@gmail.com
//  *               role_id:
//  *                 type: integer
//  *                 example: 3
//  *               password:
//  *                 type: string
//  *                 minLength: 6
//  *                 example: SecurePass123
//  *               first_name:
//  *                 type: string
//  *                 example: Sony
//  *               last_name:
//  *                 type: string
//  *                 example: Rahman
//  *               phone:
//  *                 type: string
//  *                 example: "+8801711000000"
//  *     responses:
//  *       201:
//  *         description: Subaccount created (new email)
//  *         content:
//  *           application/json:
//  *             example:
//  *               success: true
//  *               message: Subaccount created successfully
//  *               action: created
//  *               data: { id: 5, email: "sony@gmail.com", company_id: 2, is_owner: false }
//  *       200:
//  *         description: Updated or converted
//  *         content:
//  *           application/json:
//  *             examples:
//  *               updated:
//  *                 summary: Email existed in this company
//  *                 value:
//  *                   success: true
//  *                   message: Subaccount updated successfully
//  *                   action: updated
//  *                   data: {}
//  *               converted:
//  *                 summary: Email was owner of another company
//  *                 value:
//  *                   success: true
//  *                   message: User converted and added to your company as subaccount
//  *                   action: converted
//  *                   warning: "This user was the owner of company #1. They have been removed from that company and added here as a subaccount. The previous company now has no owner."
//  *                   data: {}
//  *       400:
//  *         description: Tried to convert the owner of your own company
//  *       403:
//  *         description: Caller is not the company owner
//  *       404:
//  *         description: role_id not found
//  *       422:
//  *         description: Validation errors
//  */
// router.post(
//   '/upsert',
//   upsertUserValidator,
//   validate,
//   ctrl.upsertUser
// );

// /**
//  * @swagger
//  * /users:
//  *   get:
//  *     summary: List all subaccounts for this company
//  *     tags: [Users]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema: { type: integer, default: 1 }
//  *       - in: query
//  *         name: limit
//  *         schema: { type: integer, default: 20 }
//  *       - in: query
//  *         name: search
//  *         schema: { type: string }
//  *         description: Search by name or email
//  *       - in: query
//  *         name: role_id
//  *         schema: { type: integer }
//  *       - in: query
//  *         name: is_active
//  *         schema: { type: boolean }
//  *     responses:
//  *       200:
//  *         description: Paginated user list
//  */
// router.get(
//   '/',
//   listUsersValidator,
//   validate,
//   ctrl.listUsers
// );

// /**
//  * @swagger
//  * /users/{id}:
//  *   get:
//  *     summary: Get a single subaccount
//  *     tags: [Users]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema: { type: integer }
//  *     responses:
//  *       200:
//  *         description: User detail
//  *       404:
//  *         description: Not found
//  */
// router.get(
//   '/:id',
//   userIdValidator,
//   validate,
//   ctrl.getUser
// );

// /**
//  * @swagger
//  * /users/{id}/toggle-status:
//  *   patch:
//  *     summary: Activate or deactivate a subaccount
//  *     tags: [Users]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema: { type: integer }
//  *     responses:
//  *       200:
//  *         description: Status toggled
//  *       400:
//  *         description: Cannot deactivate yourself
//  */
// router.patch(
//   '/:id/toggle-status',
//   userIdValidator,
//   validate,
//   ctrl.toggleStatus
// );

// /**
//  * @swagger
//  * /users/{id}:
//  *   delete:
//  *     summary: Remove a subaccount from this company (soft delete)
//  *     tags: [Users]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema: { type: integer }
//  *     responses:
//  *       200:
//  *         description: User removed
//  *       400:
//  *         description: Cannot remove yourself
//  */
// router.delete(
//   '/:id',
//   userIdValidator,
//   validate,
//   ctrl.removeUser
// );

// module.exports = router;
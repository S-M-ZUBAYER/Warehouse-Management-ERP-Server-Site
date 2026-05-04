'use strict';
/**
 * skuSyncGroup.service.js
 *
 * Handles the "linked merchant SKU" feature:
 *   - TP870 is mapped to stores → TP890 is NOT mapped to those same stores
 *   - Add TP890 as a secondary in TP870's group
 *   - When stock changes on TP870 or TP890, ALL group members move together
 *   - Java reads only the primary's platform_sku_mappings for sync
 *
 * API surface:
 *   GET  /api/v1/sku-sync-groups              → list groups for the company
 *   GET  /api/v1/sku-sync-groups/:groupId     → get one group with members
 *   POST /api/v1/sku-sync-groups              → create group (primarySkuId)
 *   POST /api/v1/sku-sync-groups/:groupId/members → add a secondary SKU
 *   DELETE /api/v1/sku-sync-groups/:groupId/members/:memberSkuId → remove secondary
 *   DELETE /api/v1/sku-sync-groups/:groupId   → dissolve group
 *   GET  /api/v1/sku-sync-groups/eligible-secondaries?primarySkuId=X → candidate list
 */

const { Op } = require('sequelize');

// ─────────────────────────────────────────────────────────────────────────────
// 1. List all sync groups for this company
// ─────────────────────────────────────────────────────────────────────────────
const listGroups = async (user) => {
    const { MerchantSkuSyncGroup, MerchantSkuSyncMember, MerchantSku } = require('../../models');

    const groups = await MerchantSkuSyncGroup.findAll({
        where:   { company_id: user.companyId, deleted_at: null },
        include: [
            {
                model:      MerchantSku,
                as:         'primarySku',
                attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'warehouse_id'],
            },
            {
                model:   MerchantSkuSyncMember,
                as:      'members',
                include: [{
                    model:      MerchantSku,
                    as:         'memberSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url'],
                }],
            },
        ],
        order: [['created_at', 'DESC']],
    });

    return groups.map((g) => ({
        id:         g.id,
        name:       g.name,
        primarySku: g.primarySku,
        members:    g.members.map((m) => ({
            memberId:  m.id,
            memberSku: m.memberSku,
        })),
        memberCount: g.members.length,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get one group with full details
// ─────────────────────────────────────────────────────────────────────────────
const getGroup = async (user, groupId) => {
    const { MerchantSkuSyncGroup, MerchantSkuSyncMember, MerchantSku, PlatformSkuMapping, PlatformStore } = require('../../models');

    const group = await MerchantSkuSyncGroup.findOne({
        where:   { id: groupId, company_id: user.companyId, deleted_at: null },
        include: [
            {
                model:      MerchantSku,
                as:         'primarySku',
                attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'warehouse_id'],
                include: [{
                    model:      PlatformSkuMapping,
                    as:         'platformMappings',
                    where:      { is_active: true, deleted_at: null },
                    required:   false,
                    attributes: ['id', 'platform_store_id', 'sync_status'],
                    include: [{ model: PlatformStore, as: 'platformStore', attributes: ['id', 'store_name', 'platform'] }],
                }],
            },
            {
                model:   MerchantSkuSyncMember,
                as:      'members',
                include: [{
                    model:      MerchantSku,
                    as:         'memberSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'warehouse_id'],
                }],
            },
        ],
    });

    if (!group) {
        const err = new Error('Sync group not found'); err.statusCode = 404; throw err;
    }

    return {
        id:         group.id,
        name:       group.name,
        primarySku: {
            ...group.primarySku.toJSON(),
            mappings: (group.primarySku.platformMappings ?? []).map((m) => ({
                id:         m.id,
                store_name: m.platformStore?.store_name,
                platform:   m.platformStore?.platform,
                sync_status:m.sync_status,
            })),
        },
        members: group.members.map((m) => ({ memberId: m.id, memberSku: m.memberSku })),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create a new sync group (primarySkuId becomes the master)
// ─────────────────────────────────────────────────────────────────────────────
const createGroup = async (user, body) => {
    const { MerchantSkuSyncGroup, MerchantSku } = require('../../models');
    const { primarySkuId, name } = body;

    // Verify SKU belongs to this company
    const sku = await MerchantSku.findOne({ where: { id: primarySkuId, company_id: user.companyId, deleted_at: null } });
    if (!sku) { const err = new Error('Merchant SKU not found'); err.statusCode = 404; throw err; }

    // Cannot already be a primary in another group
    const existing = await MerchantSkuSyncGroup.findOne({
        where: { primary_sku_id: primarySkuId, deleted_at: null },
    });
    if (existing) {
        const err = new Error(`${sku.sku_name} is already the primary SKU in another sync group`);
        err.statusCode = 409; throw err;
    }

    // A SKU may also be a child in one or more other groups. Only duplicate
    // primary groups for the same SKU are prevented.

    const group = await MerchantSkuSyncGroup.create({
        company_id:     user.companyId,
        primary_sku_id: primarySkuId,
        name:           name ?? `${sku.sku_name} Group`,
        created_by:     user.id,
    });

    return { groupId: group.id, message: 'Sync group created', primarySku: sku.sku_name };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Add a secondary SKU to an existing group
//
//    Rules:
//      a) secondarySkuId must share the same warehouse_id as the primary.
//      b) secondarySkuId must not already be linked under this exact parent group.
//         It may be child in other groups and may also be a parent SKU.
// ─────────────────────────────────────────────────────────────────────────────
const addMember = async (user, groupId, body) => {
    const {
        MerchantSkuSyncGroup,
        MerchantSkuSyncMember,
        MerchantSku,
    } = require('../../models');

    const { secondarySkuId } = body;
    if (!secondarySkuId) { const err = new Error('secondarySkuId is required'); err.statusCode = 400; throw err; }

    // Load group + primary SKU
    const group = await MerchantSkuSyncGroup.findOne({
        where:   { id: groupId, company_id: user.companyId, deleted_at: null },
        include: [{ model: MerchantSku, as: 'primarySku', attributes: ['id', 'sku_name', 'warehouse_id'] }],
    });
    if (!group) { const err = new Error('Sync group not found'); err.statusCode = 404; throw err; }

    // Load secondary SKU
    const secondarySku = await MerchantSku.findOne({
        where: { id: secondarySkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!secondarySku) { const err = new Error('Secondary merchant SKU not found'); err.statusCode = 404; throw err; }

    // ── Rule (b): same warehouse ──────────────────────────────────────────────
    if (
        group.primarySku.warehouse_id &&
        secondarySku.warehouse_id &&
        group.primarySku.warehouse_id !== secondarySku.warehouse_id
    ) {
        const err = new Error(
            `${secondarySku.sku_name} is in a different warehouse from ${group.primarySku.sku_name}. ` +
            `Both must share the same warehouse to be linked.`
        );
        err.statusCode = 409; throw err;
    }

    // ── Rule (b): avoid duplicate link inside this exact group ───────────────
    const alreadyInThisGroup = await MerchantSkuSyncMember.findOne({
        where: { company_id: user.companyId, group_id: groupId, member_sku_id: secondarySkuId },
    });
    if (alreadyInThisGroup) {
        const err = new Error(`${secondarySku.sku_name} is already linked under this parent SKU`);
        err.statusCode = 409; throw err;
    }

    // A child SKU may belong to multiple parent groups and may also be a parent
    // SKU itself. No cross-group/primary restriction is applied here.
    await MerchantSkuSyncMember.create({
        group_id:      groupId,
        company_id:    user.companyId,
        member_sku_id: secondarySkuId,
    });

    return { message: `${secondarySku.sku_name} added to sync group`, groupId };
};


// ─────────────────────────────────────────────────────────────────────────────
// 5. Add multiple secondary SKUs under a primary parent SKU.
//    Creates the group only when the user confirms the modal.
// ─────────────────────────────────────────────────────────────────────────────
const addMembersForPrimary = async (user, primarySkuId, body) => {
    const { MerchantSkuSyncGroup, MerchantSkuSyncMember, MerchantSku } = require('../../models');
    const secondarySkuIds = [...new Set((body.secondarySkuIds ?? []).map((id) => parseInt(id, 10)).filter(Boolean))];

    if (!primarySkuId || !secondarySkuIds.length) {
        const err = new Error('primarySkuId and secondarySkuIds[] are required');
        err.statusCode = 400; throw err;
    }

    const primarySku = await MerchantSku.findOne({
        where: { id: primarySkuId, company_id: user.companyId, deleted_at: null },
        attributes: ['id', 'sku_name', 'warehouse_id'],
    });
    if (!primarySku) { const err = new Error('Primary merchant SKU not found'); err.statusCode = 404; throw err; }

    // The primary SKU may also be a child in another group. This supports
    // multi-level and many-to-many sync grouping.

    let group = await MerchantSkuSyncGroup.findOne({
        where: { company_id: user.companyId, primary_sku_id: primarySkuId, deleted_at: null },
    });

    let createdGroup = false;
    if (!group) {
        group = await MerchantSkuSyncGroup.create({
            company_id: user.companyId,
            primary_sku_id: primarySkuId,
            name: `${primarySku.sku_name} Group`,
            created_by: user.id || user.userId || null,
        });
        createdGroup = true;
    }

    const added = [];
    const failed = [];

    for (const secondarySkuId of secondarySkuIds) {
        try {
            await addMember(user, group.id, { secondarySkuId });
            added.push(secondarySkuId);
        } catch (err) {
            failed.push({ secondarySkuId, message: err.message });
        }
    }

    if (!added.length && failed.length) {
        if (createdGroup) await group.destroy();
        const err = new Error(failed[0].message || 'No SKUs could be added');
        err.statusCode = 409;
        err.details = failed;
        throw err;
    }

    return {
        groupId: group.id,
        createdGroup,
        added,
        failed,
        message: `${added.length} SKU(s) linked${failed.length ? `, ${failed.length} skipped` : ''}`,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Remove a secondary SKU from a group
// ─────────────────────────────────────────────────────────────────────────────
const removeMember = async (user, groupId, memberSkuId) => {
    const { MerchantSkuSyncMember } = require('../../models');

    const member = await MerchantSkuSyncMember.findOne({
        where: { group_id: groupId, member_sku_id: memberSkuId, company_id: user.companyId },
    });
    if (!member) { const err = new Error('Member not found in this group'); err.statusCode = 404; throw err; }

    await member.destroy();
    return { message: 'Member removed from sync group' };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Dissolve a group entirely (soft-delete)
// ─────────────────────────────────────────────────────────────────────────────
const dissolveGroup = async (user, groupId) => {
    const { MerchantSkuSyncGroup, MerchantSkuSyncMember } = require('../../models');

    const group = await MerchantSkuSyncGroup.findOne({
        where: { id: groupId, company_id: user.companyId, deleted_at: null },
    });
    if (!group) { const err = new Error('Sync group not found'); err.statusCode = 404; throw err; }

    // Remove all members first, then soft-delete the group
    await MerchantSkuSyncMember.destroy({ where: { group_id: groupId } });
    await group.update({ deleted_at: new Date() });

    return { message: 'Sync group dissolved' };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Get eligible secondary SKUs for a given primary SKU
//    Returns merchant SKUs that:
//      - Share the same warehouse as the primary
//      - Are not the primary itself
//      - Are not already linked under this exact primary group
//
//    A SKU can now be child in multiple groups and can also be another parent.
// ─────────────────────────────────────────────────────────────────────────────
const getEligibleSecondaries = async (user, primarySkuId) => {
    const {
        MerchantSku,
        MerchantSkuSyncGroup,
        MerchantSkuSyncMember,
    } = require('../../models');

    const parsedPrimarySkuId = parseInt(primarySkuId, 10);

    const primarySku = await MerchantSku.findOne({
        where:      { id: parsedPrimarySkuId, company_id: user.companyId, deleted_at: null },
        attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'warehouse_id'],
    });
    if (!primarySku) { const err = new Error('Primary SKU not found'); err.statusCode = 404; throw err; }

    const primaryGroup = await MerchantSkuSyncGroup.findOne({
        where: { company_id: user.companyId, primary_sku_id: parsedPrimarySkuId, deleted_at: null },
        attributes: ['id'],
    });

    const excludedIds = new Set([parsedPrimarySkuId]);
    if (primaryGroup) {
        const existingMembers = await MerchantSkuSyncMember.findAll({
            where: { company_id: user.companyId, group_id: primaryGroup.id },
            attributes: ['member_sku_id'],
        });
        existingMembers.forEach((m) => excludedIds.add(m.member_sku_id));
    }

    const where = {
        company_id: user.companyId,
        deleted_at: null,
        id:         { [Op.notIn]: [...excludedIds] },
    };
    if (primarySku.warehouse_id) where.warehouse_id = primarySku.warehouse_id;

    const candidates = await MerchantSku.findAll({
        where,
        attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'warehouse_id'],
        order:      [['sku_name', 'ASC']],
        limit:      300,
    });

    return candidates.map((s) => s.toJSON());
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. mirrorStockChange (called from stock service when stock moves)
//    Supports many-to-many groups. A SKU can be primary in one group and child
//    in multiple groups. We mirror the movement to every directly/indirectly
//    connected SKU in the same company sync graph.
// ─────────────────────────────────────────────────────────────────────────────
const mirrorStockChange = async (sequelizeTransaction, user, changedSkuId, delta, warehouseId) => {
    const {
        MerchantSkuSyncGroup,
        MerchantSkuSyncMember,
        SkuWarehouseStock,
    } = require('../../models');

    const companyId = user.companyId;
    const visitedSkuIds = new Set([parseInt(changedSkuId, 10)]);
    const queue = [parseInt(changedSkuId, 10)];

    while (queue.length) {
        const skuId = queue.shift();

        const primaryGroups = await MerchantSkuSyncGroup.findAll({
            where: { company_id: companyId, primary_sku_id: skuId, deleted_at: null },
            include: [{ model: MerchantSkuSyncMember, as: 'members', attributes: ['member_sku_id'] }],
            transaction: sequelizeTransaction,
        });

        for (const group of primaryGroups) {
            for (const member of group.members ?? []) {
                const nextId = member.member_sku_id;
                if (nextId && !visitedSkuIds.has(nextId)) {
                    visitedSkuIds.add(nextId);
                    queue.push(nextId);
                }
            }
        }

        const memberLinks = await MerchantSkuSyncMember.findAll({
            where: { company_id: companyId, member_sku_id: skuId },
            include: [{
                model: MerchantSkuSyncGroup,
                as: 'group',
                where: { company_id: companyId, deleted_at: null },
                include: [{ model: MerchantSkuSyncMember, as: 'members', attributes: ['member_sku_id'] }],
            }],
            transaction: sequelizeTransaction,
        });

        for (const link of memberLinks) {
            const group = link.group;
            const ids = [group?.primary_sku_id, ...(group?.members ?? []).map((m) => m.member_sku_id)].filter(Boolean);
            for (const nextId of ids) {
                if (!visitedSkuIds.has(nextId)) {
                    visitedSkuIds.add(nextId);
                    queue.push(nextId);
                }
            }
        }
    }

    const linkedSkuIds = [...visitedSkuIds].filter((id) => id !== parseInt(changedSkuId, 10));
    if (!linkedSkuIds.length) return [];

    for (const siblingSkuId of linkedSkuIds) {
        const [stockRecord] = await SkuWarehouseStock.findOrCreate({
            where: { merchant_sku_id: siblingSkuId, warehouse_id: warehouseId },
            defaults: {
                company_id: companyId,
                merchant_sku_id: siblingSkuId,
                warehouse_id: warehouseId,
                qty_on_hand: 0,
                qty_reserved: 0,
                qty_inbound: 0,
            },
            lock: sequelizeTransaction.LOCK?.UPDATE,
            transaction: sequelizeTransaction,
        });

        const nextQty = (stockRecord.qty_on_hand || 0) + delta;
        if (nextQty < 0) {
            const err = new Error(`Insufficient stock for linked SKU ${siblingSkuId}: available ${stockRecord.qty_on_hand}, requested ${Math.abs(delta)}`);
            err.statusCode = 400;
            throw err;
        }

        await stockRecord.update({ qty_on_hand: nextQty }, { transaction: sequelizeTransaction });
    }

    return linkedSkuIds;
};

module.exports = {
    listGroups,
    getGroup,
    createGroup,
    addMember,
    addMembersForPrimary,
    removeMember,
    dissolveGroup,
    getEligibleSecondaries,
    mirrorStockChange,
};
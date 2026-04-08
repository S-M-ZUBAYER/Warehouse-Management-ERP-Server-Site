'use strict';

const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const CACHE_KEY = 'global:pages:tree';
const CACHE_TTL = 300; // 5 minutes

// ─── Build nested tree from flat list ─────────────────────────────────────────
const buildTree = (pages) => {
    const map = {};
    const roots = [];

    // Index all pages by id
    pages.forEach(p => {
        map[p.id] = { ...p.toJSON(), sub: [] };
    });

    pages.forEach(p => {
        if (p.parent_id && map[p.parent_id]) {
            map[p.parent_id].sub.push(map[p.id]);
        } else {
            roots.push(map[p.id]);
        }
    });

    // Sort by order at every level
    const sortByOrder = (nodes) => {
        nodes.sort((a, b) => a.order - b.order);
        nodes.forEach(n => { if (n.sub.length) sortByOrder(n.sub); });
        return nodes;
    };

    return sortByOrder(roots);
};

// ─── Get Pages (nested tree) ──────────────────────────────────────────────────
const getPages = async () => {
    const { Pages } = require('../../models');


    // Try cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const pages = await Pages.findAll({
        where: { is_active: true },
        order: [
            ['level', 'ASC'],
            ['order', 'ASC'],
        ],
    });

    const tree = buildTree(pages);

    await redis.set(CACHE_KEY, JSON.stringify(tree), { EX: CACHE_TTL });

    return tree;
};

// ─── Seed / Bulk Upsert Pages ─────────────────────────────────────────────────
//
// Accepts the nested pages array from the frontend/owner.
// Flattens it, assigns levels and order, then upserts by key.
//
const seedPages = async (pagesInput) => {
    const { Pages } = require('../../models');

    // Flatten nested structure → rows for DB
    const flatten = (nodes, parentKey = null, level = 1) => {
        const rows = [];
        nodes.forEach((node, index) => {
            const { key, label, hasSub, sub } = node;
            rows.push({
                key,
                label: label || null,
                parent_key: parentKey,
                level,
                has_sub: hasSub || (Array.isArray(sub) && sub.length > 0) || false,
                order: index,
                is_active: true,
            });
            if (Array.isArray(sub) && sub.length > 0) {
                rows.push(...flatten(sub, key, level + 1));
            }
        });
        return rows;
    };

    const flatRows = flatten(pagesInput);

    await sequelize.transaction(async (t) => {
        // Step 1: Upsert all pages by key (without parent_id — we resolve next)
        for (const row of flatRows) {
            await Pages.upsert(
                {
                    key: row.key,
                    label: row.label,
                    level: row.level,
                    has_sub: row.has_sub,
                    order: row.order,
                    is_active: row.is_active,
                },
                { transaction: t }
            );
        }

        // Step 2: Resolve parent_id — now all rows exist with their IDs
        for (const row of flatRows) {
            if (row.parent_key) {
                const parent = await Pages.findOne({ where: { key: row.parent_key }, transaction: t });
                const child = await Pages.findOne({ where: { key: row.key }, transaction: t });
                if (parent && child) {
                    await child.update({ parent_id: parent.id }, { transaction: t });
                }
            } else {
                // Ensure top-level pages have no parent
                const page = await Pages.findOne({ where: { key: row.key }, transaction: t });
                if (page) await page.update({ parent_id: null }, { transaction: t });
            }
        }
    });

    // Bust cache
    await redis.del(CACHE_KEY);

    return getPages();
};

// ─── Update Single Page ───────────────────────────────────────────────────────
const updatePage = async (pageId, data) => {
    const { Pages } = require('../../models');

    const page = await Pages.findByPk(pageId);
    if (!page) {
        const err = new Error('Page not found');
        err.statusCode = 404;
        throw err;
    }

    // If key is changing — check uniqueness
    if (data.key && data.key !== page.key) {
        const duplicate = await Pages.findOne({ where: { key: data.key } });
        if (duplicate) {
            const err = new Error('A page with this key already exists');
            err.statusCode = 409;
            throw err;
        }
    }

    const updates = {};
    if (data.key !== undefined) updates.key = data.key;
    if (data.label !== undefined) updates.label = data.label;
    if (data.hasSub !== undefined) updates.has_sub = data.hasSub;
    if (data.order !== undefined) updates.order = data.order;
    if (data.isActive !== undefined) updates.is_active = data.isActive;

    await page.update(updates);
    await redis.del(CACHE_KEY);

    return page;
};

// ─── Delete Page ──────────────────────────────────────────────────────────────
const deletePage = async (pageId) => {
    const { Pages } = require('../../models');

    const page = await Pages.findByPk(pageId);
    if (!page) {
        const err = new Error('Page not found');
        err.statusCode = 404;
        throw err;
    }

    // Check if it has children
    const childCount = await Pages.count({ where: { parent_id: pageId } });
    if (childCount > 0) {
        const err = new Error('Cannot delete a page that has sub-pages. Delete sub-pages first.');
        err.statusCode = 400;
        throw err;
    }

    await page.destroy();
    await redis.del(CACHE_KEY);
};

module.exports = {
    getPages,
    seedPages,
    updatePage,
    deletePage,
};
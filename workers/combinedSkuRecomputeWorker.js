'use strict';

/**
 * combinedSkuRecomputeWorker.js
 *
 * Background worker that listens on the Redis queue 'queue:combine_sku_recompute'
 * and recomputes computed_quantity for combine SKUs whenever child stock changes.
 *
 * Uses BLPOP (blocking pop) so it sleeps with zero CPU when the queue is empty.
 * Debounce: if the same combineSkuId appears multiple times in rapid succession
 * (e.g. many sales arrive at once), it is processed only once per DEBOUNCE_MS window.
 *
 * Start this worker as a separate process:
 *   node workers/combinedSkuRecomputeWorker.js
 *
 * Or add to your pm2 ecosystem:
 *   { name: 'sku-recompute-worker', script: 'workers/combinedSkuRecomputeWorker.js' }
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const redis = require('../config/redis');

const QUEUE_KEY = 'queue:combine_sku_recompute';
const DEBOUNCE_MS = 300;   // collapse duplicate recompute jobs within 300ms
const POLL_TIMEOUT = 5;     // BLPOP timeout in seconds (0 = block forever)

// In-memory debounce: combineSkuId → timeout handle
const pending = new Map();

// ─── Core recompute logic ─────────────────────────────────────────────────────
const recomputeOne = async (companyId, combineSkuId) => {
    const { CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../models');

    const items = await CombineSkuItem.findAll({
        where: { combine_sku_id: combineSkuId, company_id: companyId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
    });

    if (!items.length) {
        console.warn(`[worker] Combine SKU ${combineSkuId} has no items — skipping`);
        return;
    }

    // Sum qty_on_hand across all warehouses for each child SKU
    const qtyPerSku = await Promise.all(items.map(async (item) => {
        const result = await SkuWarehouseStock.findOne({
            where: { merchant_sku_id: item.merchant_sku_id, company_id: companyId },
            attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total']],
            raw: true,
        });
        const total = parseInt(result?.total || 0, 10);
        return Math.floor(total / item.quantity);
    }));

    const computedQty = Math.max(0, Math.min(...qtyPerSku));

    await CombineSku.update(
        { computed_quantity: computedQty },
        { where: { id: combineSkuId, company_id: companyId } }
    );

    console.log(`[worker] Recomputed combine SKU ${combineSkuId} → qty ${computedQty}`);
};

// ─── Debounced dispatch ───────────────────────────────────────────────────────
const scheduleRecompute = (companyId, combineSkuId) => {
    const key = `${companyId}:${combineSkuId}`;
    if (pending.has(key)) clearTimeout(pending.get(key));

    const handle = setTimeout(async () => {
        pending.delete(key);
        try {
            await recomputeOne(companyId, combineSkuId);
        } catch (err) {
            console.error(`[worker] Error recomputing combine SKU ${combineSkuId}:`, err.message);
        }
    }, DEBOUNCE_MS);

    pending.set(key, handle);
};

// ─── Main loop ────────────────────────────────────────────────────────────────
const run = async () => {
    console.log('[worker] combinedSkuRecomputeWorker started — listening on', QUEUE_KEY);

    await sequelize.authenticate();
    console.log('[worker] DB connected');

    // Create a dedicated blocking client (redis v4 — no .duplicate())
    const { createClient } = require('redis');
    const blockingClient = createClient({
        socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT) || 6379,
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB) || 0,
    });

    await blockingClient.connect();
    console.log('[worker] Blocking Redis client connected');

    while (true) {
        try {
            const result = await blockingClient.blPop(QUEUE_KEY, POLL_TIMEOUT);
            if (!result) continue; // timeout — loop again

            const [, raw] = result;
            let job;
            try {
                job = JSON.parse(raw);
            } catch {
                console.error('[worker] Failed to parse job:', raw);
                continue;
            }

            const { companyId, combineSkuId } = job;
            if (!companyId || !combineSkuId) {
                console.warn('[worker] Invalid job payload:', job);
                continue;
            }

            scheduleRecompute(companyId, combineSkuId);

        } catch (err) {
            if (err.message && err.message.includes('Connection is closed')) {
                console.error('[worker] Redis connection lost — retrying in 3s');
                await new Promise(r => setTimeout(r, 3000));
            } else {
                console.error('[worker] Unexpected error:', err.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
};

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
    console.log('[worker] SIGTERM received — shutting down gracefully');
    // Drain pending debounced jobs
    for (const [key, handle] of pending) {
        clearTimeout(handle);
        const [companyId, combineSkuId] = key.split(':').map(Number);
        await recomputeOne(companyId, combineSkuId).catch(e => console.error('[worker] Final flush error:', e.message));
    }
    process.exit(0);
});

run().catch(err => {
    console.error('[worker] Fatal startup error:', err);
    process.exit(1);
});
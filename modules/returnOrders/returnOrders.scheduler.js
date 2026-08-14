'use strict';

const service = require('./returnOrders.service');

const INTERVAL_MS = Math.max(
    5 * 60 * 1000,
    Number.parseInt(process.env.SHOPEE_RETURN_BACKGROUND_INTERVAL_MS || String(2 * 60 * 60 * 1000), 10) || 2 * 60 * 60 * 1000
);

let timer = null;
let running = false;

const runScheduledReturnSync = async () => {
    if (running) return;
    running = true;
    try {
        await service.runScheduledShopeeReturnSync({ source: 'scheduler' });
        await service.runScheduledTikTokReturnSync({ source: 'scheduler' });
    } catch (error) {
        console.error('[returnOrders] scheduler failed:', error?.message || error);
    } finally {
        running = false;
    }
};

const startReturnOrdersScheduler = () => {
    if (process.env.SHOPEE_RETURN_SCHEDULER_ENABLED === 'false') return;
    if (timer) return;
    timer = setInterval(runScheduledReturnSync, INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
};

module.exports = {
    startReturnOrdersScheduler,
    runScheduledShopeeReturnSync: runScheduledReturnSync,
    runScheduledReturnSync,
};

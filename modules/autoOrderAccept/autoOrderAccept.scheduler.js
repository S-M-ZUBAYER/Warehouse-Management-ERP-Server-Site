'use strict';

const service = require('./autoOrderAccept.service');

const INTERVAL_MS = Math.max(60000, Number(process.env.AUTO_ORDER_ACCEPT_INTERVAL_MS || 30 * 60 * 1000));

let timer = null;
let running = false;

const runScheduledAutoOrderAccept = async () => {
    if (running) return;
    running = true;
    try {
        const result = await service.runAutoOrderAccept({ source: 'scheduler' });
        console.log(
            `[auto-order-accept] completed stores=${result.storesChecked} packed=${result.totals.packed} failed=${result.totals.failed} skipped=${result.totals.skipped}`
        );
    } catch (error) {
        console.error('[auto-order-accept] scheduler failed:', error?.message || error);
    } finally {
        running = false;
    }
};

const startAutoOrderAcceptScheduler = () => {
    if (process.env.AUTO_ORDER_ACCEPT_SCHEDULER_ENABLED === 'false') return;
    if (timer) return;
    timer = setInterval(runScheduledAutoOrderAccept, INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    console.log(`[auto-order-accept] scheduler started, interval=${INTERVAL_MS}ms`);
};

module.exports = {
    startAutoOrderAcceptScheduler,
    runScheduledAutoOrderAccept,
};

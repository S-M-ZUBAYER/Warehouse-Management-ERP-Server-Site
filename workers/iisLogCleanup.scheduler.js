'use strict';

const { cleanupIisLogs } = require('../utils/iisLogCleanup');

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = Math.max(
    60 * 60 * 1000,
    Number.parseInt(process.env.IIS_LOG_CLEANUP_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10) || DEFAULT_INTERVAL_MS
);

let timer = null;
let running = false;

const runScheduledIisLogCleanup = async () => {
    if (running) return;
    running = true;

    try {
        const result = await cleanupIisLogs();
        console.log(
            `[iis-log-cleanup] completed dir="${result.logDir}" retentionDays=${result.retentionDays} scanned=${result.scanned} deleted=${result.deleted} skipped=${result.skipped} failed=${result.failed} dryRun=${result.dryRun}`
        );
    } catch (error) {
        console.error('[iis-log-cleanup] scheduler failed:', error?.message || error);
    } finally {
        running = false;
    }
};

const startIisLogCleanupScheduler = () => {
    if (process.env.IIS_LOG_CLEANUP_ENABLED !== 'true') return;
    if (timer) return;

    if (process.env.IIS_LOG_CLEANUP_RUN_ON_START !== 'false') {
        runScheduledIisLogCleanup();
    }

    timer = setInterval(runScheduledIisLogCleanup, INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    console.log(`[iis-log-cleanup] scheduler started, interval=${INTERVAL_MS}ms`);
};

module.exports = {
    startIisLogCleanupScheduler,
    runScheduledIisLogCleanup,
};

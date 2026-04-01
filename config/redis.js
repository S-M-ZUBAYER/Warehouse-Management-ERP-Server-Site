'use strict';
const { createClient } = require('redis');

const client = createClient({
    socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('❌ Redis: too many reconnect attempts — giving up');
                return new Error('Redis max retries exceeded');
            }
            return Math.min(retries * 100, 3000); // exponential backoff, max 3s
        },
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0,
});

client.on('connect', () => console.log('✅ Redis connected'));
client.on('error', (err) => console.error('❌ Redis error:', err.message));

// Connect on startup
(async () => {
    try {
        await client.connect();
    } catch (err) {
        console.error('❌ Redis connection failed:', err.message);
        // App continues without Redis — service layer handles missing cache gracefully
    }
})();

/**
 * Safe wrappers — return null instead of throwing if Redis is down
 */
const redis = {
    get: async (key) => {
        try { return await client.get(key); }
        catch { return null; }
    },
    set: async (key, value, ...args) => {
        try { return await client.set(key, value, ...args); }
        catch { return null; }
    },
    del: async (keys) => {
        try {
            if (!keys || (Array.isArray(keys) && keys.length === 0)) return;
            return Array.isArray(keys)
                ? await client.del(keys)
                : await client.del(keys);
        } catch { return null; }
    },
    exists: async (key) => {
        try { return await client.exists(key); }
        catch { return 0; }
    },
    flushByPattern: async (pattern) => {
        try {
            const keys = await client.keys(pattern);
            if (keys.length > 0) await client.del(keys);
        } catch { /* silent */ }
    },
};

module.exports = redis;
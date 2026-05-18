/**
 * scripts/syncDb.js
 *
 * Run with:
 *   node scripts/syncDb.js           ← safe sync (creates missing tables only)
 *   node scripts/syncDb.js --alter   ← adds missing columns (safe for dev)
 *   node scripts/syncDb.js --force   ← DROPS and recreates all tables (dev only!)
 */

'use strict';
require('dotenv').config();

const { sequelize } = require('../config/database');
require('../models'); // registers all models + associations

const arg = process.argv[2];
const force = arg === '--force';
const alter = arg === '--alter';

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        if (force) {
            console.log('⚠️  FORCE mode — dropping and recreating all tables');
        } else if (alter) {
            console.log('🔧 ALTER mode — adding missing columns');
        } else {
            console.log('🟢 SAFE mode — creating missing tables only');
        }

        await sequelize.sync({ force, alter: alter && !force });

        // Show all created tables
        const [tables] = await sequelize.query('SHOW TABLES');
        console.log('\n📋 Tables in database:');
        tables.forEach(t => console.log('  →', Object.values(t)[0]));

        console.log('\n✅ Sync complete');
        process.exit(0);
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
        process.exit(1);
    }
};

run();
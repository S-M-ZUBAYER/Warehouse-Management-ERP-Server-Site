'use strict';

const fs = require('fs/promises');
const path = require('path');

const DEFAULT_IIS_LOG_ROOT = 'C:\\inetpub\\logs\\LogFiles';

const normalizePath = (targetPath) => path.resolve(targetPath || DEFAULT_IIS_LOG_ROOT);

const isInsideIisLogRoot = (targetPath) => {
    const root = normalizePath(process.env.IIS_LOG_CLEANUP_ROOT || DEFAULT_IIS_LOG_ROOT).toLowerCase();
    const target = normalizePath(targetPath).toLowerCase();
    return target === root || target.startsWith(`${root}${path.sep}`);
};

const walkFiles = async (dirPath, files = []) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await walkFiles(fullPath, files);
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
};

const cleanupIisLogs = async ({
    logDir = process.env.IIS_LOG_CLEANUP_DIR || DEFAULT_IIS_LOG_ROOT,
    retentionDays = Number.parseInt(process.env.IIS_LOG_RETENTION_DAYS || '15', 10),
    dryRun = process.env.IIS_LOG_CLEANUP_DRY_RUN === 'true',
} = {}) => {
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
        throw new Error('IIS_LOG_RETENTION_DAYS must be a positive number');
    }

    const resolvedLogDir = normalizePath(logDir);
    if (!isInsideIisLogRoot(resolvedLogDir)) {
        throw new Error(`Refusing to clean logs outside IIS log root: ${resolvedLogDir}`);
    }

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = await walkFiles(resolvedLogDir);
    let deleted = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of files) {
        try {
            const stat = await fs.stat(filePath);
            if (stat.mtimeMs >= cutoffTime) {
                skipped += 1;
                continue;
            }

            if (!dryRun) {
                await fs.unlink(filePath);
            }
            deleted += 1;
        } catch (error) {
            failed += 1;
            console.error('[iis-log-cleanup] failed file:', filePath, error?.message || error);
        }
    }

    return {
        logDir: resolvedLogDir,
        retentionDays,
        dryRun,
        scanned: files.length,
        deleted,
        skipped,
        failed,
    };
};

module.exports = {
    cleanupIisLogs,
};

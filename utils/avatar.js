'use strict';

const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const MAX_AVATAR_BYTES = parseInt(process.env.MAX_AVATAR_BYTES || `${5 * 1024 * 1024}`, 10);
const DATA_URI_RE = /^data:(image\/(?:jpeg|jpg|png|webp|gif|avif));base64,/i;
const MIME_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
};

const getCleanBase64Avatar = (avatar) => {
    if (avatar === undefined || avatar === null || avatar === '') return null;

    if (typeof avatar !== 'string') {
        const err = new Error('Avatar must be a base64 string');
        err.statusCode = 400;
        throw err;
    }

    const trimmed = avatar.trim();
    const match = trimmed.match(DATA_URI_RE);
    const mimeType = match ? match[1].toLowerCase().replace('image/jpg', 'image/jpeg') : 'image/jpeg';
    const base64 = (match ? trimmed.slice(match[0].length) : trimmed).replace(/\s/g, '');

    if (!base64) return null;

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
        const err = new Error('Avatar must be a valid base64 image');
        err.statusCode = 400;
        throw err;
    }

    const sizeBytes = Buffer.byteLength(base64, 'base64');
    if (sizeBytes > MAX_AVATAR_BYTES) {
        const err = new Error(`Avatar image must be ${Math.floor(MAX_AVATAR_BYTES / 1024 / 1024)}MB or smaller`);
        err.statusCode = 413;
        throw err;
    }

    return { base64, mimeType, sizeBytes };
};

const validateAvatar = (avatar) => {
    getCleanBase64Avatar(avatar);
    return true;
};

const saveAvatarFile = async (avatar) => {
    const clean = getCleanBase64Avatar(avatar);
    if (!clean) return null;

    const uploadRoot = process.env.UPLOAD_PATH || './uploads';
    const avatarDir = path.join(uploadRoot, 'avatars');
    const extension = MIME_EXTENSIONS[clean.mimeType] || 'jpg';
    const filename = `avatar-${Date.now()}-${randomUUID()}.${extension}`;

    await fs.mkdir(avatarDir, { recursive: true });
    await fs.writeFile(path.join(avatarDir, filename), Buffer.from(clean.base64, 'base64'));

    return `/uploads/avatars/${filename}`;
};

module.exports = {
    MAX_AVATAR_BYTES,
    validateAvatar,
    saveAvatarFile,
};

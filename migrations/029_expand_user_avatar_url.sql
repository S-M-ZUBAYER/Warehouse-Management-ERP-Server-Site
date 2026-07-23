-- Allow base64 profile images larger than MySQL TEXT's 64KB limit.
ALTER TABLE `users`
    MODIFY COLUMN `avatar_url` LONGTEXT NULL;

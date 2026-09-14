-- Allow custom role names to be stored on users.
-- Role permissions are still controlled by users.role_id -> roles.permissions.
ALTER TABLE `users`
    MODIFY COLUMN `role` VARCHAR(255) NOT NULL DEFAULT 'staff';

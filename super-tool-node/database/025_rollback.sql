DELETE FROM `notification_schedules` WHERE code = 'mail_health_check';
ALTER TABLE `users` DROP COLUMN `lang`;
ALTER TABLE `notification_channel_config` DROP INDEX `idx_channel_priority`, DROP COLUMN `priority`;

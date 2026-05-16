-- =====================================================
-- 025: P3.3 multi-SMTP + i18n
-- =====================================================

-- 1. channel_config 加 priority
ALTER TABLE `notification_channel_config`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 100 COMMENT '主备优先级，越小越优先' AFTER `is_default`,
  ADD INDEX `idx_channel_priority` (`channel`, `enabled`, `priority`);

-- 2. users 表加 lang
ALTER TABLE `users`
  ADD COLUMN `lang` VARCHAR(10) NOT NULL DEFAULT 'zh-CN' COMMENT '用户语言偏好' AFTER `status`;

-- 3. 现有 SMTP 设为 priority=10（主）
UPDATE `notification_channel_config`
  SET `priority` = 10
  WHERE `channel` = 'email' AND `is_default` = 1;

-- 4. 邮件健康检查 schedule
INSERT INTO `notification_schedules` (`code`,`name`,`handler`,`cron_expr`,`enabled`,`params`,`created_at`,`updated_at`) VALUES
  ('mail_health_check', '邮件 SMTP 健康检查', 'mailHealthCheck', '*/5 * * * *', 1, JSON_OBJECT(), NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- =====================================================
-- 024: P3.2 schedule system
-- =====================================================

-- 1. schedule 元数据
CREATE TABLE IF NOT EXISTS `notification_schedules` (
  `id`              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `code`            VARCHAR(100) NOT NULL UNIQUE,
  `name`            VARCHAR(200) NOT NULL,
  `handler`         VARCHAR(100) NOT NULL COMMENT '处理器 key',
  `cron_expr`       VARCHAR(100) NOT NULL,
  `enabled`         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `params`          JSON NULL COMMENT '处理器参数',
  `last_fire_at`    DATETIME NULL,
  `last_status`     ENUM('success','failed') NULL,
  `last_message`    TEXT NULL,
  `next_fire_at`    DATETIME NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 4 个内置 schedule 预置
INSERT INTO `notification_schedules` (`code`,`name`,`handler`,`cron_expr`,`enabled`,`params`,`created_at`,`updated_at`) VALUES
  ('member_expire_soon', '会员到期提醒',  'memberExpireSoon', '0 9 * * *',  1, JSON_OBJECT('days', JSON_ARRAY(7,3,1)), NOW(), NOW()),
  ('cleanup_messages',   '消息表清理',    'cleanupMessages',  '0 3 * * *',  1, JSON_OBJECT('retentionDays', 90), NOW(), NOW()),
  ('cleanup_send_logs',  '发送日志清理',  'cleanupSendLogs',  '30 3 * * *', 1, JSON_OBJECT('retentionDays', 30), NOW(), NOW()),
  ('cleanup_exports',    '导出文件清理',  'cleanupExports',   '15 * * * *', 1, JSON_OBJECT(), NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 3. 2 个新通知类型
INSERT IGNORE INTO `notification_types`
  (`code`, `name`, `category`, `default_channels`, `priority`, `quiet_hour_policy`, `status`, `user_cancelable`, `is_system`, `created_at`, `updated_at`) VALUES
  ('MEMBER_EXPIRE_SOON', '会员即将到期', 'business', '["in_app","email"]', 2, 'respect', 1, 1, 1, NOW(), NOW()),
  ('ALERT_CRITICAL',     '系统严重告警', 'system',   '["in_app","email"]', 0, 'bypass',  1, 0, 1, NOW(), NOW());

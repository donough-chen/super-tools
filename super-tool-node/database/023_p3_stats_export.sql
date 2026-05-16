-- =====================================================
-- 023: P3.1 stats + export
-- =====================================================

-- 1. 导出任务表
CREATE TABLE IF NOT EXISTS `notification_export_jobs` (
  `id`              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `name`            VARCHAR(200) NOT NULL,
  `filter`          JSON NOT NULL COMMENT '导出筛选条件 {from,to,typeId,channel,status}',
  `status`          ENUM('pending','running','completed','failed','expired') NOT NULL DEFAULT 'pending',
  `total_rows`      INT UNSIGNED NULL,
  `file_path`       VARCHAR(500) NULL,
  `file_size`       BIGINT UNSIGNED NULL,
  `recipient_email` VARCHAR(200) NULL COMMENT '完成后发送邮件的目标',
  `error_message`   TEXT NULL,
  `created_by`      BIGINT UNSIGNED NOT NULL,
  `started_at`      DATETIME NULL,
  `finished_at`     DATETIME NULL,
  `expires_at`      DATETIME NULL COMMENT '文件过期时间（默认 7 天）',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_status_expires` (`status`, `expires_at`),
  KEY `idx_creator` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. dashboard_widget 字典扩展（5 种 widget）
INSERT IGNORE INTO `dashboard_widget` (`code`, `name`, `default_w`, `default_h`, `data_source`, `required_perm`, `created_at`, `updated_at`) VALUES
  ('notif_unread_count',     '我的未读通知',       2, 1, 'notification:unread',           'notification:message:view',  NOW(), NOW()),
  ('notif_send_trend_7d',    '近 7 天发送趋势',    4, 2, 'notification:stats:trend7d',    'notification:stats:view',    NOW(), NOW()),
  ('notif_channel_dist_pie', '渠道分布',           2, 2, 'notification:stats:byChannel',  'notification:stats:view',    NOW(), NOW()),
  ('notif_top_types',        'Top 通知类型',       2, 2, 'notification:stats:byType',     'notification:stats:view',    NOW(), NOW()),
  ('notif_queue_depth',      '队列深度',           2, 1, 'notification:queue:depth',      'notification:stats:view',    NOW(), NOW());

-- 3. 权限
INSERT IGNORE INTO `admin_permissions` (`code`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  ('notification:stats:view',     '查看通知统计', 'notification', '5 类统计图表',    NOW(), NOW()),
  ('notification:export:create',  '创建导出任务', 'notification', '异步导出 xlsx', NOW(), NOW());

INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code IN ('superadmin','opsAdmin')
  AND p.code IN ('notification:stats:view','notification:export:create');

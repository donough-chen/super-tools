-- ============================================================
-- 迁移脚本: 024_add_phase2_refund_upgrade.sql
-- 版本: 2.8.0
-- 创建时间: 2026-05-23
-- 说明: 会员订阅 Phase 2 — 退款表 + 订单 scene 扩展 + 升降级前快照列
--       + 退款 RBAC 权限 + 退款成功通知模板 + alipay 支付配置
-- 前置依赖: 021_add_order_payment.sql / 022_add_order_module.sql / 023_add_payment_notification.sql
-- 字段对齐说明:
--   permissions: parent_id / type(1目录2菜单3按钮4API) / sort（不是 parent_code/level/sort_order）
--   role_permissions: role_id / permission_id（不是 role_code/permission_code）
--   notification_templates: type_id（关联 notification_types.id）/ channel='in_app'（不是 inbox）
--   system_configs: type / is_public（不是 value_type）
-- 可重复执行（IF NOT EXISTS / INSERT IGNORE / NOT EXISTS 子查询保证幂等）
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 一、退款表 member_refunds
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_refunds` (
  `id`                  BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `refund_no`           VARCHAR(32)       NOT NULL                COMMENT '退款单号 RFyyyymmddxxxxxx',
  `payment_id`          BIGINT UNSIGNED   NOT NULL                COMMENT '关联 member_payments.id',
  `order_id`            BIGINT UNSIGNED   NOT NULL                COMMENT '关联 member_orders.id',
  `user_id`             BIGINT UNSIGNED   NOT NULL,
  `provider`            VARCHAR(20)       NOT NULL                COMMENT '支付通道: mock/alipay',
  `provider_refund_no`  VARCHAR(64)       DEFAULT NULL            COMMENT '支付通道退款单号',
  `amount`              DECIMAL(10,2)     NOT NULL,
  `status`              TINYINT UNSIGNED  NOT NULL DEFAULT 0      COMMENT '0=处理中 1=成功 2=失败',
  `reason`              VARCHAR(200)      DEFAULT NULL            COMMENT '退款原因（管理员填写）',
  `failed_reason`       VARCHAR(500)      DEFAULT NULL            COMMENT '失败原因',
  `operator_id`         BIGINT UNSIGNED   NOT NULL                COMMENT '发起退款的管理员 user_id',
  `provider_response`   JSON              DEFAULT NULL            COMMENT '支付通道原始响应',
  `refunded_at`         DATETIME          DEFAULT NULL            COMMENT '退款成功时间',
  `created_at`          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no`   (`refund_no`),
  INDEX  `idx_payment`        (`payment_id`),
  INDEX  `idx_order`          (`order_id`),
  INDEX  `idx_user_status`    (`user_id`, `status`),
  INDEX  `idx_created`        (`created_at`),
  CONSTRAINT `fk_refund_payment` FOREIGN KEY (`payment_id`)
    REFERENCES `member_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_refund_order` FOREIGN KEY (`order_id`)
    REFERENCES `member_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员退款表';

-- ------------------------------------------------------------
-- 二、member_orders 扩展：scene 注释升级 + 升降级前快照列
-- ------------------------------------------------------------
ALTER TABLE `member_orders`
  MODIFY COLUMN `scene` TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT '订单场景: 1=新购 2=续费 3=升级 4=降级（0元）';

-- source_plan_code（MySQL 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 判断）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_orders' AND COLUMN_NAME = 'source_plan_code'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `member_orders` ADD COLUMN `source_plan_code` VARCHAR(30) DEFAULT NULL COMMENT ''升降级前 plan code'' AFTER `scene`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- source_remaining_value
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_orders' AND COLUMN_NAME = 'source_remaining_value'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `member_orders` ADD COLUMN `source_remaining_value` DECIMAL(10,2) DEFAULT NULL COMMENT ''升降级前剩余价值'' AFTER `source_plan_code`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 三、RBAC 权限 — 退款管理 + 开发期调度触发
-- ------------------------------------------------------------
-- 幂等清理（先删 role_permissions 关联，再删 permissions）
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.code IN ('member:refund', 'member:refund:create', 'system:dev:trigger-schedule');
DELETE FROM `permissions`
  WHERE code IN ('member:refund', 'member:refund:create', 'system:dev:trigger-schedule');

-- 二级菜单（type=2）— 退款管理（在 member 顶级菜单下）
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:refund', '退款管理', 2, 'member', 'admin',
       '/member/refunds', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t),
       140;

-- API 权限（type=4）— 发起退款
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:refund:create', '发起退款', 4, 'member', 'admin',
       '/api/admin/member/refunds', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member:refund') t),
       141;

-- API 权限（type=4）— 开发期手动触发 schedule（系统模块，顶级 parent_id=0）
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:dev:trigger-schedule', '手动触发调度任务', 4, 'system', 'admin',
       '/api/admin/system/dev/trigger-schedule', 'POST',
       2, 990;

-- 角色映射：admin / operator 拥有退款权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code IN ('admin', 'operator')
  AND p.code IN ('member:refund', 'member:refund:create');

-- 角色映射：仅 admin 可手动触发调度（开发期使用，super_admin 默认拥有全部权限不需要显式授权）
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code = 'system:dev:trigger-schedule';

-- ------------------------------------------------------------
-- 四、通知模板 — 退款成功（站内信）
-- 注意：notification_types.uk_code = (code, deleted_at)，NULL 视为不同，INSERT IGNORE 不阻止重复
--       使用 WHERE NOT EXISTS 实现真正幂等
-- ------------------------------------------------------------
INSERT INTO `notification_types`
  (`code`, `name`, `description`, `category`, `default_channels`, `user_cancelable`, `priority`,
   `quiet_hour_policy`, `icon`, `color`, `is_system`, `sort_order`)
SELECT 'BUSINESS_PAYMENT_REFUNDED', '退款成功', '订单退款成功通知',
       'business', '["in_app"]', 1, 1, 'respect', 'rollback', '#1890ff', 1, 32
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `notification_types`
  WHERE code = 'BUSINESS_PAYMENT_REFUNDED' AND deleted_at IS NULL
);

INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`,
   `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_PAYMENT_REFUNDED_INAPP', '退款成功-站内信', 'in_app',
       '订单 {{orderNo}} 退款成功',
       '您的订单 {{orderNo}}（{{planName}} ¥{{amount}}）已退款成功，资金 1-3 个工作日原路返还。如有疑问请联系客服。',
       1, 1, 0, 'Phase2 种子模板: 退款成功 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_PAYMENT_REFUNDED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_PAYMENT_REFUNDED_INAPP' AND channel = 'in_app'
  );

-- ------------------------------------------------------------
-- 五、system_configs — alipay 支付配置（密钥不在此处，走 .env.local）
-- ------------------------------------------------------------
INSERT IGNORE INTO `system_configs`
  (`group`, `key`, `value`, `type`, `is_secret`, `is_public`, `description`)
VALUES
  ('payment', 'alipay_app_id',     '',                                            'string', 0, 0, 'Alipay 沙箱 AppId（公开配置）'),
  ('payment', 'alipay_gateway',    'https://openapi.alipaydev.com/gateway.do',    'string', 0, 0, 'Alipay 网关 URL（沙箱默认）'),
  ('payment', 'alipay_sign_type',  'RSA2',                                        'string', 0, 0, '签名算法 RSA2 / RSA'),
  ('payment', 'alipay_notify_url', '',                                            'string', 0, 0, '异步通知回调 URL（公网；空表示仅靠主动 query）'),
  ('payment', 'alipay_return_url', '',                                            'string', 0, 0, '同步返回 URL');

-- enabled_providers 升级（覆盖 phase1 的 ["mock"]）
UPDATE `system_configs`
SET `value` = '["mock","alipay"]'
WHERE `group` = 'payment' AND `key` = 'enabled_providers' AND `value` = '["mock"]';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 验证 SQL（手动执行）
-- ============================================================
-- DESC member_refunds;
-- SHOW COLUMNS FROM member_orders LIKE 'source_%';
-- SELECT code, name, type FROM permissions WHERE code IN ('member:refund', 'member:refund:create', 'system:dev:trigger-schedule');
-- SELECT r.code, p.code FROM role_permissions rp
--   INNER JOIN roles r ON rp.role_id = r.id
--   INNER JOIN permissions p ON rp.permission_id = p.id
--   WHERE p.code IN ('member:refund', 'member:refund:create', 'system:dev:trigger-schedule');
-- SELECT * FROM notification_types WHERE code = 'BUSINESS_PAYMENT_REFUNDED';
-- SELECT code, channel FROM notification_templates WHERE code = 'BUSINESS_PAYMENT_REFUNDED_INAPP';
-- SELECT `key`, `value` FROM system_configs WHERE `group` = 'payment' AND `key` LIKE 'alipay%' OR `key` = 'enabled_providers';

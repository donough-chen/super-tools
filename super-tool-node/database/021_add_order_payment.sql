-- ============================================================
-- 迁移脚本: 021_add_order_payment.sql
-- 版本: 2.7.0
-- 创建时间: 2026-05-23
-- 说明: 会员套餐订阅支付 —— 订单表 + 支付流水表
-- 设计文档: docs/superpowers/specs/2026-05-23-会员套餐订阅与支付MVP设计文档.md
-- 前置依赖: 003_add_member_system.sql
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. 会员订单表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_orders` (
  `id`              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `order_no`        VARCHAR(32)       NOT NULL COMMENT '订单号（业务流水号，对外展示）',
  `user_id`         BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  `plan_id`         INT UNSIGNED      NOT NULL COMMENT '套餐ID（快照）',
  `plan_code`       VARCHAR(30)       NOT NULL COMMENT '套餐编码（快照）',
  `plan_snapshot`   JSON              NOT NULL COMMENT '下单时套餐完整快照',
  `amount`          DECIMAL(10,2)     NOT NULL COMMENT '应付金额',
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '0待支付/1已支付/2已取消/3已过期/4已退款',
  `scene`           TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '场景:1新购/2续费',
  `paid_at`         DATETIME          DEFAULT NULL COMMENT '支付完成时间',
  `cancelled_at`    DATETIME          DEFAULT NULL COMMENT '取消时间',
  `expire_at`       DATETIME          NOT NULL COMMENT '订单过期时间',
  `remark`          VARCHAR(200)      DEFAULT NULL,
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no`     (`order_no`),
  INDEX `idx_user_id`          (`user_id`),
  INDEX `idx_status`           (`status`),
  INDEX `idx_user_status`      (`user_id`, `status`),
  INDEX `idx_expire_status`    (`expire_at`, `status`),
  INDEX `idx_created_at`       (`created_at`),
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员订单表';

-- ------------------------------------------------------------
-- 2. 支付流水表（1 订单 N 流水）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_payments` (
  `id`                  BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `payment_no`          VARCHAR(32)       NOT NULL COMMENT '支付流水号（内部）',
  `order_id`            BIGINT UNSIGNED   NOT NULL,
  `user_id`             BIGINT UNSIGNED   NOT NULL,
  `provider`            VARCHAR(20)       NOT NULL COMMENT 'mock/wechat_jsapi/wechat_native/alipay',
  `provider_trade_no`   VARCHAR(64)       DEFAULT NULL COMMENT '第三方流水号',
  `amount`              DECIMAL(10,2)     NOT NULL,
  `status`              TINYINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '0pending/1success/2failed/3refunded',
  `prepay_data`         JSON              DEFAULT NULL COMMENT '预支付参数',
  `callback_payload`    JSON              DEFAULT NULL COMMENT '回调原始内容',
  `paid_at`             DATETIME          DEFAULT NULL,
  `failed_reason`       VARCHAR(500)      DEFAULT NULL,
  `created_at`          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_no` (`payment_no`),
  INDEX `idx_order_id`       (`order_id`),
  INDEX `idx_user_id`        (`user_id`),
  INDEX `idx_status`         (`status`),
  INDEX `idx_provider_trade` (`provider`, `provider_trade_no`),
  CONSTRAINT `fk_payment_order` FOREIGN KEY (`order_id`)
    REFERENCES `member_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员支付流水表';

-- 系统配置
INSERT IGNORE INTO `system_configs` (`group`, `key`, `value`, `type`, `is_secret`, `is_public`, `description`) VALUES
('payment', 'order_expire_minutes',  '30',       'number',  0, 1, '订单超时未支付的过期时长（分钟）'),
('payment', 'mock_auto_success',     'false',    'boolean', 0, 0, '开发期：用户停留收银台 30s 后自动模拟支付成功'),
('payment', 'mock_auto_delay_sec',   '30',       'number',  0, 0, 'mock_auto_success 的延时秒数'),
('payment', 'enabled_providers',     '["mock"]', 'json',    0, 1, '当前启用的支付方式');

SET FOREIGN_KEY_CHECKS = 1;

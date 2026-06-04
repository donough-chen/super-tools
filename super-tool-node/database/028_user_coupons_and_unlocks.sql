-- ============================================================================
-- 028 · user_coupons + user_tool_unlocks
--
-- 目的：让积分商城兑换的 coupon / tool_unlock 真正可核验、可使用
--
-- 前置依赖：025_points_growth_system_full.sql（points_mall_orders 已存在）
-- 幂等：CREATE TABLE IF NOT EXISTS
-- ============================================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- #1: user_coupons 用户券包表
CREATE TABLE IF NOT EXISTS `user_coupons` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `order_id`     BIGINT UNSIGNED NOT NULL COMMENT '关联兑换订单ID (points_mall_orders.id)',
  `coupon_code`  VARCHAR(50)      NOT NULL COMMENT '券唯一码（如 CPxxx）',
  `coupon_type`  ENUM('fixed','percent') NOT NULL COMMENT 'fixed=满减金额, percent=折扣率(0.9=9折)',
  `discount`     DECIMAL(10,2)    NOT NULL COMMENT 'fixed:减免金额; percent:折扣率',
  `threshold`    DECIMAL(10,2)    DEFAULT 0 COMMENT '满减门槛金额（0=无门槛）',
  `status`       ENUM('unused','used','expired') NOT NULL DEFAULT 'unused',
  `used_at`      DATETIME         DEFAULT NULL COMMENT '使用时间',
  `expire_at`    DATETIME         NOT NULL COMMENT '过期时间',
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupon_code` (`coupon_code`),
  INDEX `idx_user_status` (`user_id`, `status`, `expire_at`),
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户券包';

-- #2: user_tool_unlocks 用户工具解锁表
CREATE TABLE IF NOT EXISTS `user_tool_unlocks` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `order_id`      BIGINT UNSIGNED NOT NULL COMMENT '关联兑换订单ID (points_mall_orders.id)',
  `tool_code`     VARCHAR(50)      NOT NULL COMMENT '工具 code (tools.code)',
  `unlock_days`   INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '解锁天数',
  `unlocked_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expire_at`     DATETIME         NOT NULL COMMENT '解锁过期时间',
  `status`         ENUM('active','expired') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_tool_order` (`user_id`, `tool_code`, `order_id`),
  INDEX `idx_user_status` (`user_id`, `status`, `expire_at`),
  INDEX `idx_tool_code` (`tool_code`),
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户工具解锁记录';

SET FOREIGN_KEY_CHECKS = 1;

-- 验证
SELECT 'user_coupons_created'    AS check_item, COUNT(*) AS cnt FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'user_coupons';
SELECT 'user_tool_unlocks_created' AS check_item, COUNT(*) AS cnt FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'user_tool_unlocks';

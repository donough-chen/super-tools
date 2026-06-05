-- ============================================================================
-- 迁移脚本: 029_add_coupon_scenes_and_payment_coupon.sql
-- 版本: 2.9.0
-- 创建时间: 2026-06-05
-- 说明: 优惠券场景字段 + 支付关联优惠券
--       1. points_mall_items 增加 applicable_scenes JSON 字段
--       2. user_coupons 增加 applicable_scenes JSON 字段（从商品配置继承）
--       3. user_coupons 增加 locked_payment_id 字段（防止并发使用）
--       4. member_payments 增加 coupon_id 字段（关联使用的优惠券）
--       5. member_payments 增加 coupon_discount_amount 字段
-- 前置依赖: 028_user_coupons_and_unlocks.sql / 021_add_order_payment.sql
-- 可重复执行（使用 information_schema 判断列是否存在）
-- ============================================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. points_mall_items 增加 applicable_scenes 字段
--    适用场景：points_mall（积分商城兑换）、member_subscription（会员订阅支付）
-- ------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'points_mall_items' AND COLUMN_NAME = 'applicable_scenes'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `points_mall_items` ADD COLUMN `applicable_scenes` JSON DEFAULT NULL COMMENT \'适用场景: [\"points_mall\",\"member_subscription\"]\' AFTER `fulfill_config`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. user_coupons 增加 applicable_scenes 字段（从商品配置继承）
-- ------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_coupons' AND COLUMN_NAME = 'applicable_scenes'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `user_coupons` ADD COLUMN `applicable_scenes` JSON DEFAULT NULL COMMENT \'适用场景（从 points_mall_items.applicable_scenes 继承）\' AFTER `threshold`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3. user_coupons 增加 locked_payment_id 字段（防止并发使用）
-- ------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_coupons' AND COLUMN_NAME = 'locked_payment_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `user_coupons` ADD COLUMN `locked_payment_id` BIGINT UNSIGNED DEFAULT NULL COMMENT \'锁定中的支付单ID（防止并发使用）\' AFTER `applicable_scenes`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 为 locked_payment_id 添加索引（用于解锁查询）
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_coupons' AND INDEX_NAME = 'idx_locked_payment'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE `user_coupons` ADD INDEX `idx_locked_payment` (`locked_payment_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 4. member_payments 增加 coupon_id 字段（关联使用的优惠券）
-- ------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_payments' AND COLUMN_NAME = 'coupon_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `member_payments` ADD COLUMN `coupon_id` BIGINT UNSIGNED DEFAULT NULL COMMENT \'使用的优惠券ID（关联 user_coupons.id）\' AFTER `failed_reason`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 5. member_payments 增加 coupon_discount_amount 字段
-- ------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_payments' AND COLUMN_NAME = 'coupon_discount_amount'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `member_payments` ADD COLUMN `coupon_discount_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT \'优惠券折扣金额\' AFTER `coupon_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 验证 SQL（手动执行）
-- ============================================================================
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'points_mall_items' AND COLUMN_NAME = 'applicable_scenes';
--
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_coupons' AND COLUMN_NAME IN ('applicable_scenes', 'locked_payment_id');
--
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_payments' AND COLUMN_NAME IN ('coupon_id', 'coupon_discount_amount');
--
-- SHOW INDEX FROM `user_coupons` WHERE Column_name = 'locked_payment_id';

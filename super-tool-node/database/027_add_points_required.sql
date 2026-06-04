-- 027 · 积分商城添加 points_required 列
-- 使用现有 member_levels.benefits.discount 字段（无需新增）

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- #1: points_mall_items 添加 points_required 列
ALTER TABLE `points_mall_items`
  ADD COLUMN `points_required` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商品原价积分' AFTER `cost_points`;

-- #2: 将现有商品的 points_required 设置为 cost_points 的值
UPDATE `points_mall_items` SET `points_required` = `cost_points`;

SET FOREIGN_KEY_CHECKS = 1;

-- 验证
SELECT COUNT(*) AS points_required_non_zero FROM `points_mall_items` WHERE `points_required` > 0;
SELECT `code`, JSON_EXTRACT(`benefits`, '$.discount') AS discount FROM `member_levels`;

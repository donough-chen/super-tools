-- ============================================================
-- 回滚脚本: 025_rollback.sql
-- 用途: 应急回滚 025_add_points_growth_system.sql
-- 警告: 数据将丢失！仅在迁移失败需要重做时手工执行！
-- ============================================================

USE `superadmin_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. DROP 新建表（顺序：先删被依赖的，再删独立的）
DROP TABLE IF EXISTS `points_daily_snapshots`;
DROP TABLE IF EXISTS `points_expiry_notices`;
DROP TABLE IF EXISTS `points_expiry_logs`;
DROP TABLE IF EXISTS `daily_points_caps`;
DROP TABLE IF EXISTS `points_mall_orders`;
DROP TABLE IF EXISTS `points_mall_items`;
DROP TABLE IF EXISTS `user_signs`;
DROP TABLE IF EXISTS `task_completion_logs`;
DROP TABLE IF EXISTS `user_tasks`;
DROP TABLE IF EXISTS `tasks`;

-- 2. ALTER 移除 points_logs 上新增的字段与索引
ALTER TABLE `points_logs`
  DROP INDEX `idx_user_status_expire`,
  DROP INDEX `idx_status_expire`,
  DROP COLUMN `growth_multiplier`,
  DROP COLUMN `source_event`,
  DROP COLUMN `source_level_id`,
  DROP COLUMN `status`,
  DROP COLUMN `points_remaining`;

-- 3. ALTER 移除 user_members 签到字段
ALTER TABLE `user_members`
  DROP COLUMN `total_sign_days`,
  DROP COLUMN `last_sign_date`,
  DROP COLUMN `sign_streak`;

-- 4. 删除种子数据（权限码 / 通知类型 / 系统配置）
DELETE FROM `role_permissions`
  WHERE `permission_id` IN (SELECT id FROM `permissions` WHERE `module`='points');
DELETE FROM `permissions` WHERE `module` = 'points';
DELETE FROM `notification_types` WHERE `code` IN (
  'BUSINESS_POINTS_EARNED','BUSINESS_POINTS_EXPIRE_REMIND','BUSINESS_POINTS_EXPIRED',
  'BUSINESS_TASK_COMPLETED','BUSINESS_LEVEL_UP','BUSINESS_MALL_FULFILLED'
);
DELETE FROM `system_configs` WHERE `group` = 'points';

-- 5. 还原 register_gift_growth = 10（由 025 改成了 0）
UPDATE `system_configs` SET `value` = '10'
  WHERE `group` = 'member' AND `key` = 'register_gift_growth';

-- 6. 提示：member_levels.benefits 中由 025 写入的扩展键（points_multiplier 等）
--    无法精准撤回（业务无需撤回）。如需清理可手工 JSON_REMOVE。

SET FOREIGN_KEY_CHECKS = 1;

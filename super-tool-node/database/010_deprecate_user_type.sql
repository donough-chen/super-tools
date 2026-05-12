-- ============================================================
-- 迁移脚本: 010_deprecate_user_type.sql
-- 版本: 2.6.0
-- 创建时间: 2026-05-12
-- 说明: 废弃 user_type 字段
--   1) user_type 字段不再用于权限判断，改由 user_roles + roles 表 RBAC 统一管理
--   2) 用户来源平台由已有的 register_source 字段承担（对应 oauth_clients.platform）
--   3) user_type 字段保留不删，仅更新 COMMENT 标记为废弃
--   4) 无需数据迁移（register_source 已在注册时正确设置）
-- 设计文档: docs/superpowers/specs/2026-05-12-user-type-refactor-design.md
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;

-- 1. 更新 user_type 字段注释，标记为废弃
ALTER TABLE `users`
  MODIFY COLUMN `user_type` TINYINT UNSIGNED NOT NULL DEFAULT 1
  COMMENT '@deprecated 已废弃-权限请查user_roles表。历史含义:1普通用户,2管理员,3超级管理员';

-- 2. 确保初始化的 admin 用户在 user_roles 表中有 super_admin 角色绑定
-- （幂等操作：若已存在则忽略）
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM `users` u CROSS JOIN `roles` r
WHERE u.username = 'admin' AND r.code = 'super_admin'
  AND u.deleted_at IS NULL;

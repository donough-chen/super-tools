-- ============================================================
-- 迁移脚本: 026_fix_points_permissions_type.sql
-- 版本: 2.3.1
-- 创建时间: 2026-05-27
-- 说明: 修正 025 中 points:* 权限码 type 字段值
--
-- 问题描述：
--   025_add_points_growth_system.sql 在 INSERT permissions 时 type 列写成了字符串 'api'，
--   但 permissions.type 字段定义为 TINYINT UNSIGNED（1=目录, 2=菜单, 3=按钮, 4=API），
--   MySQL 在非严格模式下将字符串 'api' 隐式转换为 0，导致 11 条权限码的 type=0。
--   虽不影响权限校验（按 code 字符串匹配），但会影响管理端"权限树/权限模块"的按 type 过滤展示。
--
-- 修复内容：
--   1. UPDATE 当前 DB 中 module='points' 的 11 条记录，将 type 改为 4 (API)
--   2. 同步修复 025 源文件（见 025_add_points_growth_system.sql 末尾权限码 INSERT 段）
--      —— 修复后新环境从头执行 025 即得到正确值，无需再叠加 026
--
-- 兼容性：
--   - 幂等：重复执行无副作用（type 已是 4 时 UPDATE 不变更）
--   - 无需回滚（type 字段无业务依赖该错值）
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;

-- 修复 11 条 points:* 权限码的 type 字段（0 → 4 即 API）
UPDATE `permissions`
SET `type` = 4
WHERE `module` = 'points'
  AND `code` IN (
    'points:task:list',
    'points:task:create',
    'points:task:update',
    'points:task:delete',
    'points:mall:list',
    'points:mall:manage',
    'points:mall:orders',
    'points:mall:refund',
    'points:expire:stats',
    'points:reconcile:view',
    'points:ops:trigger'
  )
  AND `type` <> 4;

-- 验证（仅打印，不影响事务）
-- SELECT id, code, type FROM permissions WHERE module='points' ORDER BY sort;

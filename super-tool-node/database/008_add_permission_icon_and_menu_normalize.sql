-- 008_add_permission_icon_and_menu_normalize.sql
-- 版本: 2.7.0  | 创建时间: 2026-05-11
-- 说明: Spec-B 支撑 - icon 字段 + 单页模块菜单结构规范化
-- 前置: 006_add_rbac_init.sql、007_add_member_module.sql

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 一、幂等清理（仅清理 *:menu）
-- DELETE rp FROM `role_permissions` rp
--   INNER JOIN `permissions` p ON rp.permission_id = p.id
--   WHERE p.code LIKE '%:menu';
-- DELETE FROM `permissions` WHERE code LIKE '%:menu';

-- 二、新增 icon 字段（如已存在请删除该 ALTER）
ALTER TABLE `permissions`
  ADD COLUMN `icon` VARCHAR(60) NULL DEFAULT NULL
  COMMENT '菜单图标（AntD Icon 名称）' AFTER `module`;

-- 三、单页模块顶级菜单升级为目录（type=2 → type=1）
UPDATE `permissions` SET `type` = 1
  WHERE code IN ('user','category','tool','feedback','stats','member');

-- 四、新增 6 条 *:menu 二级菜单
INSERT INTO `permissions` (`code`,`name`,`type`,`module`,`icon`,`platform`,`path`,`method`,`parent_id`,`sort`)
SELECT 'user:menu',     '用户列表', 2, 'user',     NULL, 'admin', '/user/list',      NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='user') t),     10
UNION ALL SELECT 'category:menu', '分类列表', 2, 'category', NULL, 'admin', '/category/list',  NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='category') t), 10
UNION ALL SELECT 'tool:menu',     '工具列表', 2, 'tool',     NULL, 'admin', '/tool/list',      NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='tool') t),     10
UNION ALL SELECT 'feedback:menu', '反馈列表', 2, 'feedback', NULL, 'admin', '/feedback/list',  NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='feedback') t), 10
UNION ALL SELECT 'stats:menu',    '数据总览', 2, 'stats',    NULL, 'admin', '/stats/overview', NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='stats') t),    10
UNION ALL SELECT 'member:menu',   '会员用户', 2, 'member',   NULL, 'admin', '/member/list',    NULL, (SELECT id FROM (SELECT id FROM permissions WHERE code='member') t),   10;

-- 五、回填 8 大顶级图标
UPDATE `permissions` SET `icon` = 'DashboardOutlined' WHERE code='dashboard';
UPDATE `permissions` SET `icon` = 'UserOutlined'      WHERE code='user';
UPDATE `permissions` SET `icon` = 'TagsOutlined'      WHERE code='category';
UPDATE `permissions` SET `icon` = 'AppstoreOutlined'  WHERE code='tool';
UPDATE `permissions` SET `icon` = 'MessageOutlined'   WHERE code='feedback';
UPDATE `permissions` SET `icon` = 'BarChartOutlined'  WHERE code='stats';
UPDATE `permissions` SET `icon` = 'SettingOutlined'   WHERE code='system';
UPDATE `permissions` SET `icon` = 'CrownOutlined'     WHERE code='member';

-- 六、admin/operator/auditor 补齐 *:menu 权限映射
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code IN ('admin','operator','auditor')
  AND p.code IN ('user:menu','category:menu','tool:menu','feedback:menu','stats:menu','member:menu');

SET FOREIGN_KEY_CHECKS = 1;

-- 七、校验（手动）
-- SELECT COUNT(*) FROM permissions WHERE code LIKE '%:menu';                 -- 期望 6
-- SELECT code,type FROM permissions WHERE code IN ('user','category','tool','feedback','stats','member');  -- 全部 type=1
-- SELECT r.code,COUNT(*) FROM role_permissions rp JOIN roles r ON rp.role_id=r.id JOIN permissions p ON rp.permission_id=p.id WHERE p.code LIKE '%:menu' GROUP BY r.code; -- admin=6 operator=6 auditor=6

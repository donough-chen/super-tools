-- 011_add_permission_manage_codes.sql
-- 版本: 2.10.0  | 创建时间: 2026-05-12
-- 说明: 为权限管理页面的写操作分配独立权限码（替换之前复用 system:permission:list 的占位方案）
-- 前置: 006_add_rbac_init.sql、008_add_permission_icon_and_menu_normalize.sql

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 一、幂等清理
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.code IN ('system:permission:create','system:permission:update','system:permission:delete','system:permission:holders','system:permission:batch-assign');
DELETE FROM `permissions`
  WHERE code IN ('system:permission:create','system:permission:update','system:permission:delete','system:permission:holders','system:permission:batch-assign');

-- 二、新增 5 条权限码（挂在 system:permission 下）
INSERT INTO `permissions` (`code`,`name`,`type`,`module`,`platform`,`path`,`method`,`parent_id`,`sort`)
SELECT 'system:permission:create','新建权限',4,'system','admin','/api/admin/permissions','POST',
  (SELECT id FROM (SELECT id FROM permissions WHERE code='system:permission') t), 40
UNION ALL
SELECT 'system:permission:update','编辑权限',4,'system','admin','/api/admin/permissions/:id','PUT',
  (SELECT id FROM (SELECT id FROM permissions WHERE code='system:permission') t), 50
UNION ALL
SELECT 'system:permission:delete','删除权限',4,'system','admin','/api/admin/permissions/:id','DELETE',
  (SELECT id FROM (SELECT id FROM permissions WHERE code='system:permission') t), 60
UNION ALL
SELECT 'system:permission:holders','查看权限持有角色',4,'system','admin','/api/admin/permissions/:id/holders','GET',
  (SELECT id FROM (SELECT id FROM permissions WHERE code='system:permission') t), 70
UNION ALL
SELECT 'system:permission:batch-assign','批量赋权到角色',4,'system','admin','/api/admin/permissions/:id/batch-assign','PUT',
  (SELECT id FROM (SELECT id FROM permissions WHERE code='system:permission') t), 80;

-- 三、给 admin 角色绑定 holders（写操作仅 super_admin 使用，admin 可查看持有者）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code IN ('system:permission:holders');

-- 四、给 auditor 角色绑定 holders（只读）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.code IN ('system:permission:holders');

SET FOREIGN_KEY_CHECKS = 1;

-- 五、校验（手动）
-- SELECT code FROM permissions WHERE code LIKE 'system:permission:%' ORDER BY sort;
-- 期望: list, tree, view, create, update, delete, holders, batch-assign

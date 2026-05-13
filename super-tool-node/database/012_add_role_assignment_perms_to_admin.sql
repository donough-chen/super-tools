-- 012_add_role_assignment_perms_to_admin.sql
-- 版本: 2.11.0  | 创建时间: 2026-05-13
-- 说明: 给 admin 角色绑定用户角色分配相关权限码
--   - user:assign-roles（为用户分配角色）
--   - system:role:assign-users（为角色分配用户）
-- 前置: 006_add_rbac_init.sql（权限码已定义）

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 幂等清理
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  INNER JOIN `roles` r ON rp.role_id = r.id
  WHERE r.code = 'admin'
    AND p.code IN ('user:assign-roles', 'system:role:assign-users');

-- 给 admin 角色绑定
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code IN ('user:assign-roles', 'system:role:assign-users');

SET FOREIGN_KEY_CHECKS = 1;

-- 校验（手动执行）
-- SELECT p.code FROM roles r
--   INNER JOIN role_permissions rp ON rp.role_id = r.id
--   INNER JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.code = 'admin' AND p.code LIKE '%assign%';
-- 期望: user:assign-roles, system:role:assign-users, system:role:assign-permissions

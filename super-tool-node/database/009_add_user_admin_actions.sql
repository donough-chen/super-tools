-- ============================================================
-- 009 Spec-C2a 管理端用户行为权限补全
-- ============================================================
-- 依赖：006_add_rbac_init.sql 已建表 + 已建 user 顶级菜单
-- 新增：user:device:list / user:address:list 两条 type=4 权限
-- 影响：super_admin 自动具备
-- 回滚：见末尾
-- ============================================================

-- 1. 新增权限（type=4 API 级，幂等 INSERT）
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'user:device:list', '查看用户设备列表', 4, 'user', 'admin',
       '/api/admin/users/:id/devices', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 110
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'user:device:list')
UNION ALL
SELECT 'user:address:list', '查看用户地址列表', 4, 'user', 'admin',
       '/api/admin/users/:id/addresses', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 120
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'user:address:list');

-- 2. 关联 super_admin（确保超管自动具备新权限，幂等）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT
  (SELECT id FROM `roles` WHERE code = 'super_admin'),
  p.id
FROM `permissions` p
WHERE p.code IN ('user:device:list', 'user:address:list')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = (SELECT id FROM `roles` WHERE code = 'super_admin')
      AND rp.permission_id = p.id
  );

-- 3. 校验
SELECT '新增权限' AS step, code, name, path, method
FROM `permissions`
WHERE code IN ('user:device:list', 'user:address:list');

SELECT 'super_admin 关联' AS step, COUNT(*) AS cnt
FROM `role_permissions` rp
JOIN `permissions` p ON p.id = rp.permission_id
WHERE rp.role_id = (SELECT id FROM `roles` WHERE code = 'super_admin')
  AND p.code IN ('user:device:list', 'user:address:list');
-- 预期 cnt=2

-- ============================================================
-- 回滚 SQL（如需撤销）
-- ============================================================
-- DELETE FROM `role_permissions`
-- WHERE permission_id IN (
--   SELECT id FROM `permissions` WHERE code IN ('user:device:list', 'user:address:list')
-- );
-- DELETE FROM `permissions` WHERE code IN ('user:device:list', 'user:address:list');

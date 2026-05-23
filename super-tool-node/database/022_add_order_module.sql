-- ============================================================
-- 迁移脚本: 022_add_order_module.sql
-- 版本: 2.7.1
-- 创建时间: 2026-05-23
-- 说明: 订单模块 RBAC 权限码（管理端只读）
-- 角色映射：admin / operator / auditor 三个都赋全 3 条（只读权限可全开）
-- 前置依赖: 007_add_member_module.sql
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 幂等清理
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.code IN ('member:order:list', 'member:order:detail', 'member:order:stats');
DELETE FROM `permissions` WHERE code IN ('member:order:list', 'member:order:detail', 'member:order:stats');

-- 新增二级菜单（type=2）— 1 个页面入口
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:orders', '订单列表', 2, 'member', NULL, 'admin', '/member/orders', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 100;

-- 在 member 顶级菜单下增加（type=4） 3 个 API 权限
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:order:list', '会员订单列表', 4, 'member', 'admin',
       '/api/admin/member/orders', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member:orders') t), 110
UNION ALL
SELECT 'member:order:detail', '订单详情', 4, 'member', 'admin',
       '/api/admin/member/orders/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member:orders') t), 120
UNION ALL
SELECT 'member:order:stats', '订单统计', 4, 'member', 'admin',
       '/api/admin/member/orders/stats', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member:orders') t), 130;

-- 三个角色都授权（只读权限可全开）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code IN ('admin', 'operator', 'auditor')
  AND p.code IN ('member:orders', 'member:order:list', 'member:order:detail', 'member:order:stats');

SET FOREIGN_KEY_CHECKS = 1;

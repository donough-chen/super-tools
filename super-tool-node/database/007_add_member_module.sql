-- ============================================================
-- 迁移脚本: 007_add_member_module.sql
-- 版本: 2.6.0
-- 创建时间: 2026-05-09
-- 说明: RBAC 体系扩展 —— 新增 member 模块（会员管理）
--   1) 新增 11 条权限码（1 个顶级菜单 + 10 个 API）
--   2) 写入 admin / operator / auditor 三个角色的权限映射
--      - admin: 全部 11 条
--      - operator: 6 条（顶级菜单 + 5 条只读：等级/套餐/用户/统计/积分日志）
--      - auditor: 6 条（同 operator，只读 + 积分日志审计）
--   3) 不涉及 schema 变更（permissions 表已在 006 添加 module 字段）
--   4) 幂等：脚本顶部清理 module='member' 的所有权限及关联，可重复执行
-- 前置依赖: 006_add_rbac_init.sql
-- 设计文档: docs/architecture/RBAC.md § member 模块
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- 一、幂等清理（仅清理 member 模块，不动其他模块）
-- ============================================================

-- 1.1 删除 member 模块所有权限的角色关联（避免孤儿映射）
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'member';

-- 1.2 删除 member 模块所有权限
DELETE FROM `permissions` WHERE module = 'member';


-- ============================================================
-- 二、初始化 member 模块权限（共 11 条）
-- ============================================================

-- 2.1 顶级菜单：member（会员管理）
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
VALUES
  ('member', '会员管理', 2, 'member', 'admin', '/member', NULL, 0, 35);

-- 2.2 member 模块 API（10 条）
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:level:list', '会员等级列表', 4, 'member', 'admin',
       '/api/admin/member/levels', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 10
UNION ALL
SELECT 'member:level:update', '编辑会员等级', 4, 'member', 'admin',
       '/api/admin/member/levels/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 20
UNION ALL
SELECT 'member:plan:list', '会员套餐列表', 4, 'member', 'admin',
       '/api/admin/member/plans', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 30
UNION ALL
SELECT 'member:plan:update', '编辑会员套餐', 4, 'member', 'admin',
       '/api/admin/member/plans/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 40
UNION ALL
SELECT 'member:user:list', '会员用户列表/详情', 4, 'member', 'admin',
       '/api/admin/member/users', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 50
UNION ALL
SELECT 'member:points:adjust', '手动调整积分', 4, 'member', 'admin',
       '/api/admin/member/users/:id/adjust-points', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 60
UNION ALL
SELECT 'member:level:assign', '手动调整等级', 4, 'member', 'admin',
       '/api/admin/member/users/:id/level', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 70
UNION ALL
SELECT 'member:plan:activate', '手动开通会员', 4, 'member', 'admin',
       '/api/admin/member/users/:id/activate-plan', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 80
UNION ALL
SELECT 'member:stats:view', '会员统计', 4, 'member', 'admin',
       '/api/admin/member/stats', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 90
UNION ALL
SELECT 'member:points:log:view', '积分流水审计', 4, 'member', 'admin',
       '/api/admin/member/points-logs', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 100;


-- ============================================================
-- 三、角色 × 权限 映射
--   - admin: 全部 11 条
--   - operator: 6 条只读（含顶级 + 5 条 list/view）；不含调积分/调级/开通会员等高敏写操作
--   - auditor: 6 条（同 operator；侧重积分日志审计）
-- ============================================================

-- 3.1 admin: 11 条
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code IN (
    'member',
    'member:level:list', 'member:level:update',
    'member:plan:list', 'member:plan:update',
    'member:user:list',
    'member:points:adjust', 'member:level:assign', 'member:plan:activate',
    'member:stats:view', 'member:points:log:view'
  );

-- 3.2 operator: 6 条（只读）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.code IN (
    'member',
    'member:level:list',
    'member:plan:list',
    'member:user:list',
    'member:stats:view',
    'member:points:log:view'
  );

-- 3.3 auditor: 6 条（只读 + 审计积分流水）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.code IN (
    'member',
    'member:level:list',
    'member:plan:list',
    'member:user:list',
    'member:stats:view',
    'member:points:log:view'
  );


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 四、数据校验（可手动执行）
-- ============================================================
-- 检查 member 模块权限数（应为 11）
-- SELECT COUNT(*) FROM `permissions` WHERE module = 'member';
--
-- 检查 member 模块每个角色的权限数
-- SELECT r.code, COUNT(rp.permission_id) AS cnt FROM `roles` r
--   INNER JOIN `role_permissions` rp ON rp.role_id = r.id
--   INNER JOIN `permissions` p ON p.id = rp.permission_id
--   WHERE p.module = 'member' AND r.type = 1
--   GROUP BY r.id, r.code ORDER BY cnt DESC;
-- 期望：admin=11  operator=6  auditor=6
--
-- 检查 admin 角色 member 权限码列表
-- SELECT p.code FROM `roles` r
--   INNER JOIN `role_permissions` rp ON rp.role_id = r.id
--   INNER JOIN `permissions` p ON p.id = rp.permission_id
--   WHERE r.code = 'admin' AND p.module = 'member' ORDER BY p.sort, p.id;

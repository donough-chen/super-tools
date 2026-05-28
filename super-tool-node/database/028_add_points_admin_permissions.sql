-- ============================================================
-- 028 · 积分管理模块（管理端）RBAC 权限补全
--
-- 设计依据: docs/superpowers/plans/2026-05-28-积分管理模块管理端实施计划.md §Task 1
-- 范式参考: 018_add_notification_system.sql §权限块
--
-- 注意：
--   1. 025 §7 已写入 11 条 type=4 API 权限（points:task / points:mall / points:expire /
--      points:reconcile / points:ops），本迁移不再重复，仅补：
--        - 1  顶级目录（type=1）
--        - 10 二级菜单（type=2）
--        - 11 按钮权限（type=3）
--        - 1  兜底 API（type=4，points:cache:clear）
--   2. 幂等：依赖 permissions.uk_code + INSERT IGNORE / 显式幂等清理保护
--   3. super_admin（role_id=1）中间件已短路 RBAC，仍补一次默认全量映射，便于
--      role_permissions 表在数据层直观可读
--   4. 不写 admin / operator / auditor 角色映射 —— 业务端按需通过角色管理界面授权
-- ============================================================

START TRANSACTION;

-- ===== §1. 幂等清理 — 仅清本脚本管理的菜单/按钮，不动 025 已落的 API =====
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'points' AND p.type IN (1, 2, 3);
DELETE FROM `permissions` WHERE module = 'points' AND type IN (1, 2, 3);

-- ===== §2. 顶级目录（type=1）=====
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `parent_id`, `sort`, `status`)
VALUES
  ('points', '积分管理', 1, 'points', 'GiftOutlined', 'admin', '/points', 0, 85, 1);

-- ===== §3. 二级菜单（type=2）— 10 条 =====
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `parent_id`, `sort`, `status`)
SELECT 'points:menu:dashboard', '积分概览', 2, 'points', 'admin', '/points/dashboard',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 10, 1
UNION ALL
SELECT 'points:menu:rules', '积分规则', 2, 'points', 'admin', '/points/rules',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 20, 1
UNION ALL
SELECT 'points:menu:tasks', '任务管理', 2, 'points', 'admin', '/points/tasks',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 30, 1
UNION ALL
SELECT 'points:menu:mall:items', '商城商品', 2, 'points', 'admin', '/points/mall/items',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 40, 1
UNION ALL
SELECT 'points:menu:mall:orders', '商城订单', 2, 'points', 'admin', '/points/mall/orders',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 50, 1
UNION ALL
SELECT 'points:menu:logs', '积分流水', 2, 'points', 'admin', '/points/logs',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 60, 1
UNION ALL
SELECT 'points:menu:ops', '运维中心', 2, 'points', 'admin', '/points/ops',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 70, 1
UNION ALL
SELECT 'points:menu:adjust', '手工调整', 2, 'points', 'admin', '/points/adjust',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 80, 1
UNION ALL
SELECT 'points:menu:events', '事件追溯', 2, 'points', 'admin', '/points/events',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 90, 1
UNION ALL
SELECT 'points:menu:refund-ledger', '退款账本', 2, 'points', 'admin', '/points/refund-ledger',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points') t), 100, 1;

-- ===== §4. 按钮权限（type=3）— 11 条 =====
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `parent_id`, `sort`, `status`)
SELECT 'points:btn:rules:save', '保存积分规则', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:rules') t), 10, 1
UNION ALL
SELECT 'points:btn:task:create', '创建任务', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t), 10, 1
UNION ALL
SELECT 'points:btn:task:edit', '编辑任务', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t), 20, 1
UNION ALL
SELECT 'points:btn:task:delete', '删除任务', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t), 30, 1
UNION ALL
SELECT 'points:btn:mall:item:create', '创建商品', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:items') t), 10, 1
UNION ALL
SELECT 'points:btn:mall:item:edit', '编辑商品', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:items') t), 20, 1
UNION ALL
SELECT 'points:btn:mall:order:refund', '商城订单退款', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:orders') t), 10, 1
UNION ALL
SELECT 'points:btn:ops:trigger', '触发定时任务', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:ops') t), 10, 1
UNION ALL
SELECT 'points:btn:ops:clear-cache', '清理规则缓存', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:ops') t), 20, 1
UNION ALL
SELECT 'points:btn:adjust:do', '执行积分调整', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:adjust') t), 10, 1
UNION ALL
SELECT 'points:btn:events:retry', '失败事件重试', 3, 'points', 'admin',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:events') t), 10, 1;

-- ===== §5. 兜底 API（type=4）— 1 条 =====
-- 路由 POST /api/admin/points/cache/clear 在 router.ts 当前用 'points:ops:trigger' 鉴权；
-- 同步落 'points:cache:clear' 入库便于未来切换权限码（如需更细粒度）；
-- 当前不替换 router.ts，仅作 RBAC 元数据登记，不影响运行时
INSERT IGNORE INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `sort`, `status`)
VALUES
  ('points:cache:clear', '清理规则缓存（API）', 4, 'points', 'admin',
   '/api/admin/points/cache/clear', 'POST', 12, 1);

-- ===== §6. super_admin 默认拥有全部 points 权限（含本次新增 + 025 旧 API）=====
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `permissions` WHERE `module` = 'points';

COMMIT;

-- ============================================================
-- DOWN SQL（一次性使用，回滚时手动执行）
-- ============================================================
/*
START TRANSACTION;

DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'points' AND p.type IN (1, 2, 3);

DELETE FROM `permissions` WHERE module = 'points' AND type IN (1, 2, 3);

DELETE FROM `permissions` WHERE code = 'points:cache:clear';

COMMIT;
*/

-- ============================================================
-- 上线后校验 SQL（手动执行）
-- ============================================================
-- SELECT type, COUNT(*) FROM permissions WHERE module = 'points' GROUP BY type;
-- 预期：type=1 → 1, type=2 → 10, type=3 → 11, type=4 → 12（11 旧 + 1 新）
--
-- SELECT COUNT(*) FROM role_permissions rp
--   INNER JOIN permissions p ON rp.permission_id = p.id
--   WHERE rp.role_id = 1 AND p.module = 'points';
-- 预期：34（1+10+11+12）

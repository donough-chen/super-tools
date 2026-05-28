-- ============================================================
-- 028 · 积分管理模块（管理端）RBAC 权限补全
--
-- 设计依据: docs/superpowers/plans/2026-05-28-积分管理模块管理端实施计划.md §Task 1
-- 范式参考: 018_add_notification_system.sql §权限块
--
-- 内容（按 §章节）：
--   §1  幂等清理（type=1/2/3 与 role_permissions 中 points 模块映射）
--   §2  顶级目录（type=1）       — 1 条
--   §3  二级菜单（type=2）       — 10 条
--   §4  按钮权限（type=3）       — 11 条
--   §5  兜底 API（type=4）       — 5 条（points:cache:clear + Task 12/13 共 4 条）
--   §5.5 type=4 API parent_id 重挂枝 — 16 条（025 §7 的 11 条 + 028 §5 的 5 条）
--   §6  角色 × 权限映射          — super_admin / admin / operator / auditor 4 角色
--
-- 注意：
--   1. 025 §7 已写入 11 条 type=4 API 权限（points:task / points:mall / points:expire /
--      points:reconcile / points:ops），本迁移不再重复 INSERT，仅在 §5.5 通过 UPDATE
--      把它们的 parent_id 重挂到本迁移建立的对应 type=2 菜单下，形成完整三级树
--   2. 幂等：依赖 permissions.uk_code + INSERT IGNORE + UPDATE（天然幂等）+ 显式清理
--   3. super_admin 由 auth 中间件短路 RBAC，本迁移仍写一次默认全量映射，便于
--      role_permissions 表数据层可读性，与 018 风格一致
--   4. 角色映射策略（详见 §6 矩阵注释）：
--        - super_admin / admin：全部 points 权限
--        - operator           ：所有菜单 + 部分操作（不含敏感写入）+ 对应 API
--        - auditor            ：所有菜单（只读视角）+ 仅只读 API
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

-- ===== §5. 兜底 API（type=4）— 5 条 =====
-- 路由 POST /api/admin/points/cache/clear 在 router.ts 当前用 'points:ops:trigger' 鉴权；
-- 同步落 'points:cache:clear' 入库便于未来切换权限码（如需更细粒度）；
-- 当前不替换 router.ts，仅作 RBAC 元数据登记，不影响运行时。
--
-- Task 12 / Task 13 新增的 4 条 API 权限：router.ts 已实际生效启用，
--   GET  /api/admin/points/events                 -> points:events:list
--   POST /api/admin/points/events/:id/retry       -> points:events:retry
--   GET  /api/admin/points/refund-ledger          -> points:refund-ledger:list
--   GET  /api/admin/points/refund-ledger/flag     -> points:refund-ledger:flag
INSERT IGNORE INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `sort`, `status`)
VALUES
  ('points:cache:clear',          '清理规则缓存（API）',         4, 'points', 'admin',
   '/api/admin/points/cache/clear',         'POST', 12, 1),
  ('points:events:list',          '事件追溯列表（API）',         4, 'points', 'admin',
   '/api/admin/points/events',              'GET',  21, 1),
  ('points:events:retry',         '事件重试派发（API）',         4, 'points', 'admin',
   '/api/admin/points/events/:id/retry',    'POST', 22, 1),
  ('points:refund-ledger:list',   '退款账本流水列表（API）',     4, 'points', 'admin',
   '/api/admin/points/refund-ledger',       'GET',  31, 1),
  ('points:refund-ledger:flag',   '退款账本灰度状态（API）',     4, 'points', 'admin',
   '/api/admin/points/refund-ledger/flag',  'GET',  32, 1);

-- ===== §5.5 type=4 API 权限 parent_id 重挂枝 =====
-- 背景：025 §7 写入 11 条 API 权限时未指定 parent_id（默认 0），导致它们在权限树
--      中成为顶级孤儿，与本迁移新建的 'points' 顶级目录无父子关联，违反 018 范式
--      ("目录 → 菜单 → API" 三级树)。
--
-- 策略：本段以 UPDATE 方式把 025 §7 的 11 条 + 028 §5 的 1 条共 12 条 type=4 API，
--      按业务归属重挂到对应 type=2 菜单的 parent_id 下。完整挂载矩阵：
--
--      points:menu:dashboard      ← points:expire:stats
--      points:menu:tasks          ← points:task:list / create / update / delete (4)
--      points:menu:mall:items     ← points:mall:list / manage (2)
--      points:menu:mall:orders    ← points:mall:orders / refund (2)
--      points:menu:ops            ← points:reconcile:view / ops:trigger / cache:clear (3)
--      points:menu:events         ← points:events:list / retry (2)
--      points:menu:refund-ledger  ← points:refund-ledger:list / flag (2)
--
-- 幂等：UPDATE 是天然幂等的；多次执行结果一致
-- 注意：使用单条 UPDATE + CASE WHEN 而非 16 条独立 UPDATE，减少 SQL 解析开销，
--      同时保证原子性

UPDATE `permissions`
SET `parent_id` = CASE `code`
  -- 概览页 API
  WHEN 'points:expire:stats'        THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:dashboard') t)
  -- 任务管理 API
  WHEN 'points:task:list'           THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t)
  WHEN 'points:task:create'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t)
  WHEN 'points:task:update'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t)
  WHEN 'points:task:delete'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:tasks') t)
  -- 商城商品 API
  WHEN 'points:mall:list'           THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:items') t)
  WHEN 'points:mall:manage'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:items') t)
  -- 商城订单 API
  WHEN 'points:mall:orders'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:orders') t)
  WHEN 'points:mall:refund'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:mall:orders') t)
  -- 运维中心 API
  WHEN 'points:reconcile:view'      THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:ops') t)
  WHEN 'points:ops:trigger'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:ops') t)
  WHEN 'points:cache:clear'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:ops') t)
  -- 事件追溯 API（Task 12）
  WHEN 'points:events:list'         THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:events') t)
  WHEN 'points:events:retry'        THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:events') t)
  -- 退款账本 API（Task 13）
  WHEN 'points:refund-ledger:list'  THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:refund-ledger') t)
  WHEN 'points:refund-ledger:flag'  THEN (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'points:menu:refund-ledger') t)
  ELSE `parent_id`
END
WHERE `module` = 'points'
  AND `type` = 4
  AND `code` IN (
    'points:expire:stats',
    'points:task:list', 'points:task:create', 'points:task:update', 'points:task:delete',
    'points:mall:list', 'points:mall:manage',
    'points:mall:orders', 'points:mall:refund',
    'points:reconcile:view', 'points:ops:trigger', 'points:cache:clear',
    'points:events:list', 'points:events:retry',
    'points:refund-ledger:list', 'points:refund-ledger:flag'
  );

-- ===== §6. 角色 × 权限映射 =====
-- 参照 018_add_notification_system.sql §角色 × 权限映射 范式
--
-- 设计矩阵：
--   ┌──────────────┬──────────┬────────┬──────────┬──────────┐
--   │ 维度         │super_admin│ admin │ operator │ auditor  │
--   ├──────────────┼──────────┼────────┼──────────┼──────────┤
--   │ 顶级目录+菜单│   ✓      │   ✓    │   ✓ 全部 │ ✓ 全部   │
--   │ 任务 CRUD    │   ✓      │   ✓    │   ✓      │ ✗        │
--   │ 商品 C/U     │   ✓      │   ✓    │   ✓      │ ✗        │
--   │ 订单退款     │   ✓      │   ✓    │   ✗      │ ✗        │
--   │ 调整积分     │   ✓      │   ✓    │   ✗      │ ✗        │
--   │ 触发任务/缓存│   ✓      │   ✓    │   ✗      │ ✗        │
--   │ 失败事件重试 │   ✓      │   ✓    │   ✓      │ ✗        │
--   │ 保存规则     │   ✓      │   ✓    │   ✗      │ ✗        │
--   │ 只读 API     │   ✓      │   ✓    │   ✓      │ ✓        │
--   └──────────────┴──────────┴────────┴──────────┴──────────┘
--
-- 说明：super_admin（roles.code='super_admin'）由 auth 中间件短路 RBAC，无需写入；
--      为保持 role_permissions 表数据层可读性，仍写一次默认全量映射
--      （与 018 注释风格保持一致：'super_admin 中间件短路，不受 RBAC 限制' 但仍可显式登记）

-- ----- super_admin：全部 points 权限（type=1/2/3/4 全开）-----
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'super_admin'
  AND p.module = 'points';

-- ----- admin：全部 points 权限 -----
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.module = 'points';

-- ----- operator：所有菜单 + 任务/商品 CRUD + 失败事件重试 + 全部只读 API
--                （不含 refund / adjust / ops:trigger / cache:clear / rules:save）-----
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.module = 'points'
  AND p.code IN (
    -- 顶级目录 + 全部 10 个二级菜单（type=1 + type=2）
    'points',
    'points:menu:dashboard',
    'points:menu:rules',
    'points:menu:tasks',
    'points:menu:mall:items',
    'points:menu:mall:orders',
    'points:menu:logs',
    'points:menu:ops',
    'points:menu:adjust',
    'points:menu:events',
    'points:menu:refund-ledger',
    -- 按钮（type=3）：任务全套 + 商品 C/U + 失败事件重试
    'points:btn:task:create',
    'points:btn:task:edit',
    'points:btn:task:delete',
    'points:btn:mall:item:create',
    'points:btn:mall:item:edit',
    'points:btn:events:retry',
    -- 只读 + CRUD API（type=4）：025 已落 11 条 + 028 §5 落 5 条
    --   只读：list / mall:list / mall:orders / expire:stats / reconcile:view / events:list / refund-ledger:list / refund-ledger:flag
    --   CRUD：task:create/update/delete / mall:manage / events:retry
    --   不含：mall:refund / ops:trigger / cache:clear
    'points:task:list',
    'points:task:create',
    'points:task:update',
    'points:task:delete',
    'points:mall:list',
    'points:mall:manage',
    'points:mall:orders',
    'points:expire:stats',
    'points:reconcile:view',
    'points:events:list',
    'points:events:retry',
    'points:refund-ledger:list',
    'points:refund-ledger:flag'
  );

-- ----- auditor：所有菜单（只读视角）+ 仅只读 API（list / orders / stats / reconcile）-----
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.module = 'points'
  AND p.code IN (
    -- 顶级目录 + 全部 10 个二级菜单（只读视角，不挂任何按钮）
    'points',
    'points:menu:dashboard',
    'points:menu:rules',
    'points:menu:tasks',
    'points:menu:mall:items',
    'points:menu:mall:orders',
    'points:menu:logs',
    'points:menu:ops',
    'points:menu:adjust',
    'points:menu:events',
    'points:menu:refund-ledger',
    -- 只读 API（type=4，不含任何写操作）
    'points:task:list',
    'points:mall:list',
    'points:mall:orders',
    'points:expire:stats',
    'points:reconcile:view',
    'points:events:list',
    'points:refund-ledger:list',
    'points:refund-ledger:flag'
  );

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

DELETE FROM `permissions` WHERE code IN (
  'points:cache:clear',
  'points:events:list', 'points:events:retry',
  'points:refund-ledger:list', 'points:refund-ledger:flag'
);

-- §5.5 重挂枝回滚：把 025 §7 的 11 条 API 的 parent_id 还原为 0（顶级孤儿状态）
-- 注：028 §5 的 5 条新 API（cache:clear / events:* / refund-ledger:*）在上一步已被 DELETE，无需还原
UPDATE `permissions`
SET `parent_id` = 0
WHERE `module` = 'points'
  AND `type` = 4
  AND `code` IN (
    'points:expire:stats',
    'points:task:list', 'points:task:create', 'points:task:update', 'points:task:delete',
    'points:mall:list', 'points:mall:manage',
    'points:mall:orders', 'points:mall:refund',
    'points:reconcile:view', 'points:ops:trigger'
  );

COMMIT;
*/

-- ============================================================
-- 上线后校验 SQL（手动执行）
-- ============================================================
-- SELECT type, COUNT(*) FROM permissions WHERE module = 'points' GROUP BY type;
-- 预期：type=1 → 1, type=2 → 10, type=3 → 11, type=4 → 16（11 旧 + 5 新）
--
-- 角色权限挂载校验
-- SELECT r.code, COUNT(rp.permission_id) AS cnt
--   FROM role_permissions rp
--   INNER JOIN roles r       ON rp.role_id = r.id
--   INNER JOIN permissions p ON rp.permission_id = p.id
--   WHERE p.module = 'points'
--   GROUP BY r.code
--   ORDER BY cnt DESC;
-- 预期:
--   super_admin = 38 (1+10+11+16 全部)
--   admin       = 38 (1+10+11+16 全部)
--   operator    = 31 (1 顶级 + 10 菜单 + 6 按钮 + 13 API + 1 按钮 events:retry = 7 按钮 实际见 §6 IN 列表)
--   auditor     = 19 (1 顶级 + 10 菜单 +   0 按钮 + 8 API)
--
-- 权限树完整性校验（确认 12 条 type=4 API 已正确挂到 type=2 菜单下，无孤儿）
-- SELECT child.code AS api_code, parent.code AS menu_code, parent.name AS menu_name
--   FROM permissions child
--   LEFT JOIN permissions parent ON child.parent_id = parent.id
--   WHERE child.module = 'points' AND child.type = 4
--   ORDER BY parent.sort, child.sort;
-- 预期: 12 行全部 menu_code 非空（无 NULL），且 menu_code 全部以 'points:menu:' 开头
--
-- 孤儿检测（应返回 0 行）
-- SELECT code FROM permissions
--   WHERE module = 'points' AND type = 4
--     AND (parent_id IS NULL OR parent_id = 0
--          OR parent_id NOT IN (SELECT id FROM (SELECT id FROM permissions WHERE module='points' AND type=2) t));

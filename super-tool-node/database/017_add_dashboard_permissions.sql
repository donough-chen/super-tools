-- ============================================================
-- 迁移脚本: 017_add_dashboard_permissions.sql
-- 版本: 3.0.0
-- 创建时间: 2026-05-14
-- 说明: Dashboard 6 大模块权限接入 RBAC
--   1) 将原 dashboard 顶级节点从 type=2 菜单升级为 type=1 目录
--   2) 新增 7 个二级菜单（概览/分析/部门/预警/告警规则/可视化配置/移动视图）
--   3) 新增 6 个按钮/操作权限
--   4) 新增 38 个 API 权限
--   5) admin / operator / auditor 角色权限映射
-- 前置: 006_add_rbac_init.sql, 008_add_permission_icon_and_menu_normalize.sql
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 一、幂等清理 — 删除本脚本管理的 dashboard 模块扩展权限
-- ============================================================

-- 删除 dashboard 模块下扩展权限的角色映射（保留原有 dashboard + dashboard:view）
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'dashboard' AND p.code NOT IN ('dashboard', 'dashboard:view');

-- 删除 dashboard 模块扩展权限（保留原有根节点和 view）
DELETE FROM `permissions`
  WHERE module = 'dashboard' AND code NOT IN ('dashboard', 'dashboard:view');

-- ============================================================
-- 二、升级 dashboard 顶级节点为目录 (type=1)
-- ============================================================
UPDATE `permissions`
  SET `type` = 1, `icon` = 'DashboardOutlined', `path` = '/dashboard'
  WHERE code = 'dashboard';

-- ============================================================
-- 三、新增二级菜单（type=2）— 7 个页面入口
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:overview', '数据概览', 2, 'dashboard', NULL, 'admin', '/dashboard/overview', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 10
UNION ALL
SELECT 'dashboard:analytics', '业务分析', 2, 'dashboard', NULL, 'admin', '/dashboard/analytics', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 20
UNION ALL
SELECT 'dashboard:department', '部门视图', 2, 'dashboard', NULL, 'admin', '/dashboard/department', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 30
UNION ALL
SELECT 'dashboard:alerts', '智能预警', 2, 'dashboard', NULL, 'admin', '/dashboard/alerts', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 40
UNION ALL
SELECT 'dashboard:alerts:rules', '告警规则', 2, 'dashboard', NULL, 'admin', '/dashboard/alerts/rules', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 41
UNION ALL
SELECT 'dashboard:config', '可视化配置', 2, 'dashboard', NULL, 'admin', '/dashboard/config', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 50
UNION ALL
SELECT 'dashboard:mobile', '移动视图', 2, 'dashboard', NULL, 'admin', '/dashboard/mobile', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t), 60;

-- ============================================================
-- 四、新增按钮/操作权限（type=3）— 6 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:department:all', '查看全部部门', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:department') t), 10
UNION ALL
SELECT 'dashboard:department:own', '查看本部门', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:department') t), 20
UNION ALL
SELECT 'dashboard:alerts:manage', '管理告警规则', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 10
UNION ALL
SELECT 'dashboard:config:edit', '编辑布局', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 10
UNION ALL
SELECT 'dashboard:config:share', '分享布局', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 20
UNION ALL
SELECT 'dashboard:export', '导出报表', 3, 'dashboard', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 30;

-- ============================================================
-- 五、新增 API 权限（type=4）
-- ============================================================

-- ----- 5.1 概览模块 API (Phase 1) — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:overview:stats', '大盘统计', 4, 'dashboard', 'admin',
       '/api/admin/stats/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:overview') t), 10
UNION ALL
SELECT 'dashboard:overview:system-status', '系统状态', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/system-status', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:overview') t), 20
UNION ALL
SELECT 'dashboard:overview:trend', '趋势数据', 4, 'dashboard', 'admin',
       '/api/admin/stats/trend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:overview') t), 30;

-- ----- 5.2 业务分析 API (Phase 1) — 5 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:analytics:retention', '用户留存', 4, 'dashboard', 'admin',
       '/api/admin/stats/user-retention', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:analytics') t), 10
UNION ALL
SELECT 'dashboard:analytics:active-hours', '活跃时段', 4, 'dashboard', 'admin',
       '/api/admin/stats/active-hours', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:analytics') t), 20
UNION ALL
SELECT 'dashboard:analytics:tool-category', '工具分类统计', 4, 'dashboard', 'admin',
       '/api/admin/stats/tool-category', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:analytics') t), 30
UNION ALL
SELECT 'dashboard:analytics:efficiency', '运营效率', 4, 'dashboard', 'admin',
       '/api/admin/stats/operation-efficiency', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:analytics') t), 40
UNION ALL
SELECT 'dashboard:analytics:user-growth', '用户增长', 4, 'dashboard', 'admin',
       '/api/admin/stats/user-growth', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:analytics') t), 50;

-- ----- 5.3 部门视图 API (Phase 2) — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:department:overview', '部门概览', 4, 'dashboard', 'admin',
       '/api/admin/stats/department/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:department') t), 30
UNION ALL
SELECT 'dashboard:department:compare', '部门对比', 4, 'dashboard', 'admin',
       '/api/admin/stats/department/compare', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:department') t), 40
UNION ALL
SELECT 'dashboard:department:collaboration', '跨部门协作', 4, 'dashboard', 'admin',
       '/api/admin/stats/department/collaboration', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:department') t), 50;

-- ----- 5.4 智能预警 API (Phase 3) — 9 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:alerts:rules:list', '规则列表', 4, 'dashboard', 'admin',
       '/api/admin/alerts/rules', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 20
UNION ALL
SELECT 'dashboard:alerts:rules:create', '创建规则', 4, 'dashboard', 'admin',
       '/api/admin/alerts/rules', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 30
UNION ALL
SELECT 'dashboard:alerts:rules:update', '更新规则', 4, 'dashboard', 'admin',
       '/api/admin/alerts/rules/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 40
UNION ALL
SELECT 'dashboard:alerts:rules:delete', '删除规则', 4, 'dashboard', 'admin',
       '/api/admin/alerts/rules/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 50
UNION ALL
SELECT 'dashboard:alerts:rules:toggle', '启用/禁用规则', 4, 'dashboard', 'admin',
       '/api/admin/alerts/rules/:id/toggle', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 60
UNION ALL
SELECT 'dashboard:alerts:logs:list', '告警记录列表', 4, 'dashboard', 'admin',
       '/api/admin/alerts/logs', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 70
UNION ALL
SELECT 'dashboard:alerts:logs:ack', '确认告警', 4, 'dashboard', 'admin',
       '/api/admin/alerts/logs/:id/acknowledge', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 80
UNION ALL
SELECT 'dashboard:alerts:logs:resolve', '解决告警', 4, 'dashboard', 'admin',
       '/api/admin/alerts/logs/:id/resolve', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 90
UNION ALL
SELECT 'dashboard:alerts:summary', '告警统计', 4, 'dashboard', 'admin',
       '/api/admin/alerts/summary', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:alerts') t), 100;

-- ----- 5.5 可视化配置 API (Phase 4) — 8 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:config:layouts:list', '布局列表', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 40
UNION ALL
SELECT 'dashboard:config:layouts:detail', '布局详情', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 50
UNION ALL
SELECT 'dashboard:config:layouts:create', '创建布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 60
UNION ALL
SELECT 'dashboard:config:layouts:update', '更新布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 70
UNION ALL
SELECT 'dashboard:config:layouts:delete', '删除布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 80
UNION ALL
SELECT 'dashboard:config:layouts:default', '设为默认布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts/:id/default', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 90
UNION ALL
SELECT 'dashboard:config:layouts:share', '分享布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/layouts/:id/share', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 100
UNION ALL
SELECT 'dashboard:config:shared:view', '查看分享布局', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/shared/:token', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:config') t), 110;

-- ----- 5.6 移动端适配 API (Phase 5) — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:mobile:summary', '移动端摘要', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/mobile-summary', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:mobile') t), 10
UNION ALL
SELECT 'dashboard:mobile:push-settings:read', '读取推送设置', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/push-settings', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:mobile') t), 20
UNION ALL
SELECT 'dashboard:mobile:push-settings:write', '保存推送设置', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/push-settings', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard:mobile') t), 30;

-- ============================================================
-- 六、角色 × 权限映射
-- ============================================================

-- ----- 6.1 admin 角色：全部 dashboard 权限 -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.module = 'dashboard'
  AND p.code NOT IN ('dashboard', 'dashboard:view');  -- 原有的已在 006 中映射

-- ----- 6.2 operator 角色：概览 + 分析 + 预警(只读) + 配置(读+编辑) + 移动端 -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.module = 'dashboard'
  AND p.code IN (
    -- 菜单
    'dashboard:overview', 'dashboard:analytics', 'dashboard:alerts',
    'dashboard:config', 'dashboard:mobile',
    -- 概览 API
    'dashboard:overview:stats', 'dashboard:overview:system-status', 'dashboard:overview:trend',
    -- 分析 API
    'dashboard:analytics:retention', 'dashboard:analytics:active-hours',
    'dashboard:analytics:tool-category', 'dashboard:analytics:efficiency',
    'dashboard:analytics:user-growth',
    -- 预警 只读 API
    'dashboard:alerts:rules:list', 'dashboard:alerts:logs:list',
    'dashboard:alerts:logs:ack', 'dashboard:alerts:logs:resolve',
    'dashboard:alerts:summary',
    -- 配置 读+编辑
    'dashboard:config:edit',
    'dashboard:config:layouts:list', 'dashboard:config:layouts:detail',
    'dashboard:config:layouts:create', 'dashboard:config:layouts:update',
    'dashboard:config:layouts:delete', 'dashboard:config:layouts:default',
    -- 移动端
    'dashboard:mobile:summary',
    'dashboard:mobile:push-settings:read', 'dashboard:mobile:push-settings:write'
  );

-- ----- 6.3 auditor 角色：概览 + 分析 + 预警(只读) + 移动端(只读) -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.module = 'dashboard'
  AND p.code IN (
    -- 菜单
    'dashboard:overview', 'dashboard:analytics', 'dashboard:alerts', 'dashboard:mobile',
    -- 概览 API
    'dashboard:overview:stats', 'dashboard:overview:system-status', 'dashboard:overview:trend',
    -- 分析 API
    'dashboard:analytics:retention', 'dashboard:analytics:active-hours',
    'dashboard:analytics:tool-category', 'dashboard:analytics:efficiency',
    'dashboard:analytics:user-growth',
    -- 预警 只读
    'dashboard:alerts:rules:list', 'dashboard:alerts:logs:list', 'dashboard:alerts:summary',
    -- 移动端 只读
    'dashboard:mobile:summary', 'dashboard:mobile:push-settings:read'
  );

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 七、数据校验（手动执行）
-- ============================================================
-- 检查 dashboard 模块权限总数
-- SELECT COUNT(*) FROM `permissions` WHERE module = 'dashboard';
-- 期望: 2(原有) + 7(菜单) + 6(按钮) + 31(API) = 46
--
-- 检查各层级数量
-- SELECT type, COUNT(*) FROM `permissions` WHERE module = 'dashboard' GROUP BY type;
-- 期望: type=1 → 1(目录), type=2 → 8(菜单,含原dashboard:view), type=3 → 6(按钮), type=4 → 31(API)
--
-- 检查角色权限数量 (仅 dashboard 模块新增部分)
-- SELECT r.code, COUNT(rp.permission_id) FROM `role_permissions` rp
--   JOIN `roles` r ON rp.role_id = r.id
--   JOIN `permissions` p ON rp.permission_id = p.id
--   WHERE p.module = 'dashboard'
--   GROUP BY r.code ORDER BY COUNT(rp.permission_id) DESC;
-- 期望: admin=46(全部), operator=约30, auditor=约19
--
-- 权限码 → 角色 矩阵
-- ┌────────────────────────────────┬───────┬──────────┬─────────┐
-- │ 权限码                         │ admin │ operator │ auditor │
-- ├────────────────────────────────┼───────┼──────────┼─────────┤
-- │ dashboard:overview             │  ✅   │    ✅    │   ✅    │
-- │ dashboard:analytics            │  ✅   │    ✅    │   ✅    │
-- │ dashboard:department           │  ✅   │    ❌    │   ❌    │
-- │ dashboard:department:all       │  ✅   │    ❌    │   ❌    │
-- │ dashboard:department:own       │  ✅   │    ❌    │   ❌    │
-- │ dashboard:alerts               │  ✅   │    ✅    │   ✅    │
-- │ dashboard:alerts:manage        │  ✅   │    ❌    │   ❌    │
-- │ dashboard:alerts:rules         │  ✅   │    ❌    │   ❌    │
-- │ dashboard:config               │  ✅   │    ✅    │   ❌    │
-- │ dashboard:config:edit          │  ✅   │    ✅    │   ❌    │
-- │ dashboard:config:share         │  ✅   │    ❌    │   ❌    │
-- │ dashboard:export               │  ✅   │    ❌    │   ❌    │
-- │ dashboard:mobile               │  ✅   │    ✅    │   ✅    │
-- └────────────────────────────────┴───────┴──────────┴─────────┘

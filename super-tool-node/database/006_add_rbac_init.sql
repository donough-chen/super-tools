-- ============================================================
-- 迁移脚本: 006_add_rbac_init.sql
-- 版本: 2.5.0
-- 创建时间: 2026-05-09
-- 说明: RBAC 体系初始化
--   1) permissions 表新增 module 字段，便于按模块分组与缓存失效
--   2) roles 表新增 auditor（审计员）系统角色，保留 guest
--   3) 初始化 7 大模块共 61 条权限码（dashboard / system / user / category / tool / feedback / stats）
--   4) 写入 admin / operator / auditor 三个角色的权限映射
--      （super_admin 中间件短路，user 仅占位无管理端权限）
--   5) 存量用户按 user_type 自动绑定到对应系统角色
--      （user_type=3 → super_admin，user_type=2 → admin，user_type=1 → user）
--   6) 幂等：脚本顶部清理 type=1 系统角色关联 + 7 大模块的 system 权限，可重复执行
-- 设计文档: .codebuddy/specs/rbac-system/spec.md
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- 一、Schema 变更
-- ============================================================

-- 1.1 permissions 表新增 module 字段（用于按模块分组、缓存按模块失效）
-- 注意：MySQL 8.0+ 支持 IF NOT EXISTS；老版本若已有该列，重复执行会报错，需手动跳过
ALTER TABLE `permissions`
  ADD COLUMN `module` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '所属模块:dashboard/system/user/category/tool/feedback/stats' AFTER `type`,
  ADD INDEX `idx_module` (`module`);


-- ============================================================
-- 二、幂等清理（仅清理本脚本管理的系统数据，不动业务自定义数据）
-- ============================================================

-- 2.1 删除 type=1 系统角色关联的权限映射
DELETE rp FROM `role_permissions` rp
  INNER JOIN `roles` r ON rp.role_id = r.id
  WHERE r.type = 1;

-- 2.2 删除 type=1 系统角色与用户的绑定（后面会按 user_type 重建）
DELETE FROM `user_roles`
  WHERE role_id IN (SELECT id FROM `roles` WHERE type = 1);

-- 2.3 删除 7 大系统模块下的所有权限（系统模块不允许业务侵入）
DELETE FROM `permissions`
  WHERE module IN ('dashboard','system','user','category','tool','feedback','stats');

-- 2.4 删除可能存在的旧版 auditor 角色（防止 code 重复）；其他系统角色保留
DELETE FROM `roles` WHERE code = 'auditor';


-- ============================================================
-- 三、初始化角色（5 个系统角色 + 保留 guest）
-- ============================================================

-- 已有 super_admin / admin / operator / user / guest 由 init.sql 创建
-- 这里仅补一个 auditor（审计员）
INSERT INTO `roles` (`name`, `code`, `type`, `platform`, `description`, `sort`) VALUES
  ('审计员', 'auditor', 1, 'admin', '只读 + 审计日志查看，不能修改任何业务数据', 5);


-- ============================================================
-- 四、初始化权限（共 62 条）
--   说明:
--     - type:  1=目录(dir)  2=菜单(menu)  3=按钮(button)  4=API
--     - parent_id: 0=顶级；其他通过 (SELECT id FROM permissions WHERE code=...) 绑定
--     - platform: 全部为 'admin'（仅管理端）
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 顶级：7 个模块根节点（dashboard / system / user / category / tool / feedback / stats）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
VALUES
  ('dashboard', '仪表盘',     2, 'dashboard', 'admin', '/dashboard', NULL, 0, 10),
  ('system',    '系统管理',   1, 'system',    'admin', '/system',    NULL, 0, 90),
  ('user',      '用户管理',   2, 'user',      'admin', '/user',      NULL, 0, 20),
  ('category',  '分类管理',   2, 'category',  'admin', '/category',  NULL, 0, 30),
  ('tool',      '工具管理',   2, 'tool',      'admin', '/tool',      NULL, 0, 40),
  ('feedback',  '反馈管理',   2, 'feedback',  'admin', '/feedback',  NULL, 0, 50),
  ('stats',     '数据统计',   2, 'stats',     'admin', '/stats',     NULL, 0, 60);

-- ------------------------------------------------------------
-- 4.2 dashboard 模块（1 条 API）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'dashboard:view', '查看仪表盘', 4, 'dashboard', 'admin',
       '/api/admin/dashboard/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'dashboard') t),
       10;

-- ------------------------------------------------------------
-- 4.3 system 模块（20 条：4 个二级菜单 + 16 个 API；不含 system 顶级目录，已在 4.1 插入）
-- ------------------------------------------------------------
-- 二级菜单
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:role', '角色管理', 2, 'system', 'admin', '/system/role', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system') t), 10
UNION ALL
SELECT 'system:permission', '权限管理', 2, 'system', 'admin', '/system/permission', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system') t), 20
UNION ALL
SELECT 'system:audit-log', '审计日志', 2, 'system', 'admin', '/system/audit-log', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system') t), 30
UNION ALL
SELECT 'system:permission-test', '权限测试', 2, 'system', 'admin', '/system/permission-test', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system') t), 40;

-- system:role:* (9 条 API)
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:role:list', '角色列表', 4, 'system', 'admin',
       '/api/admin/roles', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 10
UNION ALL
SELECT 'system:role:detail', '角色详情', 4, 'system', 'admin',
       '/api/admin/roles/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 20
UNION ALL
SELECT 'system:role:create', '新建角色', 4, 'system', 'admin',
       '/api/admin/roles', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 30
UNION ALL
SELECT 'system:role:update', '编辑角色', 4, 'system', 'admin',
       '/api/admin/roles/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 40
UNION ALL
SELECT 'system:role:delete', '删除角色', 4, 'system', 'admin',
       '/api/admin/roles/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 50
UNION ALL
SELECT 'system:role:assign-permissions', '分配权限', 4, 'system', 'admin',
       '/api/admin/roles/:id/permissions', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 60
UNION ALL
SELECT 'system:role:assign-users', '分配用户', 4, 'system', 'admin',
       '/api/admin/roles/:id/users', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 70
UNION ALL
SELECT 'system:role:copy', '复制角色', 4, 'system', 'admin',
       '/api/admin/roles/:id/copy', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 80
UNION ALL
SELECT 'system:role:batch-assign', '批量赋权', 4, 'system', 'admin',
       '/api/admin/roles/batch-assign-permissions', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:role') t), 90;

-- system:permission:* (3 条 API)
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:permission:list', '权限列表', 4, 'system', 'admin',
       '/api/admin/permissions', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:permission') t), 10
UNION ALL
SELECT 'system:permission:tree', '权限树', 4, 'system', 'admin',
       '/api/admin/permissions/tree', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:permission') t), 20
UNION ALL
SELECT 'system:permission:view', '查看权限持有者', 4, 'system', 'admin',
       '/api/admin/permissions/:id/holders', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:permission') t), 30;

-- system:audit-log:* (3 条 API)
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:audit-log:list', '审计日志列表', 4, 'system', 'admin',
       '/api/admin/audit-logs', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:audit-log') t), 10
UNION ALL
SELECT 'system:audit-log:detail', '审计日志详情', 4, 'system', 'admin',
       '/api/admin/audit-logs/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:audit-log') t), 20
UNION ALL
SELECT 'system:audit-log:export', '导出审计日志', 4, 'system', 'admin',
       '/api/admin/audit-logs/export', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:audit-log') t), 30;

-- system:permission-test:* (1 条 API)
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'system:permission-test:run', '执行权限测试', 4, 'system', 'admin',
       '/api/admin/permissions/test', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'system:permission-test') t), 10;

-- ------------------------------------------------------------
-- 4.4 user 模块（10 条 API；不含 user 顶级菜单，已在 4.1 插入）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'user:list', '用户列表', 4, 'user', 'admin',
       '/api/admin/users', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 10
UNION ALL
SELECT 'user:detail', '用户详情', 4, 'user', 'admin',
       '/api/admin/users/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 20
UNION ALL
SELECT 'user:create', '新建用户', 4, 'user', 'admin',
       '/api/admin/users', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 30
UNION ALL
SELECT 'user:update', '编辑用户', 4, 'user', 'admin',
       '/api/admin/users/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 40
UNION ALL
SELECT 'user:delete', '删除用户', 4, 'user', 'admin',
       '/api/admin/users/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 50
UNION ALL
SELECT 'user:reset-password', '重置密码', 4, 'user', 'admin',
       '/api/admin/users/:id/reset-password', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 60
UNION ALL
SELECT 'user:disable', '禁用/启用用户', 4, 'user', 'admin',
       '/api/admin/users/:id/status', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 70
UNION ALL
SELECT 'user:assign-roles', '分配角色', 4, 'user', 'admin',
       '/api/admin/users/:id/roles', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 80
UNION ALL
SELECT 'user:permission:grant', '直接授予权限', 4, 'user', 'admin',
       '/api/admin/users/:id/permissions', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 90
UNION ALL
SELECT 'user:permission:revoke', '回收用户权限', 4, 'user', 'admin',
       '/api/admin/users/:id/permissions/:permId', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 100;

-- ------------------------------------------------------------
-- 4.5 category 模块（5 条 API；不含 category 顶级菜单，已在 4.1 插入）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'category:list', '分类列表', 4, 'category', 'admin',
       '/api/admin/categories', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 10
UNION ALL
SELECT 'category:create', '新建分类', 4, 'category', 'admin',
       '/api/admin/categories', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 20
UNION ALL
SELECT 'category:update', '编辑分类', 4, 'category', 'admin',
       '/api/admin/categories/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 30
UNION ALL
SELECT 'category:delete', '删除分类', 4, 'category', 'admin',
       '/api/admin/categories/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 40
UNION ALL
SELECT 'category:sort', '排序分类', 4, 'category', 'admin',
       '/api/admin/categories/sort', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 50;

-- ------------------------------------------------------------
-- 4.6 tool 模块（9 条 API；不含 tool 顶级菜单，已在 4.1 插入）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'tool:list', '工具列表', 4, 'tool', 'admin',
       '/api/admin/tools', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 10
UNION ALL
SELECT 'tool:detail', '工具详情', 4, 'tool', 'admin',
       '/api/admin/tools/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 20
UNION ALL
SELECT 'tool:create', '新建工具', 4, 'tool', 'admin',
       '/api/admin/tools', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 30
UNION ALL
SELECT 'tool:update', '编辑工具', 4, 'tool', 'admin',
       '/api/admin/tools/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 40
UNION ALL
SELECT 'tool:delete', '删除工具', 4, 'tool', 'admin',
       '/api/admin/tools/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 50
UNION ALL
SELECT 'tool:publish', '上架工具', 4, 'tool', 'admin',
       '/api/admin/tools/:id/publish', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 60
UNION ALL
SELECT 'tool:unpublish', '下架工具', 4, 'tool', 'admin',
       '/api/admin/tools/:id/unpublish', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 70
UNION ALL
SELECT 'tool:sort', '工具排序', 4, 'tool', 'admin',
       '/api/admin/tools/sort', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 80
UNION ALL
SELECT 'tool:batch-update', '批量编辑', 4, 'tool', 'admin',
       '/api/admin/tools/batch', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 90;

-- ------------------------------------------------------------
-- 4.7 feedback 模块（4 条 API；不含 feedback 顶级菜单，已在 4.1 插入）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:list', '反馈列表', 4, 'feedback', 'admin',
       '/api/admin/feedbacks', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 10
UNION ALL
SELECT 'feedback:detail', '反馈详情', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 20
UNION ALL
SELECT 'feedback:reply', '回复反馈', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/:id/reply', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 30
UNION ALL
SELECT 'feedback:delete', '删除反馈', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 40;

-- ------------------------------------------------------------
-- 4.8 stats 模块（5 条 API；不含 stats 顶级菜单，已在 4.1 插入）
-- ------------------------------------------------------------
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'stats:overview', '总览', 4, 'stats', 'admin',
       '/api/admin/stats/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 10
UNION ALL
SELECT 'stats:tool-usage', '工具使用统计', 4, 'stats', 'admin',
       '/api/admin/stats/tools', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 20
UNION ALL
SELECT 'stats:user-active', '用户活跃统计', 4, 'stats', 'admin',
       '/api/admin/stats/users', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 30
UNION ALL
SELECT 'stats:trend', '趋势数据', 4, 'stats', 'admin',
       '/api/admin/stats/trend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 40
UNION ALL
SELECT 'stats:export', '导出统计', 4, 'stats', 'admin',
       '/api/admin/stats/export', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 50;


-- ============================================================
-- 五、角色 × 权限 映射
--   - super_admin：中间件短路，不写记录
--   - user：管理端无权限，不写记录
--   - admin / operator / auditor：按 spec 5.5 矩阵插入
-- ============================================================

-- 5.1 admin 角色：47 条（除 system:role 相关 9 条外，其余全部）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code IN (
    -- dashboard (2)
    'dashboard', 'dashboard:view',
    -- system 只读 + permission-test (10)
    'system',
    'system:permission', 'system:permission:list', 'system:permission:tree', 'system:permission:view',
    'system:audit-log', 'system:audit-log:list', 'system:audit-log:detail',
    'system:permission-test', 'system:permission-test:run',
    -- user 全部除 assign-roles / permission grant/revoke (8)
    'user', 'user:list', 'user:detail', 'user:create', 'user:update', 'user:delete',
    'user:reset-password', 'user:disable',
    -- category 全部 (6)
    'category', 'category:list', 'category:create', 'category:update', 'category:delete', 'category:sort',
    -- tool 全部 (10)
    'tool', 'tool:list', 'tool:detail', 'tool:create', 'tool:update', 'tool:delete',
    'tool:publish', 'tool:unpublish', 'tool:sort', 'tool:batch-update',
    -- feedback 全部 (5)
    'feedback', 'feedback:list', 'feedback:detail', 'feedback:reply', 'feedback:delete',
    -- stats 全部 (6)
    'stats', 'stats:overview', 'stats:tool-usage', 'stats:user-active', 'stats:trend', 'stats:export'
  );

-- 5.2 operator 角色：31 条（无 system 模块；user 只读；category/tool 读写；feedback 读写；stats 只读 5 项）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.code IN (
    -- dashboard (2)
    'dashboard', 'dashboard:view',
    -- user 只读 (3)
    'user', 'user:list', 'user:detail',
    -- category 全部 (6)
    'category', 'category:list', 'category:create', 'category:update', 'category:delete', 'category:sort',
    -- tool 全部 (10)
    'tool', 'tool:list', 'tool:detail', 'tool:create', 'tool:update', 'tool:delete',
    'tool:publish', 'tool:unpublish', 'tool:sort', 'tool:batch-update',
    -- feedback 全部 (5)
    'feedback', 'feedback:list', 'feedback:detail', 'feedback:reply', 'feedback:delete',
    -- stats 不含 export (5)
    'stats', 'stats:overview', 'stats:tool-usage', 'stats:user-active', 'stats:trend'
  );

-- 5.3 auditor 角色：27 条（全只读 + 审计日志可导出）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.code IN (
    -- dashboard (2)
    'dashboard', 'dashboard:view',
    -- system permission/audit-log 只读 + audit-log export (10)
    'system',
    'system:permission', 'system:permission:list', 'system:permission:tree', 'system:permission:view',
    'system:audit-log', 'system:audit-log:list', 'system:audit-log:detail', 'system:audit-log:export',
    -- user 只读 (3)
    'user', 'user:list', 'user:detail',
    -- category 只读 (2)
    'category', 'category:list',
    -- tool 只读 (3)
    'tool', 'tool:list', 'tool:detail',
    -- feedback 只读 (3)
    'feedback', 'feedback:list', 'feedback:detail',
    -- stats 只读 (5)
    'stats', 'stats:overview', 'stats:tool-usage', 'stats:user-active', 'stats:trend'
  );


-- ============================================================
-- 六、存量用户角色绑定（按 user_type 自动迁移）
--   - user_type=3 → super_admin
--   - user_type=2 → admin
--   - user_type=1 → user
--   注意：已被 2.2 步骤清空 user_roles 中所有系统角色绑定，这里全量重建
-- ============================================================

-- 6.1 user_type=3 → super_admin
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM `users` u CROSS JOIN `roles` r
WHERE u.user_type = 3 AND r.code = 'super_admin'
  AND u.deleted_at IS NULL;

-- 6.2 user_type=2 → admin
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM `users` u CROSS JOIN `roles` r
WHERE u.user_type = 2 AND r.code = 'admin'
  AND u.deleted_at IS NULL;

-- 6.3 user_type=1 → user
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM `users` u CROSS JOIN `roles` r
WHERE u.user_type = 1 AND r.code = 'user'
  AND u.deleted_at IS NULL;


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 七、数据校验（可手动执行）
-- ============================================================
-- 检查权限总数（应为 61）
-- SELECT COUNT(*) AS total FROM `permissions`
--   WHERE module IN ('dashboard','system','user','category','tool','feedback','stats');
--
-- 检查各模块数量
-- SELECT module, COUNT(*) AS cnt FROM `permissions`
--   WHERE module IN ('dashboard','system','user','category','tool','feedback','stats')
--   GROUP BY module ORDER BY cnt DESC;
-- 期望：system=21  user=11  tool=10  stats=6  category=6  feedback=5  dashboard=2
--
-- 检查各角色权限数量
-- SELECT r.code, COUNT(rp.permission_id) AS cnt FROM `roles` r
--   LEFT JOIN `role_permissions` rp ON rp.role_id = r.id
--   WHERE r.type = 1 GROUP BY r.id, r.code ORDER BY cnt DESC;
-- 期望：admin=47  operator=31  auditor=27  super_admin=0  user=0  guest=0
--
-- 检查 admin 角色权限码列表
-- SELECT p.code FROM `roles` r
--   INNER JOIN `role_permissions` rp ON rp.role_id = r.id
--   INNER JOIN `permissions` p ON p.id = rp.permission_id
--   WHERE r.code = 'admin' ORDER BY p.module, p.sort, p.id;
--
-- 检查 admin 用户绑定的角色
-- SELECT u.username, GROUP_CONCAT(r.code) AS roles FROM `users` u
--   LEFT JOIN `user_roles` ur ON ur.user_id = u.id
--   LEFT JOIN `roles` r ON r.id = ur.role_id
--   WHERE u.username = 'admin' GROUP BY u.id;
-- 期望：admin → super_admin

-- ============================================================
-- 迁移脚本: 013_restore_menu_permissions.sql
-- 版本: 2.12.0
-- 创建时间: 2026-05-13
-- 说明: 恢复被清理的二级菜单权限 + 补充会员模块遗漏的子菜单 + 角色映射
--
-- 背景：
--   手动执行了 DELETE WHERE code LIKE '%:menu' 清理了二级菜单记录。
--   本脚本重建这些记录，同时补充 member 模块遗漏的 Stats/Config 子菜单，
--   并补齐 admin/operator/auditor 三个角色的映射。
--
-- 影响范围：
--   - permissions 表：新增 8 条 type=2 菜单记录（原 6 条 + member 新增 2 条）
--   - role_permissions 表：新增 24 条映射（3 角色 × 8 菜单）
--
-- 前置依赖：
--   - 006_add_rbac_init.sql（顶级目录已创建且 type=1）
--   - 007_add_member_module.sql（member 顶级目录已创建）
--   - 008_add_permission_icon_and_menu_normalize.sql（type 已升级为 1）
--
-- 幂等策略：使用子查询 WHERE NOT EXISTS 避免重复插入
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- 一、二级菜单权限数据对照表
-- ============================================================
-- 分析来源：前端路由 config/routes/modules/*.ts + 页面目录 src/pages/
--
-- | 顶级目录(type=1) | 二级菜单 code  | 菜单名称 | DB path         | 前端路由路径      | 页面组件                     |
-- |-------------------|----------------|----------|-----------------|-------------------|------------------------------|
-- | user              | user:menu      | 用户列表 | /user/list      | /user/list        | pages/User/List              |
-- | category          | category:menu  | 分类列表 | /category/list  | /category/list    | pages/Tool/Categories        |
-- | tool              | tool:menu      | 工具列表 | /tool/list      | /tool/list        | pages/Tool/List              |
-- | feedback          | feedback:menu  | 反馈列表 | /feedback/list  | /feedback/list    | pages/Feedback/List          |
-- | stats             | stats:menu     | 数据总览 | /stats/overview | /stats/overview   | pages/Dashboard/Placeholder  |
-- | member            | member:menu        | 会员用户 | /member/list    | /member/list      | pages/Member/Users           |
-- | member            | member:stats:menu  | 会员统计 | /member/stats   | /member/stats     | pages/Member/Stats           |
-- | member            | member:config:menu | 会员配置 | /member/config  | /member/config    | pages/Member/Config          |
--
-- 注意：以下模块不受影响（code 不含 :menu 后缀）
-- | dashboard         | （type=2 叶子菜单，无二级）                                                  |
-- | system            | system:role / system:permission / system:audit-log / system:permission-test   |


-- ============================================================
-- 二、插入 6 条 *:menu 二级菜单（type=2）
-- ============================================================

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'user:menu', '用户列表', 2, 'user', NULL, 'admin', '/user/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'user') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'user:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'category:menu', '分类列表', 2, 'category', NULL, 'admin', '/category/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'category') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'category:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'tool:menu', '工具列表', 2, 'tool', NULL, 'admin', '/tool/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'tool') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'tool:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:menu', '反馈列表', 2, 'feedback', NULL, 'admin', '/feedback/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'feedback:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'stats:menu', '数据总览', 2, 'stats', NULL, 'admin', '/stats/overview', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'stats') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'stats:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:menu', '会员用户', 2, 'member', NULL, 'admin', '/member/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 10
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'member:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:stats:menu', '会员统计', 2, 'member', NULL, 'admin', '/member/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 20
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'member:stats:menu');

INSERT INTO `permissions` (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'member:config:menu', '会员配置', 2, 'member', NULL, 'admin', '/member/config', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'member') t), 30
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'member:config:menu');


-- ============================================================
-- 三、为 admin / operator / auditor 三个角色绑定 8 条菜单
-- ============================================================
-- 所有管理端角色都需要看到侧边栏菜单项，因此三个角色均绑定全部 8 条。
-- 使用 NOT EXISTS 避免重复插入。

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.code IN ('admin', 'operator', 'auditor')
  AND p.code IN (
    'user:menu', 'category:menu', 'tool:menu', 'feedback:menu', 'stats:menu',
    'member:menu', 'member:stats:menu', 'member:config:menu'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 四、执行后校验（手动执行）
-- ============================================================

-- 4.1 确认 8 条二级菜单权限已插入
-- SELECT id, code, name, type, module, path, parent_id
-- FROM permissions WHERE code LIKE '%:menu'
-- ORDER BY module, sort;
-- 期望：8 行，type 全部为 2

-- 4.2 确认各顶级目录 type=1
-- SELECT code, type FROM permissions
-- WHERE code IN ('user','category','tool','feedback','stats','member');
-- 期望：全部 type=1

-- 4.3 确认角色映射数量
-- SELECT r.code AS role_code, COUNT(*) AS menu_count
-- FROM role_permissions rp
-- JOIN roles r ON rp.role_id = r.id
-- JOIN permissions p ON rp.permission_id = p.id
-- WHERE p.code LIKE '%:menu'
-- GROUP BY r.code;
-- 期望：admin=8, operator=8, auditor=8

-- 4.4 确认菜单树完整（模拟 getMenusForUser）
-- SELECT p.code, p.name, p.path, p.type,
--        pp.code AS parent_code, pp.name AS parent_name
-- FROM permissions p
-- LEFT JOIN permissions pp ON p.parent_id = pp.id
-- WHERE p.platform = 'admin' AND p.type IN (1, 2)
-- ORDER BY p.sort, p.id;

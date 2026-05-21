-- ============================================================
-- 迁移脚本: 019_feedback_enhancement.sql
-- 版本: 3.1.0
-- 创建时间: 2026-05-21
-- 说明: 反馈模块增强
--   1) 升级 feedback 顶级节点为目录 (type=1)
--   2) 新增 2 个二级菜单权限 (feedback:list-page / feedback:stats-page)
--   3) 新增 1 个按钮权限 (feedback:batch-close)
--   4) 新增 3 个 API 权限 (stats:overview / stats:trend / pending-count)
--   5) admin / operator / auditor 角色权限映射
--   6) Seed BUSINESS_FEEDBACK_NEW 通知类型 + 站内信模板
-- 前置: 006_add_rbac_init.sql, 009_add_feedback_module.sql, 018_add_notification_system.sql
-- 注意: 本迁移幂等，可重复执行
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 一、幂等清理 — 删除本脚本管理的 feedback 模块扩展权限
-- ============================================================

-- 删除 feedback 模块下本脚本扩展权限的角色映射
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'feedback'
    AND p.code IN (
      'feedback:list-page', 'feedback:stats-page',
      'feedback:batch-close',
      'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
    );

-- 删除本脚本管理的扩展权限
DELETE FROM `permissions`
  WHERE module = 'feedback'
    AND code IN (
      'feedback:list-page', 'feedback:stats-page',
      'feedback:batch-close',
      'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
    );

-- ============================================================
-- 二、升级 feedback 顶级节点为目录 (type=1)
-- ============================================================
UPDATE `permissions`
  SET `type` = 1, `path` = '/feedback'
  WHERE code = 'feedback';

-- ============================================================
-- 三、新增二级菜单（type=2）— 2 个页面入口
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:list-page', '反馈列表', 2, 'feedback', NULL, 'admin', '/feedback/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 10
UNION ALL
SELECT 'feedback:stats-page', '反馈统计', 2, 'feedback', NULL, 'admin', '/feedback/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 20;

-- ============================================================
-- 四、新增按钮/操作权限（type=3）— 1 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:batch-close', '批量关闭', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:list-page') t), 10;

-- ============================================================
-- 五、新增 API 权限（type=4）— 3 条
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:stats:overview', '反馈统计概览', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/stats/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:stats-page') t), 10
UNION ALL
SELECT 'feedback:stats:trend', '反馈统计趋势', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/stats/trend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:stats-page') t), 20
UNION ALL
SELECT 'feedback:pending-count', '待处理计数', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/pending-count', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:list-page') t), 50;

-- ============================================================
-- 六、角色 × 权限映射
-- ============================================================

-- 6.1 admin 角色：全部新增权限（6 条）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:batch-close',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- 6.2 operator 角色：全部新增权限（6 条）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:batch-close',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- 6.3 auditor 角色：只读（5 条，无 batch-close）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- ============================================================
-- 七、Seed 通知类型 BUSINESS_FEEDBACK_NEW
--    schema 对齐：见 018_add_notification_system.sql
--    - priority TINYINT (0=P0 1=P1 2=P2 3=P3)
--    - user_cancelable TINYINT(1) (0=强制 1=允许取消)
-- ============================================================
INSERT INTO `notification_types`
  (`code`, `name`, `description`, `category`, `default_channels`,
   `user_cancelable`, `priority`, `quiet_hour_policy`, `status`, `is_system`, `sort_order`)
SELECT 'BUSINESS_FEEDBACK_NEW', '新反馈提交', '有用户提交了新的反馈', 'business',
       JSON_ARRAY('in_app'), 1, 2, 'respect', 1, 1, 12
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE code = 'BUSINESS_FEEDBACK_NEW');

-- Seed 模板: BUSINESS_FEEDBACK_NEW in_app
--    schema 对齐：type_id (子查询取 id) / content_template / 必填 code/name/created_by
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`,
   `current_version`, `status`, `created_by`)
SELECT t.id,
       'BUSINESS_FEEDBACK_NEW_INAPP',
       '新反馈提交-站内信',
       'in_app',
       '收到新反馈',
       '用户提交了一条{{feedbackType}}类型的反馈：{{contentPreview}}',
       1, 1, 0
FROM `notification_types` t
WHERE t.code = 'BUSINESS_FEEDBACK_NEW'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_FEEDBACK_NEW_INAPP' AND channel = 'in_app'
  );

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 八、数据校验（手动执行）
-- ============================================================
-- SELECT code, name, type FROM `permissions` WHERE module = 'feedback' ORDER BY sort;
-- 期望: 1(目录) + 2(菜单) + 1(按钮) + 7(API,含原有4+新增3) = 11 条
--
-- SELECT r.code, COUNT(rp.permission_id) FROM `role_permissions` rp
--   JOIN `roles` r ON rp.role_id = r.id
--   JOIN `permissions` p ON rp.permission_id = p.id
--   WHERE p.module = 'feedback'
--   GROUP BY r.code;
-- 期望: admin=11, operator=11, auditor=8(无reply/update/delete/batch-close)
--
-- SELECT code, name, priority FROM `notification_types` WHERE code = 'BUSINESS_FEEDBACK_NEW';
-- SELECT code, channel, status FROM `notification_templates` WHERE code = 'BUSINESS_FEEDBACK_NEW_INAPP';

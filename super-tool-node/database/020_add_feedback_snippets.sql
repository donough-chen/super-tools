-- ============================================================
-- 迁移脚本: 020_add_feedback_snippets.sql
-- 版本: 3.2.0
-- 创建时间: 2026-05-21
-- 说明: 反馈回复常用话术管理模块
--   1) 5 张表（categories 树形 / snippets / versions / usage_logs / role_permissions）
--   2) RBAC 权限：1 个二级目录 + 2 个菜单 + 5 个按钮 + 14 个 API 权限
--   3) admin / operator / auditor 角色权限映射
--   4) Seed 4 个系统预置分类 + 6 条样板话术
-- 前置: 006_add_rbac_init.sql, 009_add_feedback_module.sql, 019_feedback_enhancement.sql
-- 注意: 本迁移幂等，可重复执行
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 一、建表（IF NOT EXISTS 幂等）
-- ============================================================

-- 1.1 话术分类（树形）
CREATE TABLE IF NOT EXISTS `feedback_snippet_categories` (
  `id`            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `parent_id`     BIGINT UNSIGNED   DEFAULT NULL COMMENT '父分类，NULL=顶级',
  `code`          VARCHAR(64)       NOT NULL COMMENT '业务编码',
  `name`          VARCHAR(50)       NOT NULL,
  `description`   VARCHAR(255)      DEFAULT NULL,
  `feedback_type` VARCHAR(20)       DEFAULT NULL COMMENT 'bug/suggestion/praise/other',
  `icon`          VARCHAR(64)       DEFAULT NULL,
  `color`         VARCHAR(16)       DEFAULT NULL,
  `sort_order`    INT               NOT NULL DEFAULT 0,
  `status`        TINYINT(1)        NOT NULL DEFAULT 1 COMMENT '0禁用 1启用',
  `is_system`     TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '系统预置不可删',
  `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME          DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`, `deleted_at`),
  KEY `idx_parent` (`parent_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='反馈话术分类（树形）';

-- 1.2 话术模板
CREATE TABLE IF NOT EXISTS `feedback_snippets` (
  `id`               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `category_id`      BIGINT UNSIGNED   NOT NULL,
  `code`             VARCHAR(64)       NOT NULL,
  `title`            VARCHAR(100)      NOT NULL,
  `content`          TEXT              NOT NULL COMMENT '支持 {{var}} 占位符',
  `tags`             VARCHAR(255)      DEFAULT NULL COMMENT '管道分隔，如 退款|订单|延迟',
  `sample_variables` JSON              DEFAULT NULL,
  `current_version`  INT               NOT NULL DEFAULT 1,
  `status`           TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '0草稿 1已发布 2已停用',
  `usage_count`      INT               NOT NULL DEFAULT 0,
  `last_used_at`     DATETIME          DEFAULT NULL,
  `description`      VARCHAR(500)      DEFAULT NULL,
  `created_by`       BIGINT UNSIGNED   NOT NULL,
  `updated_by`       BIGINT UNSIGNED   DEFAULT NULL,
  `created_at`       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME          DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`, `deleted_at`),
  KEY `idx_category_status` (`category_id`, `status`),
  KEY `idx_usage` (`usage_count`),
  KEY `idx_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='反馈话术模板';

-- 1.3 版本快照
CREATE TABLE IF NOT EXISTS `feedback_snippet_versions` (
  `id`               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `snippet_id`       BIGINT UNSIGNED   NOT NULL,
  `version`          INT               NOT NULL,
  `title`            VARCHAR(100)      NOT NULL,
  `content`          TEXT              NOT NULL,
  `tags`             VARCHAR(255)      DEFAULT NULL,
  `sample_variables` JSON              DEFAULT NULL,
  `change_note`      VARCHAR(500)      DEFAULT NULL,
  `published_by`     BIGINT UNSIGNED   NOT NULL,
  `published_at`     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_snippet_version` (`snippet_id`, `version`),
  KEY `idx_snippet` (`snippet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='反馈话术版本快照';

-- 1.4 使用记录
CREATE TABLE IF NOT EXISTS `feedback_snippet_usage_logs` (
  `id`                     BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `snippet_id`             BIGINT UNSIGNED   NOT NULL,
  `feedback_id`            BIGINT UNSIGNED   NOT NULL,
  `user_id`                BIGINT UNSIGNED   NOT NULL,
  `final_content`          TEXT              DEFAULT NULL,
  `feedback_status_after`  TINYINT           DEFAULT NULL COMMENT '2已回复 3已关闭',
  `created_at`             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_snippet_created` (`snippet_id`, `created_at`),
  KEY `idx_feedback` (`feedback_id`),
  KEY `idx_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='话术使用记录';

-- 1.5 分类角色访问限定（多对多）
CREATE TABLE IF NOT EXISTS `feedback_snippet_role_permissions` (
  `category_id` BIGINT UNSIGNED NOT NULL,
  `role_id`     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`category_id`, `role_id`),
  KEY `idx_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='话术分类角色访问限定';

-- ============================================================
-- 二、幂等清理 — 删除本脚本管理的权限及其角色映射
-- ============================================================
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'feedback' AND p.code LIKE 'feedback:snippet%';

DELETE FROM `permissions`
  WHERE module = 'feedback' AND code LIKE 'feedback:snippet%';

-- ============================================================
-- 三、新增二级目录（type=1）
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:snippet', '话术管理', 1, 'feedback', NULL, 'admin', '/feedback/snippets', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 30;

-- ============================================================
-- 四、新增二级菜单（type=2）— 2 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:snippet-page', '话术列表', 2, 'feedback', 'admin', '/feedback/snippets', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet') t), 10
UNION ALL
SELECT 'feedback:snippet-stats-page', '话术统计', 2, 'feedback', 'admin', '/feedback/snippets/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet') t), 20;

-- ============================================================
-- 五、新增按钮权限（type=3）— 5 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:snippet:manage', '管理话术(增删改)', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 10
UNION ALL
SELECT 'feedback:snippet:publish', '发布/回滚', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 20
UNION ALL
SELECT 'feedback:snippet:use', '使用话术', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 30
UNION ALL
SELECT 'feedback:snippet:import-export', '导入导出', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 40
UNION ALL
SELECT 'feedback:snippet:category:manage', '管理分类', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 50;

-- ============================================================
-- 六、新增 API 权限（type=4）— 14 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
-- 6.1 分类（5）
SELECT 'feedback:snippet:category:list', '分类树', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 100
UNION ALL
SELECT 'feedback:snippet:category:create', '新建分类', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 101
UNION ALL
SELECT 'feedback:snippet:category:update', '编辑分类', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 102
UNION ALL
SELECT 'feedback:snippet:category:delete', '删除分类', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 103
UNION ALL
SELECT 'feedback:snippet:category:role-perm', '配置分类角色权限', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories/:id/role-permissions', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 104
-- 6.2 话术（7）
UNION ALL
SELECT 'feedback:snippet:view', '话术列表/详情', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 110
UNION ALL
SELECT 'feedback:snippet:create', '新建话术', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 111
UNION ALL
SELECT 'feedback:snippet:update', '编辑话术', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 112
UNION ALL
SELECT 'feedback:snippet:delete', '删除话术', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 113
UNION ALL
SELECT 'feedback:snippet:render', '渲染预览', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/render', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 114
UNION ALL
SELECT 'feedback:snippet:usage', '使用记录', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/usage', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 115
UNION ALL
SELECT 'feedback:snippet:recommend', '智能推荐', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/recommend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 116
UNION ALL
SELECT 'feedback:snippet:picker', '话术选择器', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/picker', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 117
UNION ALL
SELECT 'feedback:snippet:publish-api', '发布版本', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/publish', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 118
UNION ALL
SELECT 'feedback:snippet:disable-api', '停用话术', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/disable', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 119
UNION ALL
SELECT 'feedback:snippet:rollback-api', '回滚版本', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/rollback/:versionId', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 120
UNION ALL
SELECT 'feedback:snippet:versions', '版本历史', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id/versions', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 121
UNION ALL
SELECT 'feedback:snippet:detail', '话术详情', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 122
UNION ALL
SELECT 'feedback:snippet:category:detail', '分类详情', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippet-categories/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 123
UNION ALL
SELECT 'feedback:snippet:import-api', '导入话术', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/import', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 131
-- 6.3 统计（1）
UNION ALL
SELECT 'feedback:snippet:stats', '话术统计', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/stats/*', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-stats-page') t), 120
-- 6.4 导入导出（1）
UNION ALL
SELECT 'feedback:snippet:export', '导入/导出', 4, 'feedback', 'admin',
       '/api/admin/feedback/snippets/export', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:snippet-page') t), 130;

-- ============================================================
-- 七、角色权限映射
-- ============================================================

-- 7.1 admin: 全部新增权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin' AND p.module = 'feedback' AND p.code LIKE 'feedback:snippet%';

-- 7.2 operator: 除 publish 与 import-export 外都给（包括关联的 API 权限）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator' AND p.module = 'feedback'
  AND p.code LIKE 'feedback:snippet%'
  AND p.code NOT IN (
    'feedback:snippet:publish',
    'feedback:snippet:publish-api',
    'feedback:snippet:disable-api',
    'feedback:snippet:rollback-api',
    'feedback:snippet:import-export',
    'feedback:snippet:import-api',
    'feedback:snippet:export'
  );

-- 7.3 auditor: 只读
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor' AND p.module = 'feedback'
  AND p.code IN (
    'feedback:snippet', 'feedback:snippet-page', 'feedback:snippet-stats-page',
    'feedback:snippet:view', 'feedback:snippet:detail', 'feedback:snippet:stats',
    'feedback:snippet:category:list', 'feedback:snippet:category:detail',
    'feedback:snippet:render', 'feedback:snippet:versions'
  );

-- ============================================================
-- 八、Seed 系统预置分类（4 个）
-- ============================================================
INSERT INTO `feedback_snippet_categories`
  (`code`, `name`, `description`, `feedback_type`, `sort_order`, `status`, `is_system`)
SELECT 'sys-bug',        'Bug 处理',  '处理 bug 类反馈的话术',     'bug',        10, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippet_categories` WHERE code='sys-bug')
UNION ALL
SELECT 'sys-suggestion', '功能建议',  '处理功能建议反馈的话术',     'suggestion', 20, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippet_categories` WHERE code='sys-suggestion')
UNION ALL
SELECT 'sys-praise',     '表扬感谢',  '处理表扬类反馈的话术',       'praise',     30, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippet_categories` WHERE code='sys-praise')
UNION ALL
SELECT 'sys-general',    '通用回复',  '不限反馈类型的通用回复',     NULL,         40, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippet_categories` WHERE code='sys-general');

-- ============================================================
-- 九、Seed 系统预置话术（每分类 1-2 条样板，created_by=0 表示系统）
-- ============================================================
INSERT INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-bug'),
       'sys-bug-confirm', '确认收到 Bug 反馈',
       '您好 {{userName}}！我们已收到您反馈的问题，技术团队正在排查处理，预计 24 小时内回复。感谢您的耐心。',
       'bug|确认|处理中', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-bug-confirm')
UNION ALL
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-bug'),
       'sys-bug-fixed', 'Bug 已修复',
       '您好 {{userName}}！您之前反馈的问题已在最新版本中修复，请更新后体验。如仍有问题请再联系我们。',
       'bug|已修复|更新', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-bug-fixed')
UNION ALL
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-suggestion'),
       'sys-suggest-thanks', '建议致谢',
       '您好 {{userName}}！感谢您提出的建议，我们会评估后纳入产品规划。一旦上线会通过站内信通知您。',
       '建议|感谢|规划', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-suggest-thanks')
UNION ALL
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-praise'),
       'sys-praise-thanks', '表扬致谢',
       '您好 {{userName}}！感谢您的肯定，这是对我们最大的鼓励！我们会继续努力为您提供更好的服务。',
       '表扬|感谢', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-praise-thanks')
UNION ALL
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-general'),
       'sys-general-received', '通用-已收到',
       '您好 {{userName}}！您的反馈我们已收到，将尽快处理并回复您。',
       '通用|已收到', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-general-received')
UNION ALL
SELECT (SELECT id FROM `feedback_snippet_categories` WHERE code='sys-general'),
       'sys-general-closed', '通用-处理完毕',
       '您好 {{userName}}！您反馈的问题已处理完毕，如有疑问欢迎随时联系我们。',
       '通用|完成', 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `feedback_snippets` WHERE code='sys-general-closed');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 十、数据校验（手动执行）
-- ============================================================
-- SELECT COUNT(*) FROM `feedback_snippet_categories` WHERE is_system=1;
-- 期望 4
--
-- SELECT COUNT(*) FROM `feedback_snippets` WHERE created_by=0;
-- 期望 6
--
-- SELECT code, name, type FROM `permissions`
-- WHERE module='feedback' AND code LIKE 'feedback:snippet%' ORDER BY sort;
-- 期望 22 条（1 dir + 2 menu + 5 button + 14 api）
--
-- SELECT r.code, COUNT(rp.permission_id) FROM `role_permissions` rp
-- JOIN `roles` r ON rp.role_id = r.id
-- JOIN `permissions` p ON rp.permission_id = p.id
-- WHERE p.module='feedback' AND p.code LIKE 'feedback:snippet%'
-- GROUP BY r.code;
-- 期望: admin=22, operator=19, auditor=7

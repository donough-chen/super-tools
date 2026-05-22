-- ============================================================
-- 迁移脚本: 020_add_feedback_snippets.sql
-- 版本: 3.2.0
-- 创建时间: 2026-05-21
-- 说明: 反馈回复常用话术管理模块
--   1) 5 张表（categories 树形 / snippets / versions / usage_logs / role_permissions）
--   2) RBAC 权限：1 个二级目录 + 2 个菜单 + 5 个按钮 + 14 个 API 权限
--   3) admin / operator / auditor 角色权限映射
--   4) Seed 4 个系统预置分类 + 29 条幽默友善的预置话术（Bug 8 / 建议 7 / 表扬 6 / 通用 8）
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
-- 三、新增二级目录（type=1）无
-- ============================================================

-- ============================================================
-- 四、新增二级菜单（type=2）— 2 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:snippet-page', '话术列表', 2, 'feedback', 'admin', '/feedback/snippets', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 10
UNION ALL
SELECT 'feedback:snippet-stats-page', '话术统计', 2, 'feedback', 'admin', '/feedback/snippets/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 20;

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
    'feedback:snippet-page', 'feedback:snippet-stats-page',
    'feedback:snippet:view', 'feedback:snippet:detail', 'feedback:snippet:stats',
    'feedback:snippet:category:list', 'feedback:snippet:category:detail',
    'feedback:snippet:render', 'feedback:snippet:versions'
  );

-- ============================================================
-- 八、Seed 系统预置话术分类（幂等写法，4个）
-- ============================================================
INSERT IGNORE INTO `feedback_snippet_categories`
  (`code`, `name`, `description`, `feedback_type`, `sort_order`, `status`, `is_system`)
VALUES
  ('sys-bug',        'Bug 处理',  '处理 bug 类反馈的话术',       'bug',        10, 1, 1),
  ('sys-suggestion', '功能建议',  '处理功能建议反馈的话术',       'suggestion', 20, 1, 1),
  ('sys-praise',     '表扬感谢',  '处理表扬类反馈的话术',         'praise',     30, 1, 1),
  ('sys-general',    '通用回复',  '不限反馈类型的通用回复',       NULL,         40, 1, 1);

-- ============================================================
-- 九、Seed 系统预置话术（覆盖 4 个分类，幽默友善风格，created_by=0 表示系统）
-- 可用变量：{{userName}} {{adminName}} {{currentDate}} {{feedbackId}} {{feedbackType}}
-- ============================================================

-- 9.1 Bug 反馈类（sys-bug）—— 8 条
INSERT IGNORE INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
VALUES
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-confirm',
    '确认收到 Bug 反馈',
    'Hi {{userName}}~ 您反馈的小 bug 已经被我们抓住啦🐛！技术小哥哥已经撸起袖子开始排查，预计 24 小时内会有进展回复。编号 #{{feedbackId}}，可以随时催更哦~',
    'bug|确认|收到', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-investigating',
    'Bug 复现中',
    'Hi {{userName}}~ 我们正在使出洪荒之力复现这个 bug 🔍！为了精准抓虫，可能还需要您补充一下：操作步骤、设备型号、出现时间。您的协助就是我们最强的武器！',
    'bug|复现|信息补充', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-progress',
    'Bug 处理进度同步',
    '{{userName}} 您好~ 关于您反馈的 bug，进度同步一下：技术团队已经定位到问题原因，正在加紧修复中💪。预计下个版本就能和这个 bug 说拜拜啦！',
    'bug|进度|处理中', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-fixed',
    'Bug 已修复',
    '🎉 喜报！{{userName}} 您反馈的 bug 已经被我们成功"消灭"！请更新到最新版本体验。如果发现这个 bug 又卷土重来，请马上 cue 我们，绝不姑息！',
    'bug|已修复|更新', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-cannot-reproduce',
    'Bug 暂无法复现',
    'Hi {{userName}}~ 我们用了十八般武艺也没复现出您说的问题😅。麻烦您下次遇到时，截个图或录个屏发给我们好吗？这能帮我们更快揪出问题元凶！',
    'bug|无法复现|信息补充', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-not-bug',
    '非 Bug 解释',
    '亲爱的 {{userName}}~ 经过我们一番"侦探"调查，您遇到的情况其实是设计内的功能哦~ 这里附上使用说明，希望能帮到您。如果您觉得这设计还可以更好，欢迎继续提建议！',
    'bug|非bug|功能说明', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-urgent-handling',
    '紧急 Bug 加急处理',
    '{{userName}} 您好！您反馈的问题已被我们标记为🔥加急🔥，技术团队正在 ALL IN 处理中。为了避免影响您使用，建议先尝试[临时方案]，修复完成后第一时间通知您！',
    'bug|紧急|加急', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-thanks',
    'Bug 反馈致谢',
    '{{userName}} 真是火眼金睛！🎯 这个 bug 藏得这么深都被您发现了，简直是隐藏的"测试工程师"！为表谢意，我们会持续优化产品，让您用得更舒心~',
    'bug|致谢|表彰', 1, 1, 0
  );

-- 9.2 建议类（sys-suggestion）—— 7 条
INSERT IGNORE INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
VALUES
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-thanks',
    '建议致谢',
    'Hi {{userName}}~ 您的建议我们已经收到，不夸张地说真的很赞👍！产品经理看到时眼睛都亮了～我们会认真评估后纳入规划，一旦实现立刻通知您！',
    '建议|感谢|规划', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-evaluating',
    '建议评估中',
    '{{userName}} 您好~ 您提出的建议我们正在内部头脑风暴评估中🧠💭。涉及到产品体验、技术实现、用户需求等多方权衡，请给我们一些时间，结果出来第一时间同步~',
    '建议|评估|规划', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-adopted',
    '建议被采纳',
    '🎊 重磅好消息！{{userName}}，您的建议已经被产品团队正式采纳啦！将在后续版本中实现，到时候您就是这个功能的"教父/教母"，是不是很有成就感？',
    '建议|采纳|喜报', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-released',
    '建议功能已上线',
    'Hi {{userName}}！还记得您之前提的建议吗？它已经从想法变成了现实🚀！请更新到最新版本体验，期待听到您试用后的感受~',
    '建议|上线|发布', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-deferred',
    '建议暂缓实施',
    '{{userName}} 您好~ 您的建议非常有价值💡，但综合当前的研发节奏，我们决定先把它放进"宝藏需求池"，等技术条件成熟后再启动。我们会持续关注，绝不让好点子蒙尘！',
    '建议|暂缓|规划', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-not-adopted',
    '建议婉拒说明',
    '亲爱的 {{userName}}~ 您的建议我们认真讨论过，但综合产品方向、用户群体等因素考虑，暂时不会实现😢。这绝不代表您的想法不好，期待您继续给我们提宝贵建议！',
    '建议|婉拒|说明', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-need-detail',
    '建议详情请补充',
    'Hi {{userName}}~ 您的建议方向我们 get 到了！但为了确保实现的功能正中您的"靶心"🎯，能否再详细描述一下使用场景和期望效果呢？细节越多，我们做得越准！',
    '建议|补充|详情', 1, 1, 0
  );

-- 9.3 表扬类（sys-praise）—— 6 条
INSERT IGNORE INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
VALUES
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-thanks',
    '表扬致谢',
    '{{userName}} 您的表扬被我们收到啦！整个团队都笑开花了🌸，看到您的肯定，所有加班加点都值得了！我们会继续打磨产品，让您用得更香~',
    '表扬|感谢|鼓励', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-team',
    '团队致谢',
    'Hi {{userName}}~ 收到您的好评，整个团队像被打了一针强心剂💉！我们已经把您的留言截图贴在墙上当"月度勋章"啦，谢谢您的厚爱~',
    '表扬|团队|鼓励', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-modest',
    '谦虚回礼',
    '哎呀 {{userName}}~ 您这么夸我们都要不好意思啦😊！其实产品还有很多可以优化的地方，您的肯定就是我们继续努力的最大动力。还请继续监督我们呀~',
    '表扬|谦虚|互动', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-encouragement',
    '互相鼓励',
    '{{userName}} 您的肯定就是我们最好的"燃料"⛽！有这么棒的用户支持，我们一定会带来更多惊喜。如果您身边的小伙伴也有需要，欢迎安利给他们哦~',
    '表扬|鼓励|推荐', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-share',
    '邀请分享体验',
    '亲爱的 {{userName}}~ 谢谢您喜欢我们的产品❤️！如果您愿意把使用体验分享给身边的朋友，那简直是给我们最棒的礼物！我们会以更好的产品来回报~',
    '表扬|分享|邀请', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-future',
    '展望未来',
    '{{userName}} 谢谢您一路以来的陪伴和支持！🥰 您的每一句鼓励我们都记在心里，未来我们会继续推出更多好玩好用的功能，敬请期待！',
    '表扬|展望|陪伴', 1, 1, 0
  );

-- 9.4 通用类（sys-general）—— 8 条
INSERT IGNORE INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
VALUES
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    '1',
    '通用-已收到',
    'Hi {{userName}}~ 您的反馈（编号 #{{feedbackId}}）我们已经收到啦📬！客服小蜜蜂正在飞速安排处理，请稍候片刻~',
    '通用|已收到|确认', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-processing',
    '通用-处理中',
    '{{userName}} 您好~ 您的反馈正在马不停蹄地处理中🐎！为了给您一个满意的答复，我们需要一些时间，请耐心等待，最迟 {{currentDate}} 之前给您回复~',
    '通用|处理中|等待', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-closed',
    '通用-处理完毕',
    '🎉 {{userName}} 您好！您反馈的问题已经处理完毕，如果还有任何疑问，随时呼唤我们，我们 7×24 小时（其实是工作时间啦😉）待命！',
    '通用|完成|关闭', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-need-info',
    '通用-补充信息',
    'Hi {{userName}}~ 为了更精准地帮您解决问题🔍，能否再补充一些信息呢？比如：操作步骤、出现时间、截图等。提供越多线索，我们破案越快！',
    '通用|补充|信息', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-apology',
    '通用-真诚致歉',
    '{{userName}} 真的很抱歉给您带来了不好的体验😔。我们一定会认真处理这个问题，并以此为戒不断改进。希望您能再给我们一次让您满意的机会！',
    '通用|致歉|改进', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-transferred',
    '通用-转交处理',
    'Hi {{userName}}~ 您的反馈很专业，我们已经把它转交给对应的专业团队进行处理了🔄。{{adminName}} 会全程跟进，有进展第一时间同步给您~',
    '通用|转交|跟进', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-followup',
    '通用-后续跟进',
    '{{userName}} 您好~ 想跟您 follow up 一下之前反馈的问题👀。请问目前的解决方案是否解决了您的困扰？如果还有任何问题，请尽管告诉我们~',
    '通用|跟进|回访', 1, 1, 0
  ),
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-friendly-close',
    '通用-友好结束语',
    '感谢 {{userName}} 选择我们的产品~ 您的每一条反馈都让我们变得更好✨。期待与您下次相遇，祝您天天有好心情！',
    '通用|结束|祝福', 1, 1, 0
  );

  -- ============================================================
-- 系统预置客服话术（共 30 条，系统内置 created_by=0）
-- 分类：Bug处理(8) | 功能建议(7) | 表扬感谢(6) | 通用回复(9)
-- ============================================================

INSERT IGNORE INTO `feedback_snippets`
  (`category_id`, `code`, `title`, `content`, `tags`, `current_version`, `status`, `created_by`)
VALUES

-- ============================================================
-- 🐛 Bug 处理类（sys-bug）共 8 条
-- ============================================================

  -- 1. 收到 Bug 反馈，安抚 + 承诺
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-received',
    'Bug 已收到，正在处理',
    '嗨 {{userName}}！您好，您反馈的 Bug（#{{feedbackId}}）我们已经稳稳接住了🫴 技术同学正在撸起袖子排查，请稍等片刻，我们会尽快给您回音！',
    'bug|已收到|处理中', 1, 1, 0
  ),

  -- 2. 无法复现，请求更多信息
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-need-info',
    '需要更多信息复现问题',
    '嗨 {{userName}}！感谢您的反馈 🙏 我们的技术侦探正在努力复现这个问题，但目前还没抓到"案发现场"。能麻烦您提供一下：①操作步骤 ②设备型号/浏览器版本 ③截图或录屏？有了这些线索，我们一定能更快破案！',
    'bug|需要信息|复现', 1, 1, 0
  ),

  -- 3. 已定位问题，开发中
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-locating',
    '问题已定位，修复中',
    '好消息 {{userName}}！🎯 您反馈的 Bug（#{{feedbackId}}）已经被我们的技术团队成功"抓获"，目前正在紧急修复中。预计 {{currentDate}} 前完成，修好后第一时间通知您，请稍候！',
    'bug|已定位|修复中', 1, 1, 0
  ),

  -- 4. Bug 已修复，通知验证
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-fixed1',
    'Bug 已修复，请验证',
    '{{userName}} 好消息！🎉 您之前反馈的问题（#{{feedbackId}}）已经被我们消灭了！请更新到最新版本后体验一下，如果还有任何不对劲，随时告诉我们，我们继续"追杀"它！',
    'bug|已修复|请验证', 1, 1, 0
  ),

  -- 5. 已知问题，列入计划
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-known-issue',
    '已知问题，列入修复计划',
    '嗨 {{userName}}！感谢您的反馈 🙌 这个问题我们已经记录在案，目前已列入修复计划。虽然不能给您一个精确的"交货日期"，但我们绝对不会把它遗忘在角落里！修复后会第一时间通知您。',
    'bug|已知问题|计划中', 1, 1, 0
  ),

  -- 6. 非 Bug，属于预期行为
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-by-design',
    '非 Bug，属于预期设计',
    '嗨 {{userName}}！感谢您认真的反馈 😊 经过技术同学的仔细核查，这个行为其实是我们有意为之的设计～ 不过您的疑惑让我们意识到这里的体验可能不够直观，我们会考虑优化说明文案。如果还有其他问题欢迎继续反馈！',
    'bug|预期行为|设计如此', 1, 1, 0
  ),

  -- 7. 紧急 Bug，优先处理
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-urgent',
    '紧急 Bug，优先处理',
    '{{userName}} 您好！🚨 您反馈的问题（#{{feedbackId}}）我们已标记为紧急，技术团队正在放下手头一切事务优先处理！我们深知这影响了您的正常使用，非常抱歉。预计最快 2 小时内给您回复进展，请稍候！',
    'bug|紧急|优先处理', 1, 1, 0
  ),

  -- 8. Bug 关闭，感谢协助
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-bug'),
    'sys-bug-closed',
    'Bug 处理完毕，感谢协助',
    '{{userName}} 您好！此次 Bug（#{{feedbackId}}）已完整处理完毕 ✅ 非常感谢您的耐心配合和详细描述，正是有像您这样认真的用户，我们的产品才能越来越好！如果后续还有任何问题，随时欢迎反馈 🎊',
    'bug|已关闭|感谢', 1, 1, 0
  ),


-- ============================================================
-- 💡 功能建议类（sys-suggestion）共 7 条
-- ============================================================

  -- 9. 收到建议，表示感谢
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-received',
    '建议已收到，感谢提议',
    '嗨 {{userName}}！您的建议（#{{feedbackId}}）已经安全降落到我们的需求池 🛬 产品团队会认真评估，您的每一个想法对我们来说都是宝贵的灵感来源！感谢您愿意花时间帮我们变得更好 💪',
    '建议|已收到|感谢', 1, 1, 0
  ),

  -- 10. 建议评估中
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-evaluating1',
    '建议评估中',
    '{{userName}} 您好！您提出的建议（#{{feedbackId}}）目前正在产品团队的"会议桌"上热烈讨论中 🤔 我们会综合考虑可行性和用户需求，评估完成后会第一时间告知您结果，请稍候！',
    '建议|评估中|讨论', 1, 1, 0
  ),

  -- 11. 建议已采纳，列入规划
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-accepted',
    '建议已采纳，列入规划',
    '{{userName}} 大好消息！🎊 您的建议（#{{feedbackId}}）已经被产品团队正式采纳，并列入了我们的产品规划！感谢您的精彩创意，您已经成功影响了产品的未来走向。功能上线后我们会第一时间通知您来体验！',
    '建议|已采纳|规划中', 1, 1, 0
  ),

  -- 12. 建议功能已上线
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-launched',
    '建议功能已上线',
    '{{userName}} 您好！🚀 还记得您之前提的建议（#{{feedbackId}}）吗？它已经正式上线啦！您的想法变成了现实，快去体验一下吧～ 如果有任何使用感受，欢迎继续告诉我们，您就是我们最好的产品经理！',
    '建议|已上线|体验', 1, 1, 0
  ),

  -- 13. 建议暂不采纳，说明原因
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-declined',
    '建议暂不采纳，说明原因',
    '{{userName}} 您好！感谢您的建议（#{{feedbackId}}）🙏 经过团队认真讨论，由于目前的技术架构和产品方向，这个功能暂时无法纳入近期规划。但我们已将您的建议完整保留，未来方向调整时会重新评估。感谢您的理解！',
    '建议|暂不采纳|说明', 1, 1, 0
  ),

  -- 14. 建议重复，合并处理
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-duplicated',
    '建议已有相似需求，合并跟进',
    '嗨 {{userName}}！您的建议（#{{feedbackId}}）和我们收到的另一个需求不谋而合 🤝 说明这个功能真的很受欢迎！我们已将您的建议合并跟进，一旦有进展会统一通知所有提出过类似建议的用户，包括您！',
    '建议|重复|合并', 1, 1, 0
  ),

  -- 15. 邀请参与内测
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-suggestion'),
    'sys-suggest-beta-invite',
    '邀请参与新功能内测',
    '{{userName}} 您好！🎁 您之前提出的建议（#{{feedbackId}}）相关功能即将内测，作为最早提出这个想法的用户，我们诚挚邀请您成为第一批体验者！如果您有兴趣，请回复确认，我们会为您开通内测权限～',
    '建议|内测|邀请', 1, 1, 0
  ),


-- ============================================================
-- 🌟 表扬感谢类（sys-praise）共 6 条
-- ============================================================

  -- 16. 收到表扬，真诚感谢
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-received',
    '收到表扬，真诚感谢',
    '{{userName}} 您好！收到您的表扬，我们整个团队都开心得像个孩子 🥳 您的认可是我们最大的动力！我们会继续努力，让产品越来越好，不辜负您的期待！',
    '表扬|感谢|鼓励', 1, 1, 0
  ),

  -- 17. 表扬转达团队
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-relay',
    '表扬已转达团队',
    '{{userName}} 您好！您的表扬（#{{feedbackId}}）我已经第一时间转达给了团队 📢 大家听到后都非常开心，说要更加努力！有您这样的用户支持，我们干劲满满。如果有任何需要改进的地方，也欢迎随时告诉我们！',
    '表扬|转达|团队', 1, 1, 0
  ),

  -- 18. 感谢长期支持
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-loyal-user',
    '感谢长期支持',
    '{{userName}} 您好！感谢您一直以来对我们的支持与厚爱 ❤️ 能有您这样的忠实用户，是我们最大的幸运！我们会持续优化产品体验，希望能一直陪伴您。如果有任何想法或建议，随时欢迎告诉我们！',
    '表扬|长期支持|忠实用户', 1, 1, 0
  ),

  -- 19. 感谢分享推荐
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-referral',
    '感谢分享推荐',
    '{{userName}} 您好！听说您把我们推荐给了身边的朋友，真的非常感谢 🙌 口碑相传是对我们最高的认可！您的每一次推荐都让我们倍感温暖，我们会继续努力，让您推荐出去的产品不让您失望！',
    '表扬|推荐|口碑', 1, 1, 0
  ),

  -- 20. 感谢详细反馈
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-detailed-feedback',
    '感谢提供详细反馈',
    '{{userName}} 您好！非常感谢您提供如此详细的反馈 📝 您的认真程度让我们深受感动！这些宝贵的意见对我们改进产品有极大帮助。有您这样用心的用户，我们做产品的信心又增加了一大截！',
    '表扬|详细反馈|用心', 1, 1, 0
  ),

  -- 21. 回应好评，送上福利
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-praise'),
    'sys-praise-gift',
    '感谢好评，回赠小惊喜',
    '{{userName}} 您好！收到您的好评，我们真的超级开心 🎉 作为感谢，我们为您准备了一个小小的惊喜，请留意您的账户消息。感谢您一直以来的支持，我们会继续努力，不让您失望！',
    '表扬|好评|福利', 1, 1, 0
  ),


-- ============================================================
-- 💬 通用回复类（sys-general）共 9 条
-- ============================================================

  -- 22. 通用确认收到
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-received1',
    '通用-已收到反馈',
    '嗨 {{userName}}！您的反馈（#{{feedbackId}}）我们已经稳稳接收到了 ✅ 相关同学会尽快跟进处理，有任何进展我们会第一时间通知您。感谢您花时间告诉我们！',
    '通用|已收到|确认', 1, 1, 0
  ),

  -- 23. 处理中，请耐心等待
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-processing1',
    '通用-处理中',
    '{{userName}} 您好！您的反馈（#{{feedbackId}}）正在处理中 ⚙️ 我们的小伙伴正在认真对待每一个细节，请再给我们一点点时间。感谢您的耐心，我们不会让您久等的！',
    '通用|处理中|等待', 1, 1, 0
  ),

  -- 24. 处理完毕，关闭反馈
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-closed1',
    '通用-处理完毕',
    '{{userName}} 您好！您的反馈（#{{feedbackId}}）已处理完毕 🎊 如果您觉得问题已解决，欢迎关闭此反馈。如果还有任何疑问或新的问题，随时欢迎再次联系我们，我们永远在线！',
    '通用|已完成|关闭', 1, 1, 0
  ),

  -- 25. 转交对应部门
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-transferred1',
    '通用-已转交对应部门',
    '{{userName}} 您好！您的反馈（#{{feedbackId}}）需要由专业的小伙伴来处理，我已经帮您转交给对应团队了 🔄 他们会尽快与您联系，请稍候。感谢您的耐心等待！',
    '通用|已转交|部门', 1, 1, 0
  ),

  -- 26. 节假日自动回复
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-holiday',
    '节假日自动回复',
    '{{userName}} 您好！🎊 感谢您的反馈（#{{feedbackId}}）！目前我们的小伙伴正在享受假期，将于节后第一个工作日恢复处理。如有紧急问题，请发送邮件至客服邮箱。祝您假期愉快！',
    '通用|节假日|自动回复', 1, 1, 0
  ),

  -- 27. 请求补充信息
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-need-more-info',
    '通用-请补充更多信息',
    '{{userName}} 您好！感谢您的反馈 🙏 为了让我们能更准确地帮助您，能否麻烦您补充一些信息？比如：①具体操作步骤 ②问题发生的时间 ③相关截图。有了这些，我们能更快找到解决方案！',
    '通用|需要信息|补充', 1, 1, 0
  ),

  -- 28. 感谢耐心等待
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-thanks-waiting',
    '感谢耐心等待',
    '{{userName}} 您好！非常感谢您的耐心等待 🙏 我们深知让您久等了，对此深感抱歉。您的反馈（#{{feedbackId}}）我们一直放在心上，相关进展会尽快同步给您！',
    '通用|感谢等待|抱歉', 1, 1, 0
  ),

  -- 29. 问题确认解决，请求关闭
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-confirm-resolved',
    '确认问题是否已解决',
    '{{userName}} 您好！距离您提交反馈（#{{feedbackId}}）已经过去一段时间了，想来确认一下您的问题是否已经得到解决？😊 如果已解决，欢迎关闭此反馈；如果还有问题，请告诉我们，我们继续跟进！',
    '通用|确认解决|跟进', 1, 1, 0
  ),

  -- 30. 邀请评价服务
  (
    (SELECT id FROM `feedback_snippet_categories` WHERE code = 'sys-general'),
    'sys-general-rate-service',
    '邀请评价本次服务',
    '{{userName}} 您好！本次反馈（#{{feedbackId}}）已处理完毕，不知道我们的服务让您满意吗？⭐ 如果方便的话，欢迎对本次服务做个简单评价，您的反馈将帮助我们不断改进服务质量。感谢您的支持！',
    '通用|邀请评价|服务质量', 1, 1, 0
  );

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 十、数据校验（手动执行）
-- ============================================================
-- SELECT COUNT(*) FROM `feedback_snippet_categories` WHERE is_system=1;
-- 期望 4
--
-- SELECT COUNT(*) FROM `feedback_snippets` WHERE created_by=0;
-- 期望 29（Bug 8 + 建议 7 + 表扬 6 + 通用 8）
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

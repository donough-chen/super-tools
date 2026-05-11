-- ============================================================
-- 009_add_feedback_module.sql
-- Spec-A2 · 反馈与数据统计
-- 作用：
--   1) 新建 feedbacks 表（用户反馈表，含软删字段）
--   2) 新增 feedback:update 权限码（PUT /api/admin/feedbacks/:id）
--   3) 给 admin/operator 角色授予 feedback:update 权限
-- 注意：
--   - super_admin 用短路逻辑无需显式授予
--   - auditor 只读，本权限不授予
--   - 本迁移幂等：可重复执行
-- ============================================================

-- ------------------------------------------------------------
-- 1. 建表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `feedbacks` (
  `id`             BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT UNSIGNED   DEFAULT NULL COMMENT '提交用户(匿名为 NULL)',
  `type`           VARCHAR(20)       NOT NULL DEFAULT 'other'
                   COMMENT '分类: bug/suggestion/praise/other',
  `content`        TEXT              NOT NULL COMMENT '反馈内容',
  `contact`        VARCHAR(100)      DEFAULT NULL COMMENT '联系方式(邮箱/手机)',
  `platform`       VARCHAR(30)       DEFAULT NULL COMMENT '来源: admin/tool-box/micro-tools',
  `ip`             VARCHAR(50)       DEFAULT NULL,
  `user_agent`     VARCHAR(500)      DEFAULT NULL,
  `status`         TINYINT UNSIGNED  NOT NULL DEFAULT 0
                   COMMENT '0待处理 1处理中 2已回复 3已关闭',
  `reply_content`  TEXT              DEFAULT NULL COMMENT '回复内容',
  `reply_user_id`  BIGINT UNSIGNED   DEFAULT NULL COMMENT '回复人',
  `replied_at`     DATETIME          DEFAULT NULL,
  `created_at`     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     DATETIME          DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id`    (`user_id`),
  INDEX `idx_type`       (`type`),
  INDEX `idx_status`     (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户反馈表';

-- ------------------------------------------------------------
-- 2. 新增 feedback:update 权限码
-- ------------------------------------------------------------
INSERT INTO `permissions` (code, name, type, module, platform, path, method, parent_id, sort)
SELECT 'feedback:update', '更新反馈状态', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 15
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE code = 'feedback:update');

-- ------------------------------------------------------------
-- 3. 给 admin/operator 角色授予 feedback:update
-- ------------------------------------------------------------
INSERT INTO `role_permissions` (role_id, permission_id)
SELECT r.id, p.id
FROM `roles` r, `permissions` p
WHERE r.code IN ('admin', 'operator') AND p.code = 'feedback:update'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ------------------------------------------------------------
-- 4. 验证（可选，用于开发期手工核对）
-- ------------------------------------------------------------
-- SELECT 'feedbacks 表行数' AS metric, COUNT(*) AS value FROM feedbacks;
-- SELECT 'feedback:update 是否存在' AS metric, COUNT(*) AS value FROM permissions WHERE code='feedback:update';
-- SELECT r.code AS role, p.code AS permission
-- FROM role_permissions rp
-- INNER JOIN roles r       ON r.id = rp.role_id
-- INNER JOIN permissions p ON p.id = rp.permission_id
-- WHERE p.code = 'feedback:update';

-- ============================================================================
-- 026 · 积分成长体系后端优化迁移
--
-- 设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md
-- 实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md §Task A1
-- 上线时间: 2026-05-?? 灰度（5% → 50% → 100%）
--
-- 注意事项:
--   1. 执行前先备份 points_logs / user_members / member_levels / tasks /
--      points_mall_orders / notification_templates
--   2. ALTER points_logs.balance / user_members.points 改 SIGNED:
--      MySQL 8.0+ 是 INSTANT；5.7 是 INPLACE 在线 DDL
--   3. 执行前必跑数据校验 SELECT MAX(balance) FROM points_logs（必须 < 2147483647）
--
-- ----------------------------------------------------------------------------
-- 与 Plan/Spec 的偏差修正记录（基于实际 schema 校验）：
--   修正 1: points_mall_orders.idx_fulfill_status 在 025 中已存在为单列索引；
--           本次先 DROP 再 ADD 复合索引 (fulfill_status, created_at)
--           （原 spec 仅 ADD INDEX，会导致 Duplicate key name 报错）
--   修正 2: member_levels.level 列在 003 中已建并已有种子值；本次保留 IF NOT
--           EXISTS 防御逻辑（无害幂等），仅 UPDATE 校正可能错位的 level 值
--   修正 3: notification_templates 字段名是 content_template（非 spec 写的
--           content）；模板 code 是 BUSINESS_POINTS_EXPIRED_INAPP（非 type
--           code BUSINESS_POINTS_EXPIRED）；当前内容也不含"您有积分过期"这
--           个串。直接整体替换为含 {{points}} 变量的版本。
-- ============================================================================

-- ===== 数据校验 SQL（执行前手动跑一次，确认 < 2147483647）=====
-- SELECT MAX(balance) AS max_balance, MIN(balance) AS min_balance FROM points_logs;
-- SELECT MAX(points)  AS max_points  FROM user_members;

START TRANSACTION;

-- =========================================================================
-- §3.3 schema 变更
-- =========================================================================

-- #1: balance 改 SIGNED（允许负值，对账锚点）
ALTER TABLE `points_logs`
  MODIFY COLUMN `balance` INT NOT NULL DEFAULT 0
  COMMENT '余额（含负值，对账锚点）';

-- #2: user_members.points 改 SIGNED（理论值与实际值统一）
ALTER TABLE `user_members`
  MODIFY COLUMN `points` INT NOT NULL DEFAULT 0
  COMMENT '当前积分余额（含负值）';

-- #16: 领域事件追溯表
CREATE TABLE IF NOT EXISTS `domain_events` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_code`  VARCHAR(64)     NOT NULL COMMENT '事件代码（与 eventCodes.ts 常量对齐）',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '关联用户ID',
  `payload`     JSON                     COMMENT '事件原始 payload',
  `status`      ENUM('emitted','dispatched','failed') NOT NULL DEFAULT 'emitted',
  `retry_count` INT UNSIGNED    NOT NULL DEFAULT 0,
  `last_error`  TEXT,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_event`   (`user_id`, `event_code`, `created_at`),
  INDEX `idx_status_time`  (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领域事件追溯表';

-- #24: points_mall_orders 加复合索引 (fulfill_status, created_at)
-- 修正 1：025 已有单列 idx_fulfill_status，先 DROP 再 ADD（条件式以保幂等）
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'points_mall_orders'
    AND INDEX_NAME   = 'idx_fulfill_status'
);
SET @sql := IF(@idx_exists > 0,
  'ALTER TABLE `points_mall_orders` DROP INDEX `idx_fulfill_status`',
  'SELECT "idx_fulfill_status not exists, skip drop"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `points_mall_orders`
  ADD INDEX `idx_fulfill_status` (`fulfill_status`, `created_at`);

-- #23: member_levels 增 level 数值列（修正 2：003 已建，IF NOT EXISTS 防御）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'member_levels'
    AND COLUMN_NAME  = 'level'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `member_levels` ADD COLUMN `level` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `code`',
  'SELECT "member_levels.level already exists, skip add"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 校正 level 值（free=0/silver=1/gold=2/diamond=3/black=4）
UPDATE `member_levels` SET `level` = CASE `code`
  WHEN 'free'    THEN 0
  WHEN 'silver'  THEN 1
  WHEN 'gold'    THEN 2
  WHEN 'diamond' THEN 3
  WHEN 'black'   THEN 4
  ELSE `level` END
WHERE `code` IN ('free','silver','gold','diamond','black');

-- =========================================================================
-- §3.4 数据修正
-- =========================================================================

-- #3: gold 等级 points_expire_days 笔误（456 → 540）
UPDATE `member_levels`
SET `benefits` = JSON_SET(`benefits`, '$.points_expire_days', 540)
WHERE `code` = 'gold';

-- #19: 修正 3：notification_templates 模板内容补 {{points}} 变量
--   字段名 content_template（非 content）
--   模板 code BUSINESS_POINTS_EXPIRED_INAPP（非 type_code BUSINESS_POINTS_EXPIRED）
--   原内容: '您的部分积分已于 {{date}} 过期清零。可前往「积分流水」查看详情。'
UPDATE `notification_templates`
SET `content_template` = '您有 {{points}} 积分已于 {{date}} 过期清零。可前往「积分流水」查看详情。'
WHERE `code` = 'BUSINESS_POINTS_EXPIRED_INAPP'
  AND `channel` = 'in_app'
  AND `deleted_at` IS NULL;

-- =========================================================================
-- §3.5 任务种子（#4 / #5 / #34）
-- =========================================================================

-- 说明：与 025 §4 已有 17 条任务做去重比对：
--   ✗ consume_milestone_500  与 025 `achieve_consume_500` 重复（同事件 + 同阈值），剔除
--   ✓ achieve_consume_1000   025 缺失 1000 档，补齐（code 改为 achieve_consume_* 命名一致）
--   ✓ achieve_consume_3000   025 缺失 3000 档，补齐（code 改为 achieve_consume_* 命名一致）
--   ✗ year_active            与 025 `yearly_active` 重复（同事件 daily_login + yearly），剔除
--   ✓ subscribe_renewal      025 仅有首订阅 `achieve_first_subscribe`，续费奖励是新增
--   ✓ register_complete      025 无注册欢迎奖励，新增
INSERT IGNORE INTO `tasks`
  (`code`, `name`, `icon`, `description`, `category`, `trigger_event`, `condition`,
   `progress_type`, `progress_target`, `reward_points`, `reward_growth`,
   `reset_cycle`, `daily_cap_group`, `status`, `sort`)
VALUES
  ('achieve_consume_1000',   '累计消费满1000元', '🛒', '累计消费达到1000元', 'achievement', 'consume_milestone', '{"amount":1000}', 3, 1000, 300, 100, 'once', NULL, 1, 75),
  ('achieve_consume_3000',   '累计消费满3000元', '🛒', '累计消费达到3000元', 'achievement', 'consume_milestone', '{"amount":3000}', 3, 3000, 1000,300, 'once', NULL, 1, 85),
  ('subscribe_renewal',      '订阅续费',         '🔁', '会员订阅续费奖励',    'achievement', 'subscribe_renewal', '{}',              1, 1,    200, 50,  'once', NULL, 1, 110),
  ('register_complete',      '完成注册',         '🎉', '欢迎奖励',           'newbie',      'register',          '{}',              1, 1,    100, 50,  'once', NULL, 1, 1);

-- =========================================================================
-- §3.6 system_configs 默认值
-- =========================================================================

INSERT IGNORE INTO `system_configs` (`group`, `key`, `value`, `description`)
VALUES ('points', 'daily_cap_invite', '5', '邀请类奖励单日次数上限');

COMMIT;

-- ============================================================================
-- ===== DOWN SQL（一次性使用，灰度失败时回滚）=====
-- ============================================================================
/*
-- 1) 列回 UNSIGNED（注意：执行前需确保无负值，否则会被截断为 0）
ALTER TABLE `points_logs`   MODIFY COLUMN `balance` INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE `user_members`  MODIFY COLUMN `points`  INT UNSIGNED NOT NULL DEFAULT 0;

-- 2) 删 domain_events 表
DROP TABLE IF EXISTS `domain_events`;

-- 3) 还原索引（先 DROP 复合，再 ADD 单列）
ALTER TABLE `points_mall_orders` DROP INDEX `idx_fulfill_status`;
ALTER TABLE `points_mall_orders` ADD  INDEX `idx_fulfill_status` (`fulfill_status`);

-- 4) member_levels.level 不需要 DROP（003 已建，与本次解耦）

-- 5) gold expire_days 还原
UPDATE `member_levels`
SET `benefits` = JSON_SET(`benefits`, '$.points_expire_days', 456)
WHERE `code` = 'gold';

-- 6) notification 模板还原
UPDATE `notification_templates`
SET `content_template` = '您的部分积分已于 {{date}} 过期清零。可前往「积分流水」查看详情。'
WHERE `code` = 'BUSINESS_POINTS_EXPIRED_INAPP'
  AND `channel` = 'in_app'
  AND `deleted_at` IS NULL;

-- 7) 删任务种子
DELETE FROM `tasks` WHERE `code` IN (
  'achieve_consume_1000','achieve_consume_3000',
  'subscribe_renewal','register_complete'
);

-- 8) 删配置
DELETE FROM `system_configs` WHERE `group`='points' AND `key`='daily_cap_invite';
*/

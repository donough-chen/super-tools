-- ============================================================
-- 迁移脚本: 025b_seed_points_notification_templates.sql
-- 版本: 2.3.2
-- 创建时间: 2026-05-27
-- 说明: 为 v2 主体 Task 1 注册的 6 个 BUSINESS_POINTS_* / BUSINESS_TASK_*
--       / BUSINESS_LEVEL_UP / BUSINESS_MALL_FULFILLED 通知类型补全
--       实际的渠道路由（in_app / sms）+ 标题 + 正文模板。
--
-- 关联：
--   - notification_types 已在 025 中 INSERT 6 行（type_code 列存在）
--   - 本脚本按 023_add_payment_notification.sql 的 INSERT 范式：
--       SELECT t.id FROM notification_types t WHERE t.code = ... + NOT EXISTS 防重
--
-- 执行：
--   mysql -u root -p superadmin_db < database/025b_seed_points_notification_templates.sql
--
-- 验证：
--   SELECT type_id, code, channel, title_template, status FROM notification_templates
--   WHERE code LIKE 'BUSINESS_POINTS%' OR code LIKE 'BUSINESS_TASK%'
--      OR code IN ('BUSINESS_LEVEL_UP_INAPP','BUSINESS_MALL_FULFILLED_INAPP');
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;

-- 1) 积分获得（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EARNED_INAPP', '积分到账-站内信', 'in_app',
       '积分到账',
       '您获得 {{points}} 积分（来源：{{source}}），当前余额 {{balance}}。',
       1, 1, 0, '积分 v2 种子模板: 积分获得 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EARNED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EARNED_INAPP' AND channel = 'in_app'
  );

-- 2) 积分即将过期（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRE_REMIND_INAPP', '积分即将过期-站内信', 'in_app',
       '积分即将过期',
       '您有 {{points}} 积分将在 {{expireDate}}（剩余 {{days}} 天）过期，请尽快使用。',
       1, 1, 0, '积分 v2 种子模板: 积分过期提醒 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRE_REMIND'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRE_REMIND_INAPP' AND channel = 'in_app'
  );

-- 3) 积分即将过期（sms，仅 T-7 / T-0 用）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRE_REMIND_SMS', '积分即将过期-短信', 'sms',
       NULL,
       '【超级工具】您有 {{points}} 积分将在 {{expireDate}} 过期，请尽快使用。',
       1, 1, 0, '积分 v2 种子模板: 积分过期提醒 sms'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRE_REMIND'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRE_REMIND_SMS' AND channel = 'sms'
  );

-- 4) 积分已过期（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRED_INAPP', '积分已过期-站内信', 'in_app',
       '积分已过期',
       '您的部分积分已于 {{date}} 过期清零。可前往「积分流水」查看详情。',
       1, 1, 0, '积分 v2 种子模板: 积分已过期 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRED_INAPP' AND channel = 'in_app'
  );

-- 5) 任务完成可领奖（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_TASK_COMPLETED_INAPP', '任务完成-站内信', 'in_app',
       '任务完成',
       '任务 [{{taskName}}] 已完成，点击领取 {{rewardPoints}} 积分奖励。',
       1, 1, 0, '积分 v2 种子模板: 任务完成 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_TASK_COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_TASK_COMPLETED_INAPP' AND channel = 'in_app'
  );

-- 6) 等级升级（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_LEVEL_UP_INAPP', '恭喜升级-站内信', 'in_app',
       '恭喜升级',
       '恭喜升级到 {{levelName}}！系统已发放 {{giftPoints}} 积分礼包。',
       1, 1, 0, '积分 v2 种子模板: 等级升级 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_LEVEL_UP'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_LEVEL_UP_INAPP' AND channel = 'in_app'
  );

-- 7) 商城兑换到账（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_MALL_FULFILLED_INAPP', '兑换到账-站内信', 'in_app',
       '兑换到账',
       '您兑换的 [{{itemName}}] 已发放（订单号：{{orderNo}}）。',
       1, 1, 0, '积分 v2 种子模板: 商城兑换到账 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_MALL_FULFILLED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_MALL_FULFILLED_INAPP' AND channel = 'in_app'
  );

-- 验证（可选）
-- SELECT code, channel, title_template, status FROM notification_templates
-- WHERE code LIKE 'BUSINESS_POINTS%' OR code LIKE 'BUSINESS_TASK%'
--    OR code IN ('BUSINESS_LEVEL_UP_INAPP','BUSINESS_MALL_FULFILLED_INAPP');

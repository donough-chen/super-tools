-- ============================================================
-- 迁移脚本: 023_add_payment_notification.sql
-- 版本: 2.7.2
-- 创建时间: 2026-05-23
-- 说明: 新增 2 个通知类型（支付成功/失败）+ 模板，并补全到期提醒模板
-- 前置依赖: 018_add_notification_system.sql
-- 字段名对齐 018 schema:
--   notification_types: status (enabled), quiet_hour_policy (policy), is_system (system), sort_order (sort)
--   notification_templates: title_template (title_tpl), content_template (content_tpl),
--                           current_version (version), status (enabled), 无 language 字段
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;

-- 新增通知类型
INSERT IGNORE INTO `notification_types`
  (`code`, `name`, `description`, `category`, `default_channels`, `user_cancelable`, `priority`, `quiet_hour_policy`, `icon`, `color`, `is_system`, `sort_order`)
VALUES
  ('BUSINESS_PAYMENT_SUCCESS', '支付成功', '订单支付成功通知', 'business', '["in_app","email"]', 1, 1, 'respect', 'check-circle', '#52c41a', 1, 30),
  ('BUSINESS_PAYMENT_FAIL',    '支付失败', '订单支付失败通知', 'business', '["in_app"]',          1, 1, 'respect', 'close-circle', '#ff4d4f', 1, 31);

-- 模板（站内信）支付成功
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_PAYMENT_SUCCESS_INAPP', '支付成功-站内信', 'in_app',
       '支付成功',
       '订单 {{orderNo}} 已支付成功，{{planName}} 已开通至 {{expireAt}}。',
       1, 1, 0, '订阅 MVP 种子模板: 支付成功 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_PAYMENT_SUCCESS'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_PAYMENT_SUCCESS_INAPP' AND channel = 'in_app'
  );

-- 模板（站内信）支付失败
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_PAYMENT_FAIL_INAPP', '支付失败-站内信', 'in_app',
       '支付失败',
       '订单 {{orderNo}} 支付失败，原因：{{reason}}。您可前往「我的订单」重新支付。',
       1, 1, 0, '订阅 MVP 种子模板: 支付失败 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_PAYMENT_FAIL'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_PAYMENT_FAIL_INAPP' AND channel = 'in_app'
  );

-- 邮件模板（仅成功推送邮件）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_PAYMENT_SUCCESS_EMAIL', '支付成功-邮件', 'email',
       '【订单 {{orderNo}}】支付成功',
       '<p>您好，</p><p>您的订单 <strong>{{orderNo}}</strong> 已支付成功！</p><p>套餐：{{planName}}<br>有效期至：{{expireAt}}<br>订单金额：¥{{amount}}</p><p>感谢您的支持。</p>',
       1, 1, 0, '订阅 MVP 种子模板: 支付成功 email'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_PAYMENT_SUCCESS'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_PAYMENT_SUCCESS_EMAIL' AND channel = 'email'
  );

-- 到期提醒模板增量（018 没有种子，本次补全）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_MEMBER_EXPIRE_SOON_INAPP', '会员到期提醒-站内信', 'in_app',
       '会员即将到期',
       '您的{{planName}}将于 {{expireAt}} 到期（剩 {{daysLeft}} 天），续费可享原价优惠。',
       1, 1, 0, '订阅 MVP 种子模板: 会员到期提醒 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_MEMBER_EXPIRE_SOON'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_MEMBER_EXPIRE_SOON_INAPP' AND channel = 'in_app'
  );

INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_MEMBER_EXPIRED_INAPP', '会员已过期-站内信', 'in_app',
       '会员已过期',
       '您的{{planName}}已于 {{expireAt}} 过期，欢迎续费继续享受会员权益。',
       1, 1, 0, '订阅 MVP 种子模板: 会员已过期 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_MEMBER_EXPIRED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_MEMBER_EXPIRED_INAPP' AND channel = 'in_app'
  );

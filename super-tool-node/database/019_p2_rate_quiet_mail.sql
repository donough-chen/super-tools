-- =====================================================
-- 019: P2.1 频控 / 静默 / 邮件 字段补齐
-- Refs: 通知推送系统模块设计需求文档.md (V2 §7)
-- =====================================================

-- 1. 类型表加 quiet_hour_policy（静默策略）
ALTER TABLE notification_types
  ADD COLUMN quiet_hour_policy VARCHAR(16) NOT NULL DEFAULT 'respect'
  COMMENT 'respect=命中跳过; bypass=不受静默; relax=只跳inApp不跳sms/email'
  AFTER priority;

-- 2. send_logs 加 extra JSON 字段
ALTER TABLE notification_send_logs
  ADD COLUMN extra JSON NULL COMMENT '渠道返回的额外信息'
  AFTER error_message;

-- 3. 安全/系统类型的静默策略改 bypass（P0 紧急通知不受静默约束）
UPDATE notification_types
SET quiet_hour_policy = 'bypass'
WHERE priority = 0;

-- 4. 验证码类型也 bypass（需要即时送达）
UPDATE notification_types
SET quiet_hour_policy = 'bypass'
WHERE code LIKE 'VERIFY_CODE_%';

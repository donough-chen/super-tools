-- =====================================================
-- 020: P2.2 任务调度字段补齐
-- Refs: 通知推送系统模块设计需求文档.md (V2 §6.6)
-- =====================================================

-- task 表在 P1 已有 schedule_type / scheduled_at / cron_expression
-- 本次补齐 rrule / undo / pause / cancel / fire 字段

ALTER TABLE notification_tasks
  ADD COLUMN IF NOT EXISTS rrule VARCHAR(500) NULL COMMENT 'RRULE 表达式' AFTER cron_expression,
  ADD COLUMN IF NOT EXISTS undo_window_sec INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '撤销窗口秒数(0=不可撤销)' AFTER rrule,
  ADD COLUMN IF NOT EXISTS paused_at DATETIME NULL COMMENT '暂停时间' AFTER undo_window_sec,
  ADD COLUMN IF NOT EXISTS canceled_at DATETIME NULL COMMENT '取消时间' AFTER paused_at,
  ADD COLUMN IF NOT EXISTS next_fire_at DATETIME NULL COMMENT '下次触发时间(cron/rrule)' AFTER canceled_at,
  ADD COLUMN IF NOT EXISTS last_fire_at DATETIME NULL COMMENT '上次触发时间' AFTER next_fire_at;

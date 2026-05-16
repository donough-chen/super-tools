-- =====================================================
-- 021: P2.3 动态受众规则
-- Refs: 通知推送系统模块设计需求文档.md (V2 §4.2.4)
-- =====================================================

-- audiences 表在 P1 已建（notification_audiences），字段已完整
-- 本次仅补充可能缺失的索引
ALTER TABLE notification_audiences
  ADD INDEX idx_audience_type (audience_type);

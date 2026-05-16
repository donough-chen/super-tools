-- =====================================================
-- 022: P2.4 业务触发点模板种子数据
-- Refs: 通知推送系统模块设计需求文档.md (V2 §11)
-- =====================================================

-- P1 已在 018 中预置了 21 种类型（含 BUSINESS_MEMBER_UPGRADE 等）
-- 本次仅插入对应的 in_app 模板（种子数据）

INSERT IGNORE INTO notification_templates
  (type_id, code, name, channel, title_template, content_template, current_version, status, created_by, description)
SELECT t.id, CONCAT(t.code, '_INAPP'), CONCAT(t.name, '-站内信'), 'in_app',
  CASE t.code
    WHEN 'BUSINESS_MEMBER_UPGRADE'  THEN '恭喜会员升级'
    WHEN 'BUSINESS_POINTS_CHANGE'   THEN '积分变动通知'
    WHEN 'BUSINESS_INVITE_SUCCESS'  THEN '邀请好友成功'
    WHEN 'BUSINESS_TOOL_PUBLISHED'  THEN '工具上线通知'
    WHEN 'BUSINESS_TOOL_UNPUBLISHED' THEN '工具下架通知'
  END,
  CASE t.code
    WHEN 'BUSINESS_MEMBER_UPGRADE'  THEN '恭喜！您的会员等级已升级至 {{levelName}}，享受更多权益。'
    WHEN 'BUSINESS_POINTS_CHANGE'   THEN '您的积分发生变动：{{changeType}} {{points}} 积分，当前余额 {{balance}}。'
    WHEN 'BUSINESS_INVITE_SUCCESS'  THEN '您邀请的好友 {{friendName}} 已成功注册，奖励积分已到账。'
    WHEN 'BUSINESS_TOOL_PUBLISHED'  THEN '您收藏的工具「{{toolName}}」已上线，快去体验吧！'
    WHEN 'BUSINESS_TOOL_UNPUBLISHED' THEN '您收藏的工具「{{toolName}}」已下架，如有疑问请联系客服。'
  END,
  1, 1, 1,
  CONCAT('P2.4 种子模板: ', t.name)
FROM notification_types t
WHERE t.code IN (
  'BUSINESS_MEMBER_UPGRADE',
  'BUSINESS_POINTS_CHANGE',
  'BUSINESS_INVITE_SUCCESS',
  'BUSINESS_TOOL_PUBLISHED',
  'BUSINESS_TOOL_UNPUBLISHED'
);

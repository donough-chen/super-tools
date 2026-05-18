-- 027: 添加套餐开通通知类型 + 模板
-- =====================================================

INSERT IGNORE INTO notification_types
  (code, name, description, category, default_channels, user_cancelable, priority, icon, color, status, sort_order)
VALUES
  ('BUSINESS_PLAN_ACTIVATED', '套餐开通', '用户开通付费套餐通知', 'business', '["in_app","email"]', 1, 1, 'crown', '#faad14', 1, 26);

-- 站内信模板
INSERT INTO notification_templates
  (type_id, code, name, channel, title_template, content_template, current_version, status, created_by, updated_by)
SELECT t.id, 'BUSINESS_PLAN_ACTIVATED_INAPP', '套餐开通-站内信', 'in_app',
  '套餐开通成功',
  '恭喜！您已成功开通「{{planName}}」套餐，有效期至 {{expireAt}}，享受更多专属权益。',
  1, 1, 0, 0
FROM notification_types t
WHERE t.code = 'BUSINESS_PLAN_ACTIVATED'
  AND NOT EXISTS (
    SELECT 1 FROM notification_templates
    WHERE code = 'BUSINESS_PLAN_ACTIVATED_INAPP' AND channel = 'in_app'
  );

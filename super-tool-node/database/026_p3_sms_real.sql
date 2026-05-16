-- =====================================================
-- 026: P3.4 SMS real integration
-- =====================================================

INSERT IGNORE INTO `notification_channel_config`
  (`channel`,`provider`,`enabled`,`config`,`is_default`,`priority`,`description`,`created_at`,`updated_at`)
VALUES
  ('sms','tencent',1,JSON_OBJECT(
    'sdk_app_id', 'CHANGE_IN_PROD',
    'secret_id',  'CHANGE_IN_PROD',
    'secret_key', 'CHANGE_IN_PROD',
    'sign',       'super-tools',
    'template_default', '12345'
  ),1,10,'腾讯云 SMS 默认',NOW(),NOW());

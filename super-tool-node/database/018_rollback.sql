-- ============================================================
-- Rollback for Migration 018
-- 注意：执行前确认无生产数据依赖；本回滚为破坏性操作
-- ============================================================

-- 删除角色绑定
DELETE rp FROM role_permissions rp 
INNER JOIN permissions p ON rp.permission_id = p.id 
WHERE p.code LIKE 'notification:%';

-- 删除权限码
DELETE FROM permissions WHERE code LIKE 'notification:%';

-- 删除 user_profiles 字段
ALTER TABLE user_profiles DROP COLUMN IF EXISTS notification_global_enabled;

-- 按依赖逆序删表
DROP TABLE IF EXISTS notification_send_logs;
DROP TABLE IF EXISTS notification_channel_configs;
DROP TABLE IF EXISTS notification_rate_limit_config;
DROP TABLE IF EXISTS notification_user_quiet_hours;
DROP TABLE IF EXISTS notification_user_preferences;
DROP TABLE IF EXISTS notification_messages;
DROP TABLE IF EXISTS notification_tasks;
DROP TABLE IF EXISTS notification_audiences;
DROP TABLE IF EXISTS notification_template_versions;
DROP TABLE IF EXISTS notification_templates;
DROP TABLE IF EXISTS notification_types;

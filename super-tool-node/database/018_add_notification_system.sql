-- ============================================================
-- Migration 018: 通知推送系统
-- Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4)
-- ============================================================

-- ============================================================
-- 1. 通知类型表
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_types (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  parent_id       BIGINT UNSIGNED NULL,
  code            VARCHAR(64) NOT NULL                COMMENT '类型编码',
  name            VARCHAR(100) NOT NULL,
  description     VARCHAR(500) NULL,
  category        VARCHAR(20) NOT NULL                COMMENT 'system | business | marketing',
  default_channels JSON NOT NULL                      COMMENT '默认渠道数组',
  user_cancelable TINYINT(1) NOT NULL DEFAULT 1,
  priority        TINYINT NOT NULL DEFAULT 2          COMMENT '0=P0 1=P1 2=P2 3=P3',
  icon            VARCHAR(64) NULL,
  color           VARCHAR(16) NULL,
  status          TINYINT(1) NOT NULL DEFAULT 1,
  sort_order      INT NOT NULL DEFAULT 0,
  is_system       TINYINT(1) NOT NULL DEFAULT 0       COMMENT '系统内置类型不可删除',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_code (code, deleted_at),
  KEY idx_parent (parent_id),
  KEY idx_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知类型表';

-- ============================================================
-- 2. 模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  type_id         BIGINT UNSIGNED NOT NULL,
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  channel         VARCHAR(20) NOT NULL                COMMENT 'in_app | email | sms',
  title_template  VARCHAR(200) NULL,
  content_template TEXT NOT NULL,
  extra_config    JSON NULL,
  sample_variables JSON NULL,
  current_version INT NOT NULL DEFAULT 1,
  status          TINYINT(1) NOT NULL DEFAULT 0       COMMENT '0=草稿 1=已发布 2=已停用',
  description     VARCHAR(500) NULL,
  created_by      BIGINT UNSIGNED NOT NULL,
  updated_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  UNIQUE KEY uk_code_channel (code, channel, deleted_at),
  KEY idx_type (type_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知模板表';

-- ============================================================
-- 3. 模板版本快照表
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_template_versions (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  template_id     BIGINT UNSIGNED NOT NULL,
  version         INT NOT NULL,
  title_template  VARCHAR(200) NULL,
  content_template TEXT NOT NULL,
  extra_config    JSON NULL,
  change_note     VARCHAR(500) NULL,
  published_by    BIGINT UNSIGNED NOT NULL,
  published_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_template_version (template_id, version),
  KEY idx_template (template_id, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板版本历史';

-- ============================================================
-- 4. 受众分组表
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_audiences (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(64) NULL,
  description     VARCHAR(500) NULL,
  audience_type   VARCHAR(20) NOT NULL                COMMENT 'all | static | dynamic',
  static_user_ids JSON NULL,
  dynamic_rules   JSON NULL,
  cached_count    BIGINT NULL,
  cached_at       DATETIME NULL,
  created_by      BIGINT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  KEY idx_creator (created_by),
  KEY idx_type (audience_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='受众分组';

-- ============================================================
-- 5. 发送任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_tasks (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  description     VARCHAR(500) NULL,
  type_id         BIGINT UNSIGNED NOT NULL,
  template_code   VARCHAR(64) NOT NULL,
  channels        JSON NOT NULL,
  audience_id     BIGINT UNSIGNED NULL,
  audience_snapshot JSON NULL,
  variables       JSON NULL,
  schedule_type   VARCHAR(20) NOT NULL DEFAULT 'immediate',
  scheduled_at    DATETIME NULL,
  cron_expression VARCHAR(64) NULL,
  priority        TINYINT NOT NULL DEFAULT 2,
  idempotent_key  VARCHAR(128) NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_count     BIGINT NOT NULL DEFAULT 0,
  success_count   BIGINT NOT NULL DEFAULT 0,
  fail_count      BIGINT NOT NULL DEFAULT 0,
  skipped_count   BIGINT NOT NULL DEFAULT 0,
  started_at      DATETIME NULL,
  finished_at     DATETIME NULL,
  error_message   TEXT NULL,
  source          VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT 'admin | trigger | open_api',
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotent (idempotent_key),
  KEY idx_status (status),
  KEY idx_schedule (schedule_type, scheduled_at),
  KEY idx_creator (created_by, created_at),
  KEY idx_template (template_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发送任务表';

-- ============================================================
-- 6. 用户消息记录（核心大表，预计千万级）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_messages (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  task_id         BIGINT UNSIGNED NULL,
  type_id         BIGINT UNSIGNED NOT NULL,
  template_id     BIGINT UNSIGNED NULL,
  template_version INT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(200) NULL,
  content         TEXT NOT NULL,
  summary         VARCHAR(500) NULL,
  extra           JSON NULL,
  channels        JSON NOT NULL,
  priority        TINYINT NOT NULL DEFAULT 2,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  read_at         DATETIME NULL,
  is_archived     TINYINT(1) NOT NULL DEFAULT 0,
  archived_at     DATETIME NULL,
  expire_at       DATETIME NULL,
  idempotent_key  VARCHAR(128) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_idempotent (user_id, idempotent_key),
  KEY idx_user_unread (user_id, is_read, is_archived, created_at),
  KEY idx_user_type (user_id, type_id, created_at),
  KEY idx_task (task_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户消息记录';

-- ============================================================
-- 7. 用户订阅偏好（稀疏存储：无记录=默认订阅）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_user_preferences (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  type_id         BIGINT UNSIGNED NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  is_subscribed   TINYINT(1) NOT NULL DEFAULT 1,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_type_channel (user_id, type_id, channel),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户订阅偏好';

-- ============================================================
-- 8. 用户全局静默时段
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_user_quiet_hours (
  user_id         BIGINT UNSIGNED PRIMARY KEY,
  enabled         TINYINT(1) NOT NULL DEFAULT 0,
  quiet_start     TIME NULL,
  quiet_end       TIME NULL,
  timezone        VARCHAR(40) NOT NULL DEFAULT 'Asia/Shanghai',
  receive_urgent  TINYINT(1) NOT NULL DEFAULT 1,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户免打扰';

-- ============================================================
-- 9. 频控配置（P1 仅建表，逻辑 P2 实现）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_rate_limit_config (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  scope           VARCHAR(20) NOT NULL                COMMENT 'global_user | channel | type',
  target_key      VARCHAR(64) NULL,
  `window`        VARCHAR(20) NOT NULL                COMMENT 'hour | day | week',
  max_count       INT NOT NULL,
  skip_priority   TINYINT NULL,
  enabled         TINYINT(1) NOT NULL DEFAULT 1,
  description     VARCHAR(200) NULL,
  updated_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_scope_target_window (scope, target_key, `window`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='频控配置';

-- ============================================================
-- 10. 渠道服务商配置
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_channel_configs (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  channel         VARCHAR(20) NOT NULL,
  provider        VARCHAR(40) NOT NULL,
  is_default      TINYINT(1) NOT NULL DEFAULT 0,
  config          JSON NOT NULL                       COMMENT '凭证字段（敏感字段 AES 加密）',
  enabled         TINYINT(1) NOT NULL DEFAULT 1,
  health_status   VARCHAR(20) NOT NULL DEFAULT 'unknown',
  last_check_at   DATETIME NULL,
  last_success_rate DECIMAL(5,2) NULL,
  description     VARCHAR(200) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_channel_provider (channel, provider),
  KEY idx_channel_default (channel, is_default, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道服务商配置';

-- ============================================================
-- 11. 渠道下发日志（核心大表）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_send_logs (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  message_id      BIGINT UNSIGNED NULL,
  task_id         BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  provider        VARCHAR(40) NULL,
  status          VARCHAR(20) NOT NULL                COMMENT 'queued|sending|sent|delivered|failed|skipped',
  skip_reason     VARCHAR(40) NULL,
  attempt         TINYINT NOT NULL DEFAULT 1,
  target          VARCHAR(200) NULL                   COMMENT '邮箱/手机号脱敏存储',
  request_id      VARCHAR(128) NULL,
  error_code      VARCHAR(64) NULL,
  error_message   VARCHAR(500) NULL,
  raw_response    TEXT NULL,
  cost_ms         INT NULL,
  sent_at         DATETIME NULL,
  delivered_at    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_message (message_id),
  KEY idx_task (task_id),
  KEY idx_user_channel (user_id, channel, created_at),
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道下发日志';

-- ============================================================
-- 给 user_profiles 追加全局通知开关字段
-- ============================================================
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS notification_global_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '全局通知开关';

-- ============================================================
-- 预置通知类型（21 条，全部 is_system=1）
-- ============================================================
INSERT INTO notification_types 
  (code, name, description, category, default_channels, user_cancelable, priority, icon, color, is_system, sort_order) 
VALUES
  ('SYSTEM_SECURITY',         '账号安全',     '账号安全相关通知',       'system',    '["in_app","email","sms"]', 0, 0, 'safety',     '#ff4d4f', 1, 1),
  ('SYSTEM_ANNOUNCEMENT',     '服务公告',     '平台服务公告',          'system',    '["in_app"]',               1, 1, 'sound',      '#1890ff', 1, 2),
  ('SYSTEM_UNUSUAL_LOGIN',    '异常登录',     '异常登录提醒',          'system',    '["in_app","email","sms"]', 0, 0, 'warning',    '#fa8c16', 1, 3),
  ('SYSTEM_PASSWORD_CHANGED', '密码修改',     '密码修改通知',          'system',    '["in_app","email"]',       0, 0, 'lock',       '#fa8c16', 1, 4),
  ('SYSTEM_INTERNAL_ALERT',   '内部告警',     '管理员内部告警通知',     'system',    '["in_app"]',               0, 1, 'bell',       '#722ed1', 1, 5),
  ('BUSINESS_FEEDBACK_REPLY', '反馈回复',     '反馈被管理员回复',      'business',  '["in_app","email"]',       1, 1, 'comment',    '#52c41a', 1, 10),
  ('BUSINESS_FEEDBACK_STATUS','反馈状态变更', '反馈状态发生变更',       'business',  '["in_app"]',               1, 2, 'message',    '#52c41a', 1, 11),
  ('BUSINESS_MEMBER_UPGRADE', '会员升级',     '会员升级成功',          'business',  '["in_app","email"]',       1, 1, 'crown',      '#faad14', 1, 20),
  ('BUSINESS_MEMBER_EXPIRE_SOON', '会员即将到期', '会员即将到期提醒',   'business',  '["in_app","email","sms"]', 1, 1, 'clock',      '#faad14', 1, 21),
  ('BUSINESS_MEMBER_EXPIRED', '会员已过期',   '会员已过期通知',        'business',  '["in_app","email"]',       1, 1, 'stop',       '#faad14', 1, 22),
  ('BUSINESS_POINTS_CHANGE',  '积分变动',     '积分余额变动',          'business',  '["in_app"]',               1, 2, 'gift',       '#eb2f96', 1, 23),
  ('BUSINESS_WELCOME',        '注册欢迎',     '新用户欢迎通知',        'business',  '["in_app"]',               1, 2, 'smile',      '#13c2c2', 1, 24),
  ('BUSINESS_TOOL_PUBLISHED', '工具上线',     '收藏的工具上线',        'business',  '["in_app"]',               1, 2, 'rocket',     '#13c2c2', 1, 25),
  ('BUSINESS_TOOL_UNPUBLISHED','工具下架',    '收藏的工具下架',        'business',  '["in_app"]',               1, 2, 'pause',      '#8c8c8c', 1, 26),
  ('BUSINESS_INVITE_SUCCESS', '邀请成功',     '邀请好友注册成功',      'business',  '["in_app"]',               1, 2, 'user-add',   '#52c41a', 1, 27),
  ('MARKETING_ACTIVITY',      '活动推送',     '运营活动推送',          'marketing', '["in_app","email"]',       1, 3, 'fire',       '#ff7a45', 1, 30),
  ('MARKETING_RECOMMEND',     '个性化推荐',   '个性化内容推荐',        'marketing', '["in_app"]',               1, 3, 'star',       '#ff7a45', 1, 31),
  ('VERIFY_CODE_LOGIN',       '验证码-登录',  '登录场景验证码',        'system',    '["sms","email"]',          0, 0, 'safety',     '#ff4d4f', 1, 90),
  ('VERIFY_CODE_REGISTER',    '验证码-注册',  '注册场景验证码',        'system',    '["sms","email"]',          0, 0, 'safety',     '#ff4d4f', 1, 91),
  ('VERIFY_CODE_RESET',       '验证码-重置密码','重置密码场景验证码',   'system',    '["sms","email"]',          0, 0, 'safety',     '#ff4d4f', 1, 92),
  ('VERIFY_CODE_BIND',        '验证码-绑定',  '绑定账号场景验证码',    'system',    '["sms","email"]',          0, 0, 'safety',     '#ff4d4f', 1, 93);

-- ============================================================
-- 预置频控规则（6 条；P1 不实际生效，P2 接入逻辑）
-- ============================================================
INSERT INTO notification_rate_limit_config 
  (scope, target_key, `window`, max_count, skip_priority, description) 
VALUES
  ('global_user', NULL, 'hour', 20, 0, '全局：每用户每小时上限'),
  ('global_user', NULL, 'day',  50, 0, '全局：每用户每日上限'),
  ('channel', 'sms',   'day',  5,  0, '短信：每用户每日上限'),
  ('channel', 'email', 'day',  10, 0, '邮件：每用户每日上限'),
  ('type', 'MARKETING_ACTIVITY',  'week', 3, 1, '营销活动：每用户每周上限'),
  ('type', 'MARKETING_RECOMMEND', 'week', 5, 1, '推荐：每用户每周上限');

-- ============================================================
-- 预置渠道服务商配置（3 条占位，P2 完善）
-- ============================================================
INSERT INTO notification_channel_configs 
  (channel, provider, is_default, config, enabled, description) 
VALUES
  ('in_app', 'native', 1, JSON_OBJECT(), 1, '站内信：直写 DB + Socket emit'),
  ('email',  'smtp',   1, JSON_OBJECT('host','smtp.example.com','port',587,'secure',false,'auth_user','noreply@example.com','auth_pass','PLACEHOLDER'), 0, 'SMTP 占位（P2 启用）'),
  ('sms',    'mock',   1, JSON_OBJECT(), 1, '短信：mock 模式（P2 接入腾讯云）');

-- ============================================================
-- 新增 14 个权限码
-- ============================================================
INSERT INTO permissions (code, name, type, sort_order, status) VALUES
  ('notification:type:view',         '查看通知类型',     'menu',   8001, 1),
  ('notification:type:manage',       '管理通知类型',     'action', 8002, 1),
  ('notification:template:view',     '查看通知模板',     'menu',   8003, 1),
  ('notification:template:manage',   '管理通知模板',     'action', 8004, 1),
  ('notification:template:publish',  '发布通知模板',     'action', 8005, 1),
  ('notification:task:view',         '查看通知任务',     'menu',   8006, 1),
  ('notification:task:create',       '创建通知任务',     'action', 8007, 1),
  ('notification:task:control',      '暂停/取消通知任务','action', 8008, 1),
  ('notification:audience:view',     '查看受众分组',     'menu',   8009, 1),
  ('notification:audience:manage',   '管理受众分组',     'action', 8010, 1),
  ('notification:message:view',      '查看消息记录',     'menu',   8011, 1),
  ('notification:stats:view',        '查看通知统计',     'menu',   8012, 1),
  ('notification:stats:export',      '导出通知统计报表', 'action', 8013, 1),
  ('notification:config:manage',     '管理通知系统配置', 'action', 8014, 1);

-- ============================================================
-- 角色绑定（按需求文档 §8.6 矩阵）
-- ============================================================
-- 超级管理员：全部 14 个
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r CROSS JOIN permissions p 
WHERE r.code = 'super_admin' 
  AND p.code IN (
    'notification:type:view','notification:type:manage',
    'notification:template:view','notification:template:manage','notification:template:publish',
    'notification:task:view','notification:task:create','notification:task:control',
    'notification:audience:view','notification:audience:manage',
    'notification:message:view',
    'notification:stats:view','notification:stats:export',
    'notification:config:manage'
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 管理员：除 config:manage 外
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r CROSS JOIN permissions p 
WHERE r.code = 'admin' 
  AND p.code IN (
    'notification:type:view','notification:type:manage',
    'notification:template:view','notification:template:manage','notification:template:publish',
    'notification:task:view','notification:task:create','notification:task:control',
    'notification:audience:view','notification:audience:manage',
    'notification:message:view',
    'notification:stats:view','notification:stats:export'
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 运营：view 类 + task:create + template:manage（不含 publish）+ audience:manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r CROSS JOIN permissions p 
WHERE r.code = 'operator' 
  AND p.code IN (
    'notification:type:view',
    'notification:template:view','notification:template:manage',
    'notification:task:view','notification:task:create','notification:task:control',
    'notification:audience:view','notification:audience:manage',
    'notification:message:view',
    'notification:stats:view'
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 数据分析师：所有 view + stats:export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r CROSS JOIN permissions p 
WHERE r.code = 'data_analyst' 
  AND p.code IN (
    'notification:type:view',
    'notification:template:view',
    'notification:task:view',
    'notification:audience:view',
    'notification:message:view',
    'notification:stats:view','notification:stats:export'
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

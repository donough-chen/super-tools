-- ============================================================
-- Migration 018: 通知推送系统（含 P2/P3 全量合并）
-- Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4)
-- 合并自: 019~027 各增量迁移文件
-- ============================================================

-- ============================================================
-- 1. 通知类型表 (notification_types)
-- 用途：定义系统支持的所有通知类型的分层分类体系。
--       支持 parent_id 实现树形结构（如 system > 账号安全 > 异常登录）。
--       每种类型预定义默认渠道、优先级、静默策略等属性，
--       业务方通过 code 引用类型，管理端可动态增删自定义类型。
-- 数据规模：约 50 行（系统预置 24 条 + 运营自定义）
-- 关联关系：被 notification_templates.type_id、notification_messages.type_id、
--           notification_tasks.type_id、notification_user_preferences.type_id 引用
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_types (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  parent_id       BIGINT UNSIGNED NULL                COMMENT '父类型ID，关联本表 id，用于构建类型树形结构；NULL 表示顶级类型',
  code            VARCHAR(64) NOT NULL                COMMENT '类型唯一编码，业务方调用 send() 时通过此编码引用，如 BUSINESS_FEEDBACK_REPLY',
  name            VARCHAR(100) NOT NULL               COMMENT '类型显示名称，用于管理端和 C 端展示',
  description     VARCHAR(500) NULL                   COMMENT '类型描述说明，帮助运营人员理解该类型的业务场景',
  category        VARCHAR(20) NOT NULL                COMMENT '类型分类：system=系统通知(安全/验证码) | business=业务通知(会员/反馈) | marketing=营销通知(活动/推荐)',
  default_channels JSON NOT NULL                      COMMENT '默认投递渠道数组，JSON 格式如 ["in_app","email","sms"]，创建任务时可覆盖',
  user_cancelable TINYINT(1) NOT NULL DEFAULT 1       COMMENT '用户是否可取消订阅：0=强制接收(如安全通知/验证码) 1=允许用户在偏好中关闭',
  priority        TINYINT NOT NULL DEFAULT 2          COMMENT '优先级：0=P0紧急(安全/验证码,5次重试) 1=P1高(业务关键) 2=P2中(常规) 3=P3低(营销,受静默约束)',
  quiet_hour_policy VARCHAR(16) NOT NULL DEFAULT 'respect' COMMENT '静默时段策略：respect=命中静默则跳过发送 | bypass=不受静默约束(如验证码) | relax=仅跳过站内信,不跳sms/email',
  icon            VARCHAR(64) NULL                    COMMENT '类型图标标识，用于前端 UI 展示，如 safety/crown/bell 等',
  color           VARCHAR(16) NULL                    COMMENT '类型主题色，十六进制色值如 #ff4d4f，用于前端标签/图标着色',
  status          TINYINT(1) NOT NULL DEFAULT 1       COMMENT '启用状态：0=已禁用(该类型通知不再发送) 1=启用中',
  sort_order      INT NOT NULL DEFAULT 0              COMMENT '排序权重，数值越小越靠前，管理端列表和 C 端偏好页按此排序',
  is_system       TINYINT(1) NOT NULL DEFAULT 0       COMMENT '是否系统内置类型：1=系统预置(不可删除/不可修改code) 0=运营自定义(可删除)',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  deleted_at      DATETIME NULL                       COMMENT '软删除时间，非 NULL 表示已删除；与 code 联合唯一约束实现逻辑删除后可重建同名类型',
  UNIQUE KEY uk_code (code, deleted_at),
  KEY idx_parent (parent_id),
  KEY idx_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知类型表 - 定义系统支持的所有通知类型分层分类体系';

-- ============================================================
-- 2. 通知模板表 (notification_templates)
-- 用途：存储各渠道的消息模板，支持 Mustache 变量语法（{{varName}}）。
--       同一业务类型在不同渠道（站内信/邮件/短信）各有独立模板，
--       通过 (code, channel) 联合唯一标识。模板支持草稿→发布→停用生命周期，
--       发布时自动生成版本快照，支持回滚到历史版本。
-- 数据规模：约 100-500 行
-- 关联关系：type_id → notification_types.id；
--           被 notification_template_versions.template_id 引用；
--           被 notification_messages.template_id 引用
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  type_id         BIGINT UNSIGNED NOT NULL            COMMENT '所属通知类型ID，关联 notification_types.id',
  code            VARCHAR(64) NOT NULL                COMMENT '模板编码，业务方调用 send({templateCode}) 时使用，如 BUSINESS_FEEDBACK_REPLY_INAPP',
  name            VARCHAR(100) NOT NULL               COMMENT '模板显示名称，用于管理端列表展示',
  channel         VARCHAR(20) NOT NULL                COMMENT '适用渠道：in_app=站内信 | email=邮件 | sms=短信',
  title_template  VARCHAR(200) NULL                   COMMENT '标题模板，支持 {{var}} 变量替换；站内信/邮件必填，短信可为空',
  content_template TEXT NOT NULL                      COMMENT '正文模板，支持 {{var}} 变量替换；邮件渠道支持 HTML 格式',
  extra_config    JSON NULL                           COMMENT '渠道特有配置，如邮件的 {replyTo, cc, attachments}，短信的 {templateId, signName}',
  sample_variables JSON NULL                          COMMENT '示例变量 JSON，用于管理端预览和测试发送，如 {"userName":"张三","planName":"Pro"}',
  current_version INT NOT NULL DEFAULT 1              COMMENT '当前已发布版本号，每次发布自增；草稿状态下为待发布版本号',
  status          TINYINT(1) NOT NULL DEFAULT 0       COMMENT '模板状态：0=草稿(可编辑) 1=已发布(生效中,不可编辑) 2=已停用(不再用于发送)',
  description     VARCHAR(500) NULL                   COMMENT '模板描述，记录模板用途和变更说明',
  created_by      BIGINT UNSIGNED NOT NULL            COMMENT '创建人用户ID，关联 users.id',
  updated_by      BIGINT UNSIGNED NULL                COMMENT '最后修改人用户ID，关联 users.id',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  deleted_at      DATETIME NULL                       COMMENT '软删除时间，非 NULL 表示已删除',
  UNIQUE KEY uk_code_channel (code, channel, deleted_at),
  KEY idx_type (type_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知模板表 - 存储各渠道消息模板，支持版本管理和变量渲染';

-- ============================================================
-- 3. 模板版本快照表 (notification_template_versions)
-- 用途：记录模板每次发布时的完整快照，实现版本追溯和回滚能力。
--       每次模板发布操作会自动生成一条版本记录，保存当时的标题、正文和配置。
--       管理员可查看历史版本对比差异，并支持一键回滚到指定版本。
-- 数据规模：templates × 平均 5 个版本
-- 关联关系：template_id → notification_templates.id
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_template_versions (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  template_id     BIGINT UNSIGNED NOT NULL            COMMENT '所属模板ID，关联 notification_templates.id',
  version         INT NOT NULL                        COMMENT '版本号，从 1 开始递增，与模板的 current_version 对应',
  title_template  VARCHAR(200) NULL                   COMMENT '该版本的标题模板快照',
  content_template TEXT NOT NULL                      COMMENT '该版本的正文模板快照',
  extra_config    JSON NULL                           COMMENT '该版本的渠道特有配置快照',
  change_note     VARCHAR(500) NULL                   COMMENT '版本变更说明，发布时由操作人填写',
  published_by    BIGINT UNSIGNED NOT NULL            COMMENT '发布操作人用户ID，关联 users.id',
  published_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  UNIQUE KEY uk_template_version (template_id, version),
  KEY idx_template (template_id, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板版本历史 - 记录模板每次发布的完整快照，支持版本对比和回滚';

-- ============================================================
-- 4. 受众分组表 (notification_audiences)
-- 用途：定义通知的目标用户群体，支持三种模式：
--       - all: 全量用户
--       - static: 手动指定用户ID列表
--       - dynamic: 基于规则动态圈选（支持用户属性/会员等级/角色/设备等维度）
--       受众分组可保存复用，创建任务时直接引用。
--       动态受众支持预览人数和抽样查看命中用户。
-- 数据规模：约 50-200 行
-- 关联关系：被 notification_tasks.audience_id 引用；
--           created_by → users.id
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_audiences (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  name            VARCHAR(100) NOT NULL               COMMENT '受众分组名称，用于管理端列表展示和任务创建时选择',
  code            VARCHAR(64) NULL                    COMMENT '受众编码，可选，用于业务方通过 API 引用特定受众',
  description     VARCHAR(500) NULL                   COMMENT '分组描述，说明该受众的圈选逻辑和适用场景',
  audience_type   VARCHAR(20) NOT NULL                COMMENT '受众类型：all=全量用户 | static=静态指定用户列表 | dynamic=动态规则圈选',
  static_user_ids JSON NULL                           COMMENT '静态用户ID列表，仅 audience_type=static 时有值，JSON 数组格式如 [1,2,3]',
  dynamic_rules   JSON NULL                           COMMENT '动态圈选规则，仅 audience_type=dynamic 时有值，结构为 {operator,conditions[{field,op,value}]}',
  cached_count    BIGINT NULL                         COMMENT '缓存的命中用户数，由预览接口计算后回写，用于管理端快速展示预估人数',
  cached_at       DATETIME NULL                       COMMENT '缓存计算时间，用于判断缓存是否过期需要重新计算',
  created_by      BIGINT UNSIGNED NOT NULL            COMMENT '创建人用户ID，关联 users.id',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  deleted_at      DATETIME NULL                       COMMENT '软删除时间，非 NULL 表示已删除',
  KEY idx_creator (created_by),
  KEY idx_type (audience_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='受众分组 - 定义通知目标用户群体，支持全量/静态/动态三种圈选模式';

-- ============================================================
-- 5. 发送任务表 (notification_tasks)
-- 用途：管理定时和批量通知的发送任务，是一次发送活动的完整容器。
--       支持三种调度模式：immediate(立即)、scheduled(定时)、recurring(周期)。
--       任务创建后进入队列异步执行，支持暂停/恢复/取消/撤回等生命周期控制。
--       状态机：pending → queued → running → completed | paused | cancelled | failed
-- 数据规模：万级
-- 关联关系：type_id → notification_types.id；
--           audience_id → notification_audiences.id；
--           template_code → notification_templates.code；
--           created_by → users.id；
--           被 notification_messages.task_id、notification_send_logs.task_id 引用
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_tasks (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  name            VARCHAR(200) NOT NULL               COMMENT '任务名称，用于管理端列表展示和任务追踪',
  description     VARCHAR(500) NULL                   COMMENT '任务描述，记录本次发送的目的和背景',
  type_id         BIGINT UNSIGNED NOT NULL            COMMENT '通知类型ID，关联 notification_types.id，决定优先级和静默策略',
  template_code   VARCHAR(64) NOT NULL                COMMENT '模板编码，关联 notification_templates.code，系统据此查找各渠道模板',
  channels        JSON NOT NULL                       COMMENT '本次发送的目标渠道列表，JSON 数组如 ["in_app","email"]，可覆盖类型默认渠道',
  audience_id     BIGINT UNSIGNED NULL                COMMENT '受众分组ID，关联 notification_audiences.id；触发式发送时为 NULL',
  audience_snapshot JSON NULL                         COMMENT '任务创建时的受众快照（用户ID列表），确保执行时受众不变',
  variables       JSON NULL                           COMMENT '模板全局变量，JSON 对象如 {"activityName":"双11"}，与用户级变量合并后渲染模板',
  schedule_type   VARCHAR(20) NOT NULL DEFAULT 'immediate' COMMENT '调度类型：immediate=立即发送 | scheduled=定时发送 | recurring=周期发送(cron/rrule)',
  scheduled_at    DATETIME NULL                       COMMENT '定时发送时间，仅 schedule_type=scheduled 时有值',
  cron_expression VARCHAR(64) NULL                    COMMENT 'Cron 表达式，仅 schedule_type=recurring 时使用，如 0 9 * * *',
  rrule           VARCHAR(500) NULL                   COMMENT 'iCalendar RRULE 表达式，支持更复杂的周期规则，如 FREQ=WEEKLY;BYDAY=MO,WE,FR',
  undo_window_sec INT UNSIGNED NOT NULL DEFAULT 0     COMMENT '撤销窗口秒数：发送后在此时间内可撤回；0=不可撤销',
  paused_at       DATETIME NULL                       COMMENT '任务暂停时间，非 NULL 表示当前处于暂停状态',
  canceled_at     DATETIME NULL                       COMMENT '任务取消时间，非 NULL 表示已被手动取消',
  next_fire_at    DATETIME NULL                       COMMENT '下次触发时间，周期任务由调度器计算并回写',
  last_fire_at    DATETIME NULL                       COMMENT '上次触发时间，周期任务执行后回写',
  priority        TINYINT NOT NULL DEFAULT 2          COMMENT '任务优先级：继承自通知类型，影响队列消费顺序；0=最高 3=最低',
  idempotent_key  VARCHAR(128) NULL                   COMMENT '幂等键：防止重复创建相同任务，全局唯一；如 feedback-reply-{id}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '任务状态：pending=待执行 | queued=已入队 | running=执行中 | completed=已完成 | paused=已暂停 | cancelled=已取消 | failed=失败',
  total_count     BIGINT NOT NULL DEFAULT 0           COMMENT '目标发送总数（受众人数 × 渠道数）',
  success_count   BIGINT NOT NULL DEFAULT 0           COMMENT '发送成功数，执行过程中实时更新',
  fail_count      BIGINT NOT NULL DEFAULT 0           COMMENT '发送失败数，执行过程中实时更新',
  skipped_count   BIGINT NOT NULL DEFAULT 0           COMMENT '跳过数（因偏好/频控/静默等原因跳过）',
  started_at      DATETIME NULL                       COMMENT '任务开始执行时间',
  finished_at     DATETIME NULL                       COMMENT '任务执行完成时间',
  error_message   TEXT NULL                           COMMENT '任务级错误信息，如队列异常、受众解析失败等',
  source          VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT '任务来源：admin=管理端手动创建 | trigger=业务触发式发送 | open_api=开放API调用',
  created_by      BIGINT UNSIGNED NULL                COMMENT '创建人用户ID，关联 users.id；trigger 来源时为 NULL',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  UNIQUE KEY uk_idempotent (idempotent_key),
  KEY idx_status (status),
  KEY idx_schedule (schedule_type, scheduled_at),
  KEY idx_creator (created_by, created_at),
  KEY idx_template (template_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发送任务表 - 管理定时和批量通知发送，支持即时/定时/周期三种调度模式';

-- ============================================================
-- 6. 用户消息记录表 (notification_messages) — 核心大表
-- 用途：存储每个用户收到的具体通知消息实例（用户视角的站内信）。
--       一条任务发送给 N 个用户 = N 条 messages 记录。
--       记录消息的已读/归档状态，支持 C 端消息列表、未读计数、消息详情等功能。
--       与 send_logs 的区别：messages 是用户视角的消息记录，
--       send_logs 是每个渠道下发动作的审计日志（1 message → N send_logs）。
-- 数据规模：千万级（用户数 × 消息频率），超 2000 万行时考虑按 user_id HASH 分表
-- 关联关系：task_id → notification_tasks.id；type_id → notification_types.id；
--           template_id → notification_templates.id；user_id → users.id；
--           被 notification_send_logs.message_id 引用
-- 保留策略：默认 90 天，由定时 schedule 清理过期数据
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_messages (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  task_id         BIGINT UNSIGNED NULL                COMMENT '所属任务ID，关联 notification_tasks.id；触发式发送时为 NULL',
  type_id         BIGINT UNSIGNED NOT NULL            COMMENT '通知类型ID，关联 notification_types.id，用于 C 端按类型筛选',
  template_id     BIGINT UNSIGNED NULL                COMMENT '使用的模板ID，关联 notification_templates.id；直接发送时可为 NULL',
  template_version INT NULL                           COMMENT '使用的模板版本号，用于追溯发送时的模板内容',
  user_id         BIGINT UNSIGNED NOT NULL            COMMENT '接收用户ID，关联 users.id',
  title           VARCHAR(200) NULL                   COMMENT '消息标题（模板渲染后的最终文本）',
  content         TEXT NOT NULL                       COMMENT '消息正文（模板渲染后的最终文本），站内信展示此内容',
  summary         VARCHAR(500) NULL                   COMMENT '消息摘要，用于列表页简短预览，超长内容截断展示',
  extra           JSON NULL                           COMMENT '扩展数据，如跳转链接 {"url":"/tools/123"}、图片、操作按钮等',
  channels        JSON NOT NULL                       COMMENT '本消息实际投递的渠道列表，JSON 数组如 ["in_app","email"]',
  priority        TINYINT NOT NULL DEFAULT 2          COMMENT '消息优先级：继承自通知类型，C 端可按优先级排序展示',
  is_read         TINYINT(1) NOT NULL DEFAULT 0       COMMENT '已读状态：0=未读 1=已读',
  read_at         DATETIME NULL                       COMMENT '用户阅读时间，标记已读时回写',
  is_archived     TINYINT(1) NOT NULL DEFAULT 0       COMMENT '归档状态：0=正常 1=已归档（用户手动归档，不在主列表显示）',
  archived_at     DATETIME NULL                       COMMENT '归档时间',
  expire_at       DATETIME NULL                       COMMENT '消息过期时间，过期后不再展示给用户；默认 180 天',
  idempotent_key  VARCHAR(128) NULL                   COMMENT '消息级幂等键：同一用户 24h 内相同 key 不重复发送，如 feedback-reply-{id}',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '消息创建时间（即发送时间）',
  UNIQUE KEY uk_user_idempotent (user_id, idempotent_key),
  KEY idx_user_unread (user_id, is_read, is_archived, created_at),
  KEY idx_user_type (user_id, type_id, created_at),
  KEY idx_task (task_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户消息记录 - 存储用户视角的站内信，支持已读/归档/过期管理';

-- ============================================================
-- 7. 用户订阅偏好表 (notification_user_preferences)
-- 用途：记录用户对通知类型 × 渠道的订阅设置，实现用户级别的通知偏好控制。
--       采用稀疏存储策略：表中无记录 = 默认订阅；
--       用户取消订阅时才插入 is_subscribed=0 的行。
--       发送时检查此表决定是否跳过某渠道（user_cancelable=0 的类型豁免检查）。
-- 数据规模：用户数 × 类型数 × 渠道数（稀疏，实际远小于理论值）
-- 关联关系：user_id → users.id；type_id → notification_types.id
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_user_preferences (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  user_id         BIGINT UNSIGNED NOT NULL            COMMENT '用户ID，关联 users.id',
  type_id         BIGINT UNSIGNED NOT NULL            COMMENT '通知类型ID，关联 notification_types.id',
  channel         VARCHAR(20) NOT NULL                COMMENT '渠道编码：in_app=站内信 | email=邮件 | sms=短信',
  is_subscribed   TINYINT(1) NOT NULL DEFAULT 1       COMMENT '订阅状态：1=已订阅(正常接收) 0=已取消(跳过发送)',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  UNIQUE KEY uk_user_type_channel (user_id, type_id, channel),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户订阅偏好 - 稀疏存储用户对通知类型×渠道的订阅设置';

-- ============================================================
-- 8. 用户全局静默时段表 (notification_user_quiet_hours)
-- 用途：记录用户设置的免打扰时间段，在静默时段内根据通知类型的
--       quiet_hour_policy 决定是否跳过发送。
--       支持用户自定义时区，确保跨时区场景下静默判断准确。
--       receive_urgent 字段允许用户在静默时段仍接收紧急通知（P0）。
-- 数据规模：≤ 用户数（每用户最多一条）
-- 关联关系：user_id → users.id（主键即外键）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_user_quiet_hours (
  user_id         BIGINT UNSIGNED PRIMARY KEY         COMMENT '用户ID，关联 users.id，一个用户只有一条静默配置',
  enabled         TINYINT(1) NOT NULL DEFAULT 0       COMMENT '是否启用免打扰：0=关闭 1=启用',
  quiet_start     TIME NULL                           COMMENT '静默开始时间，如 22:00:00；支持跨天（start > end 表示跨午夜）',
  quiet_end       TIME NULL                           COMMENT '静默结束时间，如 08:00:00',
  timezone        VARCHAR(40) NOT NULL DEFAULT 'Asia/Shanghai' COMMENT '用户时区，用于将当前时间转换为用户本地时间后判断是否命中静默',
  receive_urgent  TINYINT(1) NOT NULL DEFAULT 1       COMMENT '静默时段是否仍接收紧急通知(P0)：0=全部跳过 1=P0仍发送',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户免打扰 - 记录用户的静默时段配置，支持时区感知';

-- ============================================================
-- 9. 频控配置表 (notification_rate_limit_config)
-- 用途：配置用户/渠道/类型三维度的发送频次限制，防止用户被过度骚扰。
--       发送时按 scope 匹配规则，检查用户在指定窗口内的发送次数是否超限。
--       支持按优先级豁免：skip_priority 以下的优先级不受此规则约束。
--       规则缓存 5 分钟（Redis），修改后无需重启服务即可生效。
-- 数据规模：< 50 行
-- 关联关系：updated_by → users.id
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_rate_limit_config (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  scope           VARCHAR(20) NOT NULL                COMMENT '频控维度：global_user=全局用户级 | channel=渠道级 | type=类型级',
  target_key      VARCHAR(64) NULL                    COMMENT '目标键：scope=channel 时为渠道名(sms/email)；scope=type 时为类型 code；global_user 时为 NULL',
  `window`        VARCHAR(20) NOT NULL                COMMENT '时间窗口：hour=每小时 | day=每天 | week=每周',
  max_count       INT NOT NULL                        COMMENT '窗口内最大发送次数，超过则跳过发送',
  skip_priority   TINYINT NULL                        COMMENT '豁免优先级阈值：优先级 ≤ 此值的通知不受此规则约束；NULL=无豁免',
  enabled         TINYINT(1) NOT NULL DEFAULT 1       COMMENT '规则启用状态：0=已禁用 1=启用中',
  description     VARCHAR(200) NULL                   COMMENT '规则描述，帮助管理员理解规则用途',
  updated_by      BIGINT UNSIGNED NULL                COMMENT '最后修改人用户ID，关联 users.id',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  UNIQUE KEY uk_scope_target_window (scope, target_key, `window`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='频控配置 - 用户/渠道/类型三维度发送频次限制，防止过度骚扰';

-- ============================================================
-- 10. 渠道服务商配置表 (notification_channel_configs)
-- 用途：配置各发送渠道的服务商参数（SMTP/短信API/站内信等）。
--       同一渠道可配置多个服务商（主备切换），通过 priority 字段控制优先级。
--       支持健康检查机制，定时探测服务商可用性，异常时自动降级到备用服务商。
--       config 字段中的敏感信息（密码/密钥）采用 AES 加密存储。
-- 数据规模：< 20 行
-- 关联关系：被 notification_send_logs.provider 引用（逻辑关联）
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_channel_configs (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  channel         VARCHAR(20) NOT NULL                COMMENT '渠道编码：in_app=站内信 | email=邮件 | sms=短信',
  provider        VARCHAR(40) NOT NULL                COMMENT '服务商标识：如 native/smtp/tencent/aliyun 等',
  is_default      TINYINT(1) NOT NULL DEFAULT 0       COMMENT '是否默认服务商：同一渠道只能有一个默认，发送时优先使用默认服务商',
  priority        INT NOT NULL DEFAULT 100            COMMENT '主备优先级，数值越小优先级越高；同渠道多服务商时按此排序选择',
  config          JSON NOT NULL                       COMMENT '服务商凭证配置(JSON)，敏感字段 AES 加密；如 SMTP:{host,port,auth_user,auth_pass}；SMS:{sdk_app_id,secret_key}',
  enabled         TINYINT(1) NOT NULL DEFAULT 1       COMMENT '启用状态：0=已禁用(不参与发送) 1=启用中',
  health_status   VARCHAR(20) NOT NULL DEFAULT 'unknown' COMMENT '健康状态：unknown=未检测 | healthy=正常 | degraded=降级 | down=不可用',
  last_check_at   DATETIME NULL                       COMMENT '最后健康检查时间，由定时 schedule 回写',
  last_success_rate DECIMAL(5,2) NULL                  COMMENT '最近发送成功率(%)，用于监控和自动降级判断',
  description     VARCHAR(200) NULL                   COMMENT '配置描述，帮助管理员识别服务商用途',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  UNIQUE KEY uk_channel_provider (channel, provider),
  KEY idx_channel_default (channel, is_default, enabled),
  KEY idx_channel_priority (channel, enabled, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道服务商配置 - 配置各发送渠道参数，支持多服务商主备切换和健康检查';

-- ============================================================
-- 11. 渠道下发日志表 (notification_send_logs) — 核心大表
-- 用途：记录每个渠道的实际下发动作审计日志。
--       一条 message 发到 3 个渠道 = 3 条 send_logs。
--       记录完整的发送生命周期：入队 → 发送中 → 已发送 → 已送达/失败/跳过。
--       支持重试记录（attempt 字段）、耗时统计、服务商原始响应存储。
--       用于统计看板、发送漏斗分析、问题排查。
-- 数据规模：千万级（messages × 渠道数）
-- 保留策略：默认 90 天，由定时 schedule 清理过期数据
-- 关联关系：message_id → notification_messages.id；
--           task_id → notification_tasks.id；user_id → users.id
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_send_logs (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  message_id      BIGINT UNSIGNED NULL                COMMENT '关联消息ID，关联 notification_messages.id；广播任务可能为 NULL',
  task_id         BIGINT UNSIGNED NULL                COMMENT '关联任务ID，关联 notification_tasks.id；触发式发送时可能为 NULL',
  user_id         BIGINT UNSIGNED NOT NULL            COMMENT '接收用户ID，关联 users.id',
  channel         VARCHAR(20) NOT NULL                COMMENT '发送渠道：in_app=站内信 | email=邮件 | sms=短信',
  provider        VARCHAR(40) NULL                    COMMENT '实际使用的服务商标识，如 smtp/tencent/native',
  status          VARCHAR(20) NOT NULL                COMMENT '下发状态：queued=待发送 | sending=发送中 | sent=已发送 | delivered=已送达 | failed=失败 | skipped=跳过',
  skip_reason     VARCHAR(40) NULL                    COMMENT '跳过原因：preference=用户偏好 | rate_limit=频控 | quiet_hour=静默 | unsubscribed=已取消 | no_target=无目标',
  attempt         TINYINT NOT NULL DEFAULT 1          COMMENT '当前尝试次数（第几次重试）；P0 最多 5 次，其他默认 3 次',
  target          VARCHAR(200) NULL                   COMMENT '发送目标（脱敏存储）：邮箱如 z***g@example.com，手机如 138****1234',
  request_id      VARCHAR(128) NULL                   COMMENT '服务商返回的请求ID，用于跟服务商对账排查',
  error_code      VARCHAR(64) NULL                    COMMENT '错误码，服务商返回的错误编码',
  error_message   VARCHAR(500) NULL                   COMMENT '错误描述，服务商返回的错误信息或系统异常描述',
  extra           JSON NULL                           COMMENT '渠道返回的额外信息，如短信计费条数、邮件 messageId 等',
  raw_response    TEXT NULL                           COMMENT '服务商原始响应体，仅调试用，生产环境可配置不存储',
  cost_ms         INT NULL                           COMMENT '本次调用耗时(毫秒)，用于性能监控和服务商质量评估',
  sent_at         DATETIME NULL                       COMMENT '实际发送时间（调用服务商API的时间）',
  delivered_at    DATETIME NULL                       COMMENT '确认送达时间（服务商回调确认）；站内信等于 sent_at',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间（入队时间）',
  KEY idx_message (message_id),
  KEY idx_task (task_id),
  KEY idx_user_channel (user_id, channel, created_at),
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道下发日志 - 记录每个渠道的实际下发动作，支持重试/耗时/错误追踪';

-- ============================================================
-- 12. 导出任务表 (notification_export_jobs) — P3.1
-- 用途：管理通知数据导出任务，支持异步导出大量发送日志/消息记录为 CSV/Excel。
--       导出任务入队异步执行，完成后可通过邮件通知或直接下载。
--       导出文件有过期时间（默认 7 天），过期后由定时 schedule 自动清理。
-- 数据规模：百级（导出频率低）
-- 关联关系：created_by → users.id
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification_export_jobs` (
  `id`              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  `name`            VARCHAR(200) NOT NULL              COMMENT '导出任务名称，由系统自动生成或用户指定',
  `filter`          JSON NOT NULL                      COMMENT '导出筛选条件 JSON，如 {"from":"2024-01-01","to":"2024-01-31","typeId":1,"channel":"sms","status":"failed"}',
  `status`          ENUM('pending','running','completed','failed','expired') NOT NULL DEFAULT 'pending' COMMENT '任务状态：pending=等待执行 | running=执行中 | completed=已完成 | failed=失败 | expired=文件已过期',
  `total_rows`      INT UNSIGNED NULL                  COMMENT '导出总行数，执行完成后回写',
  `file_path`       VARCHAR(500) NULL                  COMMENT '导出文件存储路径（服务器本地或 OSS）',
  `file_size`       BIGINT UNSIGNED NULL               COMMENT '文件大小(字节)',
  `recipient_email` VARCHAR(200) NULL                  COMMENT '导出完成后发送通知的目标邮箱；为空则不发送邮件通知',
  `error_message`   TEXT NULL                          COMMENT '失败时的错误信息',
  `created_by`      BIGINT UNSIGNED NOT NULL           COMMENT '创建人用户ID，关联 users.id',
  `started_at`      DATETIME NULL                      COMMENT '任务开始执行时间',
  `finished_at`     DATETIME NULL                      COMMENT '任务执行完成时间',
  `expires_at`      DATETIME NULL                      COMMENT '文件过期时间，默认创建后 7 天；过期后由 cleanup_exports schedule 自动删除',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  KEY `idx_status_expires` (`status`, `expires_at`),
  KEY `idx_creator` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知导出任务 - 管理异步数据导出，支持筛选条件和文件过期自动清理';

-- ============================================================
-- 13. 定时调度元数据表 (notification_schedules) — P3.2
-- 用途：存储通知系统内部的定时任务元数据，如消息清理、会员到期提醒、健康检查等。
--       系统启动时读取此表注册 cron 任务，支持管理端动态暂停/恢复。
--       每次执行后回写 last_fire_at/last_status/last_message，便于监控。
-- 数据规模：< 20 行（系统内置调度）
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification_schedules` (
  `id`              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
  `code`            VARCHAR(100) NOT NULL UNIQUE       COMMENT '调度任务唯一编码，如 member_expire_soon/cleanup_messages',
  `name`            VARCHAR(200) NOT NULL              COMMENT '调度任务显示名称',
  `handler`         VARCHAR(100) NOT NULL              COMMENT '处理器 key，对应后端 service 中的处理函数名',
  `cron_expr`       VARCHAR(100) NOT NULL              COMMENT 'Cron 表达式，定义执行频率，如 0 9 * * * 表示每天 9 点',
  `enabled`         TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '启用状态：0=已暂停 1=启用中',
  `params`          JSON NULL                          COMMENT '处理器参数 JSON，如 {"retentionDays":90,"days":[7,3,1]}',
  `last_fire_at`    DATETIME NULL                      COMMENT '上次执行时间',
  `last_status`     ENUM('success','failed') NULL      COMMENT '上次执行结果：success=成功 | failed=失败',
  `last_message`    TEXT NULL                          COMMENT '上次执行的结果消息或错误信息',
  `next_fire_at`    DATETIME NULL                      COMMENT '下次预计执行时间，由调度器计算回写',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时调度元数据 - 管理通知系统内部定时任务，支持动态暂停/恢复';

-- ============================================================
-- 给 user_profiles 追加全局通知开关字段
-- ============================================================
ALTER TABLE user_profiles 
  ADD COLUMN notification_global_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '全局通知开关';

-- ============================================================
-- 给 users 追加语言偏好字段（P3.3 多语言支持）
-- ============================================================
ALTER TABLE `users`
  ADD COLUMN `lang` VARCHAR(10) NOT NULL DEFAULT 'zh-CN' COMMENT '用户语言偏好' AFTER `status`;

-- ============================================================
-- 预置通知类型（24 条，全部 is_system=1）
-- 含 P2/P3 新增类型：MEMBER_EXPIRE_SOON / ALERT_CRITICAL / BUSINESS_PLAN_ACTIVATED
-- ============================================================
INSERT INTO notification_types 
  (code, name, description, category, default_channels, user_cancelable, priority, quiet_hour_policy, icon, color, is_system, sort_order) 
VALUES
  ('SYSTEM_SECURITY',         '账号安全',     '账号安全相关通知',       'system',    '["in_app","email","sms"]', 0, 0, 'bypass',  'safety',     '#ff4d4f', 1, 1),
  ('SYSTEM_ANNOUNCEMENT',     '服务公告',     '平台服务公告',          'system',    '["in_app"]',               1, 1, 'respect', 'sound',      '#1890ff', 1, 2),
  ('SYSTEM_UNUSUAL_LOGIN',    '异常登录',     '异常登录提醒',          'system',    '["in_app","email","sms"]', 0, 0, 'bypass',  'warning',    '#fa8c16', 1, 3),
  ('SYSTEM_PASSWORD_CHANGED', '密码修改',     '密码修改通知',          'system',    '["in_app","email"]',       0, 0, 'bypass',  'lock',       '#fa8c16', 1, 4),
  ('SYSTEM_INTERNAL_ALERT',   '内部告警',     '管理员内部告警通知',     'system',    '["in_app"]',               0, 1, 'respect', 'bell',       '#722ed1', 1, 5),
  ('BUSINESS_FEEDBACK_REPLY', '反馈回复',     '反馈被管理员回复',      'business',  '["in_app","email"]',       1, 1, 'respect', 'comment',    '#52c41a', 1, 10),
  ('BUSINESS_FEEDBACK_STATUS','反馈状态变更', '反馈状态发生变更',       'business',  '["in_app"]',               1, 2, 'respect', 'message',    '#52c41a', 1, 11),
  ('BUSINESS_MEMBER_UPGRADE', '会员升级',     '会员升级成功',          'business',  '["in_app","email"]',       1, 1, 'respect', 'crown',      '#faad14', 1, 20),
  ('BUSINESS_MEMBER_EXPIRE_SOON', '会员即将到期', '会员即将到期提醒',   'business',  '["in_app","email","sms"]', 1, 1, 'respect', 'clock',      '#faad14', 1, 21),
  ('BUSINESS_MEMBER_EXPIRED', '会员已过期',   '会员已过期通知',        'business',  '["in_app","email"]',       1, 1, 'respect', 'stop',       '#faad14', 1, 22),
  ('BUSINESS_POINTS_CHANGE',  '积分变动',     '积分余额变动',          'business',  '["in_app"]',               1, 2, 'respect', 'gift',       '#eb2f96', 1, 23),
  ('BUSINESS_WELCOME',        '注册欢迎',     '新用户欢迎通知',        'business',  '["in_app"]',               1, 2, 'respect', 'smile',      '#13c2c2', 1, 24),
  ('BUSINESS_TOOL_PUBLISHED', '工具上线',     '收藏的工具上线',        'business',  '["in_app"]',               1, 2, 'respect', 'rocket',     '#13c2c2', 1, 25),
  ('BUSINESS_TOOL_UNPUBLISHED','工具下架',    '收藏的工具下架',        'business',  '["in_app"]',               1, 2, 'respect', 'pause',      '#8c8c8c', 1, 26),
  ('BUSINESS_INVITE_SUCCESS', '邀请成功',     '邀请好友注册成功',      'business',  '["in_app"]',               1, 2, 'respect', 'user-add',   '#52c41a', 1, 27),
  ('BUSINESS_PLAN_ACTIVATED', '套餐开通',     '用户开通付费套餐通知',  'business',  '["in_app","email"]',       1, 1, 'respect', 'crown',      '#faad14', 1, 28),
  ('MARKETING_ACTIVITY',      '活动推送',     '运营活动推送',          'marketing', '["in_app","email"]',       1, 3, 'respect', 'fire',       '#ff7a45', 1, 30),
  ('MARKETING_RECOMMEND',     '个性化推荐',   '个性化内容推荐',        'marketing', '["in_app"]',               1, 3, 'respect', 'star',       '#ff7a45', 1, 31),
  ('VERIFY_CODE_LOGIN',       '验证码-登录',  '登录场景验证码',        'system',    '["sms","email"]',          0, 0, 'bypass',  'safety',     '#ff4d4f', 1, 90),
  ('VERIFY_CODE_REGISTER',    '验证码-注册',  '注册场景验证码',        'system',    '["sms","email"]',          0, 0, 'bypass',  'safety',     '#ff4d4f', 1, 91),
  ('VERIFY_CODE_RESET',       '验证码-重置密码','重置密码场景验证码',   'system',    '["sms","email"]',          0, 0, 'bypass',  'safety',     '#ff4d4f', 1, 92),
  ('VERIFY_CODE_BIND',        '验证码-绑定',  '绑定账号场景验证码',    'system',    '["sms","email"]',          0, 0, 'bypass',  'safety',     '#ff4d4f', 1, 93),
  ('MEMBER_EXPIRE_SOON',      '会员即将到期', '会员即将到期定时提醒',  'business',  '["in_app","email"]',       1, 2, 'respect', 'clock',      '#faad14', 1, 94),
  ('ALERT_CRITICAL',          '系统严重告警', '系统严重告警通知',      'system',    '["in_app","email"]',       0, 0, 'bypass',  'warning',    '#ff4d4f', 1, 95);

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
-- 预置渠道服务商配置
-- in_app/email(smtp占位)/sms(mock) 为初始配置；
-- sms(tencent) 为 P3.4 真实集成配置，生产环境需替换 CHANGE_IN_PROD 占位符
-- ============================================================
INSERT INTO notification_channel_configs 
  (channel, provider, is_default, priority, config, enabled, description) 
VALUES
  ('in_app', 'native',  1, 10, JSON_OBJECT(), 1, '站内信：直写 DB + Socket emit'),
  ('email',  'smtp',    1, 10, JSON_OBJECT('host','smtp.example.com','port',587,'secure',false,'auth_user','noreply@example.com','auth_pass','PLACEHOLDER'), 0, 'SMTP 占位（生产环境启用）'),
  ('sms',    'mock',    1, 10, JSON_OBJECT(), 1, '短信：mock 模式（开发/测试用）'),
  ('sms',    'tencent', 0, 20, JSON_OBJECT(
    'sdk_app_id', 'CHANGE_IN_PROD',
    'secret_id',  'CHANGE_IN_PROD',
    'secret_key', 'CHANGE_IN_PROD',
    'sign',       'super-tools',
    'template_default', '12345'
  ), 1, '腾讯云 SMS（生产环境需替换凭证）');

-- ============================================================
-- 预置定时调度（5 条）
-- 4 条内置调度（来自 P3.2）+ 1 条邮件健康检查（来自 P3.3）
-- ============================================================
INSERT INTO `notification_schedules` (`code`,`name`,`handler`,`cron_expr`,`enabled`,`params`,`created_at`,`updated_at`) VALUES
  ('member_expire_soon', '会员到期提醒',    'memberExpireSoon', '0 9 * * *',  1, JSON_OBJECT('days', JSON_ARRAY(7,3,1)), NOW(), NOW()),
  ('cleanup_messages',   '消息表清理',      'cleanupMessages',  '0 3 * * *',  1, JSON_OBJECT('retentionDays', 90),       NOW(), NOW()),
  ('cleanup_send_logs',  '发送日志清理',    'cleanupSendLogs',  '30 3 * * *', 1, JSON_OBJECT('retentionDays', 30),       NOW(), NOW()),
  ('cleanup_exports',    '导出文件清理',    'cleanupExports',   '15 * * * *', 1, JSON_OBJECT(),                          NOW(), NOW()),
  ('mail_health_check',  '邮件 SMTP 健康检查', 'mailHealthCheck', '*/5 * * * *', 1, JSON_OBJECT(),                      NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================
-- 预置模板种子数据（P2.4 业务触发点 in_app 模板，5 条）
-- ============================================================
INSERT IGNORE INTO notification_templates
  (type_id, code, name, channel, title_template, content_template, current_version, status, created_by, description)
SELECT t.id, CONCAT(t.code, '_INAPP'), CONCAT(t.name, '-站内信'), 'in_app',
  CASE t.code
    WHEN 'BUSINESS_MEMBER_UPGRADE'   THEN '恭喜会员升级'
    WHEN 'BUSINESS_POINTS_CHANGE'    THEN '积分变动通知'
    WHEN 'BUSINESS_INVITE_SUCCESS'   THEN '邀请好友成功'
    WHEN 'BUSINESS_TOOL_PUBLISHED'   THEN '工具上线通知'
    WHEN 'BUSINESS_TOOL_UNPUBLISHED' THEN '工具下架通知'
  END,
  CASE t.code
    WHEN 'BUSINESS_MEMBER_UPGRADE'   THEN '恭喜！您的会员等级已升级至 {{levelName}}，享受更多权益。'
    WHEN 'BUSINESS_POINTS_CHANGE'    THEN '您的积分发生变动：{{changeType}} {{points}} 积分，当前余额 {{balance}}。'
    WHEN 'BUSINESS_INVITE_SUCCESS'   THEN '您邀请的好友 {{friendName}} 已成功注册，奖励积分已到账。'
    WHEN 'BUSINESS_TOOL_PUBLISHED'   THEN '您收藏的工具「{{toolName}}」已上线，快去体验吧！'
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

-- ============================================================
-- 预置模板种子数据（P3 套餐开通 in_app 模板，1 条）
-- ============================================================
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

--  dashboard_widgets 字典扩展（5 种 widget）不是写入DB的，而是在前端定义
-- INSERT IGNORE INTO `dashboard_widgets` (`code`, `name`, `default_w`, `default_h`, `data_source`, `required_perm`, `created_at`, `updated_at`) VALUES
--   ('notif_unread_count',     '我的未读通知',       2, 1, 'notification:unread',           'notification:message:view',  NOW(), NOW()),
--   ('notif_send_trend_7d',    '近 7 天发送趋势',    4, 2, 'notification:stats:trend7d',    'notification:stats:view',    NOW(), NOW()),
--   ('notif_channel_dist_pie', '渠道分布',           2, 2, 'notification:stats:byChannel',  'notification:stats:view',    NOW(), NOW()),
--   ('notif_top_types',        'Top 通知类型',       2, 2, 'notification:stats:byType',     'notification:stats:view',    NOW(), NOW()),
--   ('notif_queue_depth',      '队列深度',           2, 1, 'notification:queue:depth',      'notification:stats:view',    NOW(), NOW());

-- ============================================================
-- 幂等清理 — 删除本脚本管理的 notification 模块权限
-- ============================================================

-- 删除 notification 模块权限的角色映射
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'notification';

-- 删除 notification 模块所有权限
DELETE FROM `permissions` WHERE module = 'notification';

-- ============================================================
-- 新增顶级目录（type=1）
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `parent_id`, `sort`)
VALUES
  ('notification', '通知管理', 1, 'notification', 'BellOutlined', 'admin', '/notification', 0, 80);

-- ============================================================
-- 新增二级菜单（type=2）— 6 个页面入口
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:type', '通知类型', 2, 'notification', NULL, 'admin', '/notification/type', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 10
UNION ALL
SELECT 'notification:template', '通知模板', 2, 'notification', NULL, 'admin', '/notification/template', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 20
UNION ALL
SELECT 'notification:task', '通知任务', 2, 'notification', NULL, 'admin', '/notification/task', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 30
UNION ALL
SELECT 'notification:audience', '受众分组', 2, 'notification', NULL, 'admin', '/notification/audience', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 40
UNION ALL
SELECT 'notification:message', '消息记录', 2, 'notification', NULL, 'admin', '/notification/message', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 50
UNION ALL
SELECT 'notification:stats', '通知统计', 2, 'notification', NULL, 'admin', '/notification/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 60;
UNION ALL
SELECT 'notification:rate-limits', '频控规则', 2, 'notification', NULL, 'admin', '/notification/rate-limits', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 70;

-- ============================================================
-- 新增按钮/操作权限（type=3）— 7 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:type:manage', '管理通知类型', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:type') t), 10
UNION ALL
SELECT 'notification:template:manage', '管理通知模板', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 10
UNION ALL
SELECT 'notification:template:publish', '发布通知模板', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 20
UNION ALL
SELECT 'notification:task:create', '创建通知任务', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 10
UNION ALL
SELECT 'notification:task:control', '暂停/取消通知任务', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 20
UNION ALL
SELECT 'notification:audience:manage', '管理受众分组', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 10
UNION ALL
SELECT 'notification:stats:export', '导出通知统计报表', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 10;

-- ============================================================
-- 新增系统配置 + 导出权限（type=3，挂在顶级目录下）
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:config:manage', '管理通知系统配置', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 90
UNION ALL
SELECT 'notification:export:create', '创建通知导出任务', 3, 'notification', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 20;

-- ============================================================
-- 新增 API 权限（type=4）— 48 条
-- ============================================================

-- ----- 通知类型 API — 4 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:type:list', '通知类型列表', 4, 'notification', 'admin',
       '/api/admin/notification/types', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:type') t), 100
UNION ALL
SELECT 'notification:type:create', '创建通知类型', 4, 'notification', 'admin',
       '/api/admin/notification/types', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:type') t), 110
UNION ALL
SELECT 'notification:type:update', '更新通知类型', 4, 'notification', 'admin',
       '/api/admin/notification/types/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:type') t), 120
UNION ALL
SELECT 'notification:type:delete', '删除通知类型', 4, 'notification', 'admin',
       '/api/admin/notification/types/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:type') t), 130;

-- ----- 通知模板 API — 8 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:template:list', '模板列表', 4, 'notification', 'admin',
       '/api/admin/notification/templates', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 100
UNION ALL
SELECT 'notification:template:detail', '模板详情', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 110
UNION ALL
SELECT 'notification:template:create', '创建模板', 4, 'notification', 'admin',
       '/api/admin/notification/templates', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 120
UNION ALL
SELECT 'notification:template:update', '更新模板', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 130
UNION ALL
SELECT 'notification:template:do-publish', '发布模板', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id/publish', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 140
UNION ALL
SELECT 'notification:template:preview', '预览模板', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id/preview', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 150
UNION ALL
SELECT 'notification:template:test-send', '测试发送模板', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id/test-send', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 160
UNION ALL
SELECT 'notification:template:rollback', '回滚模板版本', 4, 'notification', 'admin',
       '/api/admin/notification/templates/:id/rollback/:versionId', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:template') t), 170;

-- ----- 通知任务 API — 8 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:task:list', '任务列表', 4, 'notification', 'admin',
       '/api/admin/notification/tasks', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 100
UNION ALL
SELECT 'notification:task:detail', '任务详情', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 110
UNION ALL
SELECT 'notification:task:do-create', '创建即时任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 120
UNION ALL
SELECT 'notification:task:create-scheduled', '创建定时任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/scheduled', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 130
UNION ALL
SELECT 'notification:task:pause', '暂停任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/:id/pause', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 140
UNION ALL
SELECT 'notification:task:resume', '恢复任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/:id/resume', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 150
UNION ALL
SELECT 'notification:task:cancel', '取消任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/:id/cancel', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 160
UNION ALL
SELECT 'notification:task:undo', '撤回任务', 4, 'notification', 'admin',
       '/api/admin/notification/tasks/:id/undo', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:task') t), 170;

-- ----- 消息记录 API — 2 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:message:list', '消息列表', 4, 'notification', 'admin',
       '/api/admin/notification/messages', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:message') t), 100
UNION ALL
SELECT 'notification:message:detail', '消息详情', 4, 'notification', 'admin',
       '/api/admin/notification/messages/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:message') t), 110;

-- ----- 受众分组 API — 7 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:audience:fields', '受众字段白名单', 4, 'notification', 'admin',
       '/api/admin/notification/audiences/fields', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 100
UNION ALL
SELECT 'notification:audience:preview', '受众预览', 4, 'notification', 'admin',
       '/api/admin/notification/audiences/preview', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 110
UNION ALL
SELECT 'notification:audience:list', '受众列表', 4, 'notification', 'admin',
       '/api/admin/notification/audiences', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 120
UNION ALL
SELECT 'notification:audience:detail', '受众详情', 4, 'notification', 'admin',
       '/api/admin/notification/audiences/:id', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 130
UNION ALL
SELECT 'notification:audience:create', '创建受众', 4, 'notification', 'admin',
       '/api/admin/notification/audiences', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 140
UNION ALL
SELECT 'notification:audience:update', '更新受众', 4, 'notification', 'admin',
       '/api/admin/notification/audiences/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 150
UNION ALL
SELECT 'notification:audience:delete', '删除受众', 4, 'notification', 'admin',
       '/api/admin/notification/audiences/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:audience') t), 160;

-- ----- 通知统计 API — 5 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:stats:overview', '统计概览', 4, 'notification', 'admin',
       '/api/admin/notification/stats/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 100
UNION ALL
SELECT 'notification:stats:trend', '统计趋势', 4, 'notification', 'admin',
       '/api/admin/notification/stats/trend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 110
UNION ALL
SELECT 'notification:stats:by-channel', '按渠道统计', 4, 'notification', 'admin',
       '/api/admin/notification/stats/by-channel', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 120
UNION ALL
SELECT 'notification:stats:by-type', '按类型统计', 4, 'notification', 'admin',
       '/api/admin/notification/stats/by-type', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 130
UNION ALL
SELECT 'notification:stats:funnel', '发送漏斗', 4, 'notification', 'admin',
       '/api/admin/notification/stats/funnel', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 140;

-- ----- 导出 API — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:export:do-create', '创建导出任务', 4, 'notification', 'admin',
       '/api/admin/notification/exports', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 200
UNION ALL
SELECT 'notification:export:list', '导出任务列表', 4, 'notification', 'admin',
       '/api/admin/notification/exports', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 210
UNION ALL
SELECT 'notification:export:download', '下载导出文件', 4, 'notification', 'admin',
       '/api/admin/notification/exports/:id/download', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 220;

-- ----- 频控配置 API — 4 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:rate-limit:list', '频控规则列表', 4, 'notification', 'admin',
       '/api/admin/notification/rate-limits', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:rate-limits') t), 200
UNION ALL
SELECT 'notification:rate-limit:create', '创建频控规则', 4, 'notification', 'admin',
       '/api/admin/notification/rate-limits', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:rate-limits') t), 210
UNION ALL
SELECT 'notification:rate-limit:update', '更新频控规则', 4, 'notification', 'admin',
       '/api/admin/notification/rate-limits/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:rate-limits') t), 220
UNION ALL
SELECT 'notification:rate-limit:delete', '删除频控规则', 4, 'notification', 'admin',
       '/api/admin/notification/rate-limits/:id', 'DELETE',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:rate-limits') t), 230;

-- ----- 渠道配置 API — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:channel:list', '渠道配置列表', 4, 'notification', 'admin',
       '/api/admin/notification/channels', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 240
UNION ALL
SELECT 'notification:channel:update', '更新渠道配置', 4, 'notification', 'admin',
       '/api/admin/notification/channels/:id', 'PUT',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 250
UNION ALL
SELECT 'notification:channel:test-smtp', '测试 SMTP 连接', 4, 'notification', 'admin',
       '/api/admin/notification/channels/test-smtp', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 260;

-- ----- Schedule API — 3 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:schedule:list', 'Schedule 列表', 4, 'notification', 'admin',
       '/api/admin/notification/schedules', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 270
UNION ALL
SELECT 'notification:schedule:pause', '暂停 Schedule', 4, 'notification', 'admin',
       '/api/admin/notification/schedules/:id/pause', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 280
UNION ALL
SELECT 'notification:schedule:resume', '恢复 Schedule', 4, 'notification', 'admin',
       '/api/admin/notification/schedules/:id/resume', 'POST',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification') t), 290;

-- ----- 队列监控 API — 1 条 -----
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'notification:queue:depths', '队列深度监控', 4, 'notification', 'admin',
       '/api/admin/notification/queues/depths', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'notification:stats') t), 300;

-- ============================================================
-- 角色 × 权限映射
-- ============================================================
-- 说明：super_admin 中间件短路，不受 RBAC 限制，无需写入 role_permissions

-- ----- admin 角色：全部 notification 权限 -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.module = 'notification';

-- ----- operator 角色：所有菜单 + 部分操作 + 对应 API（无 publish、无 config:manage、无 stats:export） -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.module = 'notification'
  AND p.code IN (
    -- 顶级目录 + 菜单
    'notification',
    'notification:type', 'notification:template', 'notification:task',
    'notification:audience', 'notification:message', 'notification:stats',
    -- 操作
    'notification:type:manage',
    'notification:template:manage',
    'notification:task:create', 'notification:task:control',
    'notification:audience:manage',
    -- 类型 API
    'notification:type:list', 'notification:type:create',
    'notification:type:update', 'notification:type:delete',
    -- 模板 API（不含 publish/rollback）
    'notification:template:list', 'notification:template:detail',
    'notification:template:create', 'notification:template:update',
    'notification:template:preview', 'notification:template:test-send',
    -- 任务 API（全部）
    'notification:task:list', 'notification:task:detail',
    'notification:task:do-create', 'notification:task:create-scheduled',
    'notification:task:pause', 'notification:task:resume',
    'notification:task:cancel', 'notification:task:undo',
    -- 消息 API
    'notification:message:list', 'notification:message:detail',
    -- 受众 API（全部）
    'notification:audience:fields', 'notification:audience:preview',
    'notification:audience:list', 'notification:audience:detail',
    'notification:audience:create', 'notification:audience:update', 'notification:audience:delete',
    -- 统计 API（只读）
    'notification:stats:overview', 'notification:stats:trend',
    'notification:stats:by-channel', 'notification:stats:by-type', 'notification:stats:funnel',
    -- 队列监控
    'notification:queue:depths'
  );

-- ----- auditor 角色：所有菜单（只读）+ 只读 API + stats:export + 导出 -----
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.module = 'notification'
  AND p.code IN (
    -- 顶级目录 + 菜单
    'notification',
    'notification:type', 'notification:template', 'notification:task',
    'notification:audience', 'notification:message', 'notification:stats',
    -- 操作
    'notification:stats:export', 'notification:export:create',
    -- 只读 API
    'notification:type:list',
    'notification:template:list', 'notification:template:detail', 'notification:template:preview',
    'notification:task:list', 'notification:task:detail',
    'notification:message:list', 'notification:message:detail',
    'notification:audience:fields', 'notification:audience:list', 'notification:audience:detail',
    'notification:stats:overview', 'notification:stats:trend',
    'notification:stats:by-channel', 'notification:stats:by-type', 'notification:stats:funnel',
    -- 导出 API
    'notification:export:do-create', 'notification:export:list', 'notification:export:download',
    -- 队列监控
    'notification:queue:depths'
  );

-- ============================================================
-- 数据校验（手动执行）
-- ============================================================
-- 检查 notification 模块权限总数
-- SELECT COUNT(*) FROM `permissions` WHERE module = 'notification';
-- 期望: 1(目录) + 6(菜单) + 9(按钮/操作) + 48(API) = 64
--
-- 检查各层级数量
-- SELECT type, COUNT(*) FROM `permissions` WHERE module = 'notification' GROUP BY type;
-- 期望: type=1 → 1, type=2 → 6, type=3 → 9, type=4 → 48
--
-- 检查角色权限数量
-- SELECT r.code, COUNT(rp.permission_id) FROM `role_permissions` rp
--   JOIN `roles` r ON rp.role_id = r.id
--   JOIN `permissions` p ON rp.permission_id = p.id
--   WHERE p.module = 'notification'
--   GROUP BY r.code ORDER BY COUNT(rp.permission_id) DESC;
-- 期望: admin=64(全部), operator≈46, auditor≈28

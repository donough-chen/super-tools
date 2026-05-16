# P1-05：11 个 Sequelize Model（Task 5）

> 子文件 5/12，对应 [P1 总览](./2026-05-16-notification-phase-1-00-overview.md) Task 5。

**Goal:** 为 Task 4 创建的 11 张表实现对应 Sequelize Model，统一遵循项目现有约定（`BIGINT.UNSIGNED` 主键、`underscored: true`、`field` 显式映射 snake_case、JSON/TIME/DECIMAL 类型）。

**Files:**（11 个新建）
- Create: `super-tool-node/app/model/notification_type.ts`
- Create: `super-tool-node/app/model/notification_template.ts`
- Create: `super-tool-node/app/model/notification_template_version.ts`
- Create: `super-tool-node/app/model/notification_audience.ts`
- Create: `super-tool-node/app/model/notification_task.ts`
- Create: `super-tool-node/app/model/notification_message.ts`
- Create: `super-tool-node/app/model/notification_user_preference.ts`
- Create: `super-tool-node/app/model/notification_user_quiet_hours.ts`
- Create: `super-tool-node/app/model/notification_rate_limit_config.ts`
- Create: `super-tool-node/app/model/notification_channel_config.ts`
- Create: `super-tool-node/app/model/notification_send_log.ts`

**前置依赖**：[Task 4](./p1-04-migration.md)（DB 迁移已执行）

> **风格参考**：项目现有 `app/model/alert_log.ts` / `alert_rule.ts`。所有 model 按字母顺序文件名；associate 用 `(M as any).associate = () => {...}` 风格（与 alert 模型一致）。

---

## Step 1: notification_type.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationType = app.model.define('NotificationType', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    parentId:         { type: BIGINT.UNSIGNED, allowNull: true, field: 'parent_id' },
    code:             { type: STRING(64), allowNull: false },
    name:             { type: STRING(100), allowNull: false },
    description:      { type: STRING(500), allowNull: true },
    category:         { type: STRING(20), allowNull: false },
    defaultChannels:  { type: JSON_TYPE, allowNull: false, field: 'default_channels' },
    userCancelable:   { type: TINYINT(1), allowNull: false, defaultValue: 1, field: 'user_cancelable' },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    icon:             { type: STRING(64), allowNull: true },
    color:            { type: STRING(16), allowNull: true },
    status:           { type: TINYINT(1), allowNull: false, defaultValue: 1 },
    sortOrder:        { type: INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    isSystem:         { type: TINYINT(1), allowNull: false, defaultValue: 0, field: 'is_system' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_types',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (NotificationType as any).associate = () => {
    NotificationType.hasMany(app.model.NotificationTemplate, { foreignKey: 'type_id', as: 'templates' });
  };

  return NotificationType;
};
```

## Step 2: notification_template.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationTemplate = app.model.define('NotificationTemplate', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    code:             { type: STRING(64), allowNull: false },
    name:             { type: STRING(100), allowNull: false },
    channel:          { type: STRING(20), allowNull: false },
    titleTemplate:    { type: STRING(200), allowNull: true, field: 'title_template' },
    contentTemplate:  { type: TEXT, allowNull: false, field: 'content_template' },
    extraConfig:      { type: JSON_TYPE, allowNull: true, field: 'extra_config' },
    sampleVariables:  { type: JSON_TYPE, allowNull: true, field: 'sample_variables' },
    currentVersion:   { type: INTEGER, allowNull: false, defaultValue: 1, field: 'current_version' },
    status:           { type: TINYINT(1), allowNull: false, defaultValue: 0 },
    description:      { type: STRING(500), allowNull: true },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    updatedBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'updated_by' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_templates',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (NotificationTemplate as any).associate = () => {
    NotificationTemplate.belongsTo(app.model.NotificationType, { foreignKey: 'type_id', as: 'type' });
    NotificationTemplate.hasMany(app.model.NotificationTemplateVersion, { foreignKey: 'template_id', as: 'versions' });
  };

  return NotificationTemplate;
};
```

## Step 3: notification_template_version.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, INTEGER, JSON: JSON_TYPE } = DataTypes;
  const NotificationTemplateVersion = app.model.define('NotificationTemplateVersion', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    templateId:       { type: BIGINT.UNSIGNED, allowNull: false, field: 'template_id' },
    version:          { type: INTEGER, allowNull: false },
    titleTemplate:    { type: STRING(200), allowNull: true, field: 'title_template' },
    contentTemplate:  { type: TEXT, allowNull: false, field: 'content_template' },
    extraConfig:      { type: JSON_TYPE, allowNull: true, field: 'extra_config' },
    changeNote:       { type: STRING(500), allowNull: true, field: 'change_note' },
    publishedBy:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'published_by' },
  }, {
    tableName: 'notification_template_versions',
    timestamps: true,
    createdAt: 'published_at',
    updatedAt: false,
    underscored: true,
  });

  return NotificationTemplateVersion;
};
```

## Step 4: notification_audience.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationAudience = app.model.define('NotificationAudience', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name:             { type: STRING(100), allowNull: false },
    code:             { type: STRING(64), allowNull: true },
    description:      { type: STRING(500), allowNull: true },
    audienceType:     { type: STRING(20), allowNull: false, field: 'audience_type' },
    staticUserIds:    { type: JSON_TYPE, allowNull: true, field: 'static_user_ids' },
    dynamicRules:     { type: JSON_TYPE, allowNull: true, field: 'dynamic_rules' },
    cachedCount:      { type: BIGINT, allowNull: true, field: 'cached_count' },
    cachedAt:         { type: DATE, allowNull: true, field: 'cached_at' },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_audiences',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return NotificationAudience;
};
```

## Step 5: notification_task.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationTask = app.model.define('NotificationTask', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name:             { type: STRING(200), allowNull: false },
    description:      { type: STRING(500), allowNull: true },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    templateCode:     { type: STRING(64), allowNull: false, field: 'template_code' },
    channels:         { type: JSON_TYPE, allowNull: false },
    audienceId:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'audience_id' },
    audienceSnapshot: { type: JSON_TYPE, allowNull: true, field: 'audience_snapshot' },
    variables:        { type: JSON_TYPE, allowNull: true },
    scheduleType:     { type: STRING(20), allowNull: false, defaultValue: 'immediate', field: 'schedule_type' },
    scheduledAt:      { type: DATE, allowNull: true, field: 'scheduled_at' },
    cronExpression:   { type: STRING(64), allowNull: true, field: 'cron_expression' },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    idempotentKey:    { type: STRING(128), allowNull: true, field: 'idempotent_key' },
    status:           { type: STRING(20), allowNull: false, defaultValue: 'pending' },
    totalCount:       { type: BIGINT, allowNull: false, defaultValue: 0, field: 'total_count' },
    successCount:     { type: BIGINT, allowNull: false, defaultValue: 0, field: 'success_count' },
    failCount:        { type: BIGINT, allowNull: false, defaultValue: 0, field: 'fail_count' },
    skippedCount:     { type: BIGINT, allowNull: false, defaultValue: 0, field: 'skipped_count' },
    startedAt:        { type: DATE, allowNull: true, field: 'started_at' },
    finishedAt:       { type: DATE, allowNull: true, field: 'finished_at' },
    errorMessage:     { type: TEXT, allowNull: true, field: 'error_message' },
    source:           { type: STRING(20), allowNull: false, defaultValue: 'admin' },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  }, {
    tableName: 'notification_tasks',
    timestamps: true,
    underscored: true,
  });

  return NotificationTask;
};
```

## Step 6: notification_message.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationMessage = app.model.define('NotificationMessage', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    taskId:           { type: BIGINT.UNSIGNED, allowNull: true, field: 'task_id' },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    templateId:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'template_id' },
    templateVersion:  { type: INTEGER, allowNull: true, field: 'template_version' },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    title:            { type: STRING(200), allowNull: true },
    content:          { type: TEXT, allowNull: false },
    summary:          { type: STRING(500), allowNull: true },
    extra:            { type: JSON_TYPE, allowNull: true },
    channels:         { type: JSON_TYPE, allowNull: false },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    isRead:           { type: TINYINT(1), allowNull: false, defaultValue: 0, field: 'is_read' },
    readAt:           { type: DATE, allowNull: true, field: 'read_at' },
    isArchived:       { type: TINYINT(1), allowNull: false, defaultValue: 0, field: 'is_archived' },
    archivedAt:       { type: DATE, allowNull: true, field: 'archived_at' },
    expireAt:         { type: DATE, allowNull: true, field: 'expire_at' },
    idempotentKey:    { type: STRING(128), allowNull: true, field: 'idempotent_key' },
  }, {
    tableName: 'notification_messages',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  (NotificationMessage as any).associate = () => {
    NotificationMessage.belongsTo(app.model.NotificationType, { foreignKey: 'type_id', as: 'type' });
    NotificationMessage.belongsTo(app.model.NotificationTask, { foreignKey: 'task_id', as: 'task' });
  };

  return NotificationMessage;
};
```

## Step 7: notification_user_preference.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT } = DataTypes;
  const NotificationUserPreference = app.model.define('NotificationUserPreference', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    channel:          { type: STRING(20), allowNull: false },
    isSubscribed:     { type: TINYINT(1), allowNull: false, defaultValue: 1, field: 'is_subscribed' },
  }, {
    tableName: 'notification_user_preferences',
    timestamps: true,
    createdAt: false,
    underscored: true,
  });

  return NotificationUserPreference;
};
```

## Step 8: notification_user_quiet_hours.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, TIME } = DataTypes;
  const NotificationUserQuietHours = app.model.define('NotificationUserQuietHours', {
    userId:           { type: BIGINT.UNSIGNED, primaryKey: true, field: 'user_id' },
    enabled:          { type: TINYINT(1), allowNull: false, defaultValue: 0 },
    quietStart:       { type: TIME, allowNull: true, field: 'quiet_start' },
    quietEnd:         { type: TIME, allowNull: true, field: 'quiet_end' },
    timezone:         { type: STRING(40), allowNull: false, defaultValue: 'Asia/Shanghai' },
    receiveUrgent:    { type: TINYINT(1), allowNull: false, defaultValue: 1, field: 'receive_urgent' },
  }, {
    tableName: 'notification_user_quiet_hours',
    timestamps: true,
    createdAt: false,
    underscored: true,
  });

  return NotificationUserQuietHours;
};
```

## Step 9: notification_rate_limit_config.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, INTEGER } = DataTypes;
  const NotificationRateLimitConfig = app.model.define('NotificationRateLimitConfig', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    scope:            { type: STRING(20), allowNull: false },
    targetKey:        { type: STRING(64), allowNull: true, field: 'target_key' },
    window:           { type: STRING(20), allowNull: false },
    maxCount:         { type: INTEGER, allowNull: false, field: 'max_count' },
    skipPriority:     { type: TINYINT, allowNull: true, field: 'skip_priority' },
    enabled:          { type: TINYINT(1), allowNull: false, defaultValue: 1 },
    description:      { type: STRING(200), allowNull: true },
    updatedBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'updated_by' },
  }, {
    tableName: 'notification_rate_limit_config',
    timestamps: true,
    underscored: true,
  });

  return NotificationRateLimitConfig;
};
```

## Step 10: notification_channel_config.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, DECIMAL, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationChannelConfig = app.model.define('NotificationChannelConfig', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    channel:          { type: STRING(20), allowNull: false },
    provider:         { type: STRING(40), allowNull: false },
    isDefault:        { type: TINYINT(1), allowNull: false, defaultValue: 0, field: 'is_default' },
    config:           { type: JSON_TYPE, allowNull: false },
    enabled:          { type: TINYINT(1), allowNull: false, defaultValue: 1 },
    healthStatus:     { type: STRING(20), allowNull: false, defaultValue: 'unknown', field: 'health_status' },
    lastCheckAt:      { type: DATE, allowNull: true, field: 'last_check_at' },
    lastSuccessRate:  { type: DECIMAL(5, 2), allowNull: true, field: 'last_success_rate' },
    description:      { type: STRING(200), allowNull: true },
  }, {
    tableName: 'notification_channel_configs',
    timestamps: true,
    underscored: true,
  });

  return NotificationChannelConfig;
};
```

## Step 11: notification_send_log.ts

- [ ] 创建文件

```ts
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE } = DataTypes;
  const NotificationSendLog = app.model.define('NotificationSendLog', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    messageId:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'message_id' },
    taskId:           { type: BIGINT.UNSIGNED, allowNull: true, field: 'task_id' },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    channel:          { type: STRING(20), allowNull: false },
    provider:         { type: STRING(40), allowNull: true },
    status:           { type: STRING(20), allowNull: false },
    skipReason:       { type: STRING(40), allowNull: true, field: 'skip_reason' },
    attempt:          { type: TINYINT, allowNull: false, defaultValue: 1 },
    target:           { type: STRING(200), allowNull: true },
    requestId:        { type: STRING(128), allowNull: true, field: 'request_id' },
    errorCode:        { type: STRING(64), allowNull: true, field: 'error_code' },
    errorMessage:     { type: STRING(500), allowNull: true, field: 'error_message' },
    rawResponse:      { type: TEXT, allowNull: true, field: 'raw_response' },
    costMs:           { type: INTEGER, allowNull: true, field: 'cost_ms' },
    sentAt:           { type: DATE, allowNull: true, field: 'sent_at' },
    deliveredAt:      { type: DATE, allowNull: true, field: 'delivered_at' },
  }, {
    tableName: 'notification_send_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return NotificationSendLog;
};
```

---

## Step 12: 启动验证

- [ ] 启动 dev 服务

Run:

```bash
cd super-tool-node
npm run dev
```

Expected: 服务正常启动，Sequelize 加载日志中可见 11 个 model 注册（`Loaded model NotificationType` 等）；无 "Cannot find table" 错误。

如出现 `column does not exist`：检查 model 中 `field` 映射的 snake_case 名称是否与迁移 SQL 一致。

- [ ] 用 lint 检查类型

Run:

```bash
cd super-tool-node
npm run lint
```

Expected: 无 TypeScript 错误。

---

## Step 13: 简单 sanity check

- [ ] 写一次性脚本验证 model 能查询数据

Run（创建临时脚本 `scripts/test-notification-models.ts`）：

```ts
// scripts/test-notification-models.ts（执行后可删除）
import { app } from 'egg-mock/bootstrap';

(async () => {
  const types = await app.model.NotificationType.findAll({ attributes: ['code', 'name'] });
  console.log('Types loaded:', types.length);
  console.log('Sample:', types.slice(0, 3).map((t: any) => t.toJSON()));

  const rateLimits = await app.model.NotificationRateLimitConfig.count();
  console.log('Rate limits:', rateLimits);

  const channels = await app.model.NotificationChannelConfig.count();
  console.log('Channels:', channels);

  process.exit(0);
})();
```

Run:

```bash
cd super-tool-node
npx ts-node scripts/test-notification-models.ts
```

Expected output:

```
Types loaded: 21
Sample: [
  { code: 'SYSTEM_SECURITY', name: '账号安全' },
  { code: 'SYSTEM_ANNOUNCEMENT', name: '服务公告' },
  { code: 'SYSTEM_UNUSUAL_LOGIN', name: '异常登录' }
]
Rate limits: 6
Channels: 3
```

> 跑完后删除 `scripts/test-notification-models.ts`（这只是 sanity check）。

---

## Step 14: Commit

- [ ] 提交所有 11 个 model 文件

```bash
git add super-tool-node/app/model/notification_*.ts
git commit -m "feat(notification): add 11 sequelize models for notification system

Models follow project conventions:
- BIGINT.UNSIGNED primary keys
- underscored: true with explicit field mapping
- paranoid: true for soft-deletable tables (types/templates/audiences)
- JSON, TIME, DECIMAL types where appropriate
- Associations: NotificationType.hasMany(NotificationTemplate),
  NotificationTemplate.belongsTo(NotificationType),
  NotificationMessage.belongsTo(NotificationType/NotificationTask)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2)"
```

---

## Verification Checklist

- [ ] 11 个 `notification_*.ts` model 文件全部创建
- [ ] `npm run dev` 启动成功，无 model 加载错误
- [ ] sanity check 脚本输出符合预期（21 / 6 / 3）
- [ ] `npm run lint` 通过
- [ ] git commit 已提交

完成本 Task 后请进入 [`p1-06-services-template-pref-audience.md`](./p1-06-services-template-pref-audience.md)。

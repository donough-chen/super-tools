# P2.1-02：DB 迁移 019 + Sequelize Model 更新（Task 2）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 1（[`p2-1-01-deps-config.md`](./p2-1-01-deps-config.md)）

---

## Step 1: 创建迁移 SQL `database/019_p2_rate_quiet_mail.sql`

- [ ] 内容：

```sql
-- =====================================================
-- 019: P2.1 频控 / 静默 / 邮件 字段补齐
-- =====================================================

-- 1. 类型表加 quietHourPolicy
ALTER TABLE `notification_types`
  ADD COLUMN `quiet_hour_policy` ENUM('respect','bypass','relax') NOT NULL DEFAULT 'respect'
  COMMENT '静默策略：respect=命中跳过；bypass=不受静默约束；relax=只跳 inApp 不跳 sms/email'
  AFTER `priority`;

-- 2. 频控规则表（P1 已建空表，本步补齐字段）
ALTER TABLE `notification_rate_limit_config`
  MODIFY COLUMN `scope` ENUM('user_type','user_global','global','channel') NOT NULL,
  ADD COLUMN `type_id` BIGINT UNSIGNED NULL COMMENT 'scope=user_type 时关联' AFTER `scope`,
  ADD COLUMN `channel` ENUM('inApp','email','sms') NULL COMMENT 'scope=channel 时关联' AFTER `type_id`,
  ADD COLUMN `window_seconds` INT UNSIGNED NOT NULL COMMENT '统计窗口秒数' AFTER `channel`,
  ADD COLUMN `max_count` INT UNSIGNED NOT NULL COMMENT '窗口内最大次数' AFTER `window_seconds`,
  ADD COLUMN `enabled` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `max_count`,
  ADD COLUMN `description` VARCHAR(500) NULL AFTER `enabled`,
  ADD INDEX `idx_scope` (`scope`, `type_id`, `channel`);

-- 3. 渠道配置表完善 SMTP
ALTER TABLE `notification_channel_config`
  ADD COLUMN `is_default` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '同 channel 仅一条 1' AFTER `enabled`,
  ADD COLUMN `last_health_at` DATETIME NULL AFTER `is_default`,
  ADD COLUMN `last_health_ok` TINYINT UNSIGNED NULL AFTER `last_health_at`;

-- 4. send_logs.message_id 改为可空 + 加 extra
ALTER TABLE `notification_send_logs`
  MODIFY COLUMN `message_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `extra` JSON NULL AFTER `error_message`;

-- 5. 预置频控规则
INSERT INTO `notification_rate_limit_config`
  (`scope`,`type_id`,`channel`,`window_seconds`,`max_count`,`enabled`,`description`,`created_at`,`updated_at`)
VALUES
  ('user_global', NULL, NULL, 3600,  50,   1, '每用户每小时最多 50 条', NOW(), NOW()),
  ('user_global', NULL, NULL, 86400, 200,  1, '每用户每天最多 200 条', NOW(), NOW()),
  ('global',      NULL, NULL, 60,    5000, 1, '全站每分钟最多 5000 条', NOW(), NOW()),
  ('channel',     NULL, 'email', 60, 500,  1, '邮件渠道每分钟 500 条（SMTP 限速）', NOW(), NOW()),
  ('channel',     NULL, 'sms',   60, 200,  1, '短信渠道每分钟 200 条', NOW(), NOW());

-- 6. 安全/系统类高优先级通知静默策略改 bypass
UPDATE `notification_types`
SET `quiet_hour_policy` = 'bypass'
WHERE `category` IN ('security','system') AND `priority` = 'high';

-- 7. 默认 SMTP 通道占位
INSERT IGNORE INTO `notification_channel_config`
  (`channel`,`provider`,`enabled`,`config`,`is_default`,`description`,`created_at`,`updated_at`)
VALUES
  ('email','smtp',1,JSON_OBJECT(
    'host','smtp.example.com',
    'port',587,
    'secure',false,
    'pool',true,
    'maxConnections',5,
    'auth_user','noreply@example.com',
    'auth_pass','CHANGE_IN_PROD'
  ),1,'默认 SMTP（启动时由 mail.ts 加载）',NOW(),NOW());

-- 8. 权限码补齐（P1 应已加 notification:config:view/edit；如未加则 INSERT IGNORE）
INSERT IGNORE INTO `admin_permissions` (`code`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  ('notification:config:view', '查看通知配置', 'notification', '频控/渠道配置查看', NOW(), NOW()),
  ('notification:config:edit', '编辑通知配置', 'notification', '频控/渠道配置编辑',  NOW(), NOW());

-- 9. 把上述权限挂到 superadmin
INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code = 'superadmin'
  AND p.code IN ('notification:config:view','notification:config:edit');
```

---

## Step 2: 创建回滚 `database/019_rollback.sql`

- [ ] 内容：

```sql
DELETE FROM `admin_role_permissions`
WHERE permission_id IN (
  SELECT id FROM `admin_permissions`
  WHERE code IN ('notification:config:view','notification:config:edit')
);
DELETE FROM `admin_permissions`
WHERE code IN ('notification:config:view','notification:config:edit');

DELETE FROM `notification_rate_limit_config`
WHERE description IN (
  '每用户每小时最多 50 条',
  '每用户每天最多 200 条',
  '全站每分钟最多 5000 条',
  '邮件渠道每分钟 500 条（SMTP 限速）',
  '短信渠道每分钟 200 条'
);
DELETE FROM `notification_channel_config`
WHERE provider = 'smtp' AND description = '默认 SMTP（启动时由 mail.ts 加载）';

ALTER TABLE `notification_send_logs`
  DROP COLUMN `extra`,
  MODIFY COLUMN `message_id` BIGINT UNSIGNED NOT NULL;

ALTER TABLE `notification_channel_config`
  DROP COLUMN `last_health_ok`,
  DROP COLUMN `last_health_at`,
  DROP COLUMN `is_default`;

ALTER TABLE `notification_rate_limit_config`
  DROP INDEX `idx_scope`,
  DROP COLUMN `description`,
  DROP COLUMN `enabled`,
  DROP COLUMN `max_count`,
  DROP COLUMN `window_seconds`,
  DROP COLUMN `channel`,
  DROP COLUMN `type_id`;

ALTER TABLE `notification_types`
  DROP COLUMN `quiet_hour_policy`;
```

---

## Step 3: 更新 Sequelize Model

### 3.1 `app/model/notification_type.ts`

- [ ] 在字段定义中添加：

```typescript
quietHourPolicy: { type: STRING(16), allowNull: false, defaultValue: 'respect',
  field: 'quiet_hour_policy' },
```

### 3.2 `app/model/notification_rate_limit_config.ts`

- [ ] 替换为完整字段定义（保留 P1 已有 id/createdAt/updatedAt）：

```typescript
const cfg = app.model.define('NotificationRateLimitConfig', {
  id:            { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  scope:         { type: STRING(20), allowNull: false }, // user_type/user_global/global/channel
  typeId:        { type: BIGINT.UNSIGNED, allowNull: true,  field: 'type_id' },
  channel:       { type: STRING(16),       allowNull: true },
  windowSeconds: { type: INTEGER.UNSIGNED, allowNull: false, field: 'window_seconds' },
  maxCount:      { type: INTEGER.UNSIGNED, allowNull: false, field: 'max_count' },
  enabled:       { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  description:   { type: STRING(500),      allowNull: true },
  createdAt:     { type: DATE, field: 'created_at' },
  updatedAt:     { type: DATE, field: 'updated_at' },
}, { tableName: 'notification_rate_limit_config' });
```

### 3.3 `app/model/notification_channel_config.ts`

- [ ] 添加：

```typescript
isDefault:      { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'is_default' },
lastHealthAt:   { type: DATE, allowNull: true, field: 'last_health_at' },
lastHealthOk:   { type: TINYINT.UNSIGNED, allowNull: true, field: 'last_health_ok' },
```

### 3.4 `app/model/notification_send_log.ts`

- [ ] `messageId` 改 `allowNull: true`；新增 `extra: { type: JSON, allowNull: true }`

---

## Step 4: 验证

- [ ] 干净库执行：

```bash
mysql -u root -p super_tools < super-tool-node/database/019_p2_rate_quiet_mail.sql
mysql -u root -p super_tools -e "DESC notification_types;" | grep quiet_hour_policy
mysql -u root -p super_tools -e "SHOW INDEX FROM notification_rate_limit_config;" | grep idx_scope
mysql -u root -p super_tools -e "SELECT scope, max_count FROM notification_rate_limit_config;"
```

预期：5 行 INSERT 数据可见；`quiet_hour_policy` 列存在；`idx_scope` 索引存在。

- [ ] 验证回滚：

```bash
mysql -u root -p super_tools < super-tool-node/database/019_rollback.sql
mysql -u root -p super_tools -e "DESC notification_types;" | grep -c quiet_hour_policy
# 预期 0
```

- [ ] 再次 up 应成功（验证幂等）：

```bash
mysql -u root -p super_tools < super-tool-node/database/019_p2_rate_quiet_mail.sql
```

---

## Step 5: Commit

```bash
git add super-tool-node/database/019_p2_rate_quiet_mail.sql super-tool-node/database/019_rollback.sql super-tool-node/app/model/notification_type.ts super-tool-node/app/model/notification_rate_limit_config.ts super-tool-node/app/model/notification_channel_config.ts super-tool-node/app/model/notification_send_log.ts
git commit -m "feat(notification): db migration 019 (rate config + quiet policy + smtp default)

- Add notification_types.quiet_hour_policy
- Complete notification_rate_limit_config schema (5 columns)
- Add notification_channel_config.is_default & health columns
- Make notification_send_logs.message_id nullable + extra json
- Seed 5 rate rules + smtp default + 2 perm codes

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §5.4 §7)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 2)"
```

---

## Verification Checklist

- [ ] up 脚本执行无错
- [ ] rollback 脚本执行无错
- [ ] up → rollback → up 循环 2 次成功
- [ ] 4 个 Model 文件均含新字段
- [ ] commit 已提交

完成后进入 [`p2-1-03-quiet-hours.md`](./p2-1-03-quiet-hours.md)。

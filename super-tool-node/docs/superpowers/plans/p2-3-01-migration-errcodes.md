# P2.3-01：DB 迁移 021 + 错误码 + Model（Task 1）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)

---

## Step 1: 创建 `database/021_p2_dynamic_audience.sql`

```sql
-- =====================================================
-- 021: P2.3 动态受众规则
-- =====================================================

-- 1. 受众分组表（可复用，多个 task 引用同一个 audience）
CREATE TABLE IF NOT EXISTS `notification_audiences` (
  `id`            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `name`          VARCHAR(200) NOT NULL,
  `description`   VARCHAR(500) NULL,
  `audience_type` ENUM('static','dynamic') NOT NULL DEFAULT 'dynamic',
  `audience_rule` JSON NOT NULL COMMENT 'static={userIds:[]}; dynamic={operator,conditions:[]}',
  `last_preview_count` INT UNSIGNED NULL COMMENT '最近一次预览的总用户数',
  `last_preview_at`    DATETIME NULL,
  `created_by`    BIGINT UNSIGNED NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_type` (`audience_type`),
  KEY `idx_creator` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='通知受众分组（可复用）';

-- 2. 任务表新增 audience_id（指向受众分组；与 audienceRule 内联两种方式并存）
ALTER TABLE `notification_tasks`
  ADD COLUMN `audience_id` BIGINT UNSIGNED NULL COMMENT '指向 notification_audiences；为 NULL 时用 audienceRule 内联' AFTER `audience_rule`,
  ADD INDEX `idx_audience_id` (`audience_id`);

-- 3. 权限码
INSERT IGNORE INTO `admin_permissions` (`code`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  ('notification:audience:view', '查看通知受众',  'notification', '受众分组列表查看',         NOW(), NOW()),
  ('notification:audience:edit', '编辑通知受众',  'notification', '创建/编辑/删除受众分组', NOW(), NOW()),
  ('notification:audience:preview', '受众预览',  'notification', '试算受众规则匹配人数',   NOW(), NOW());

INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code IN ('superadmin','opsAdmin')
  AND p.code IN (
    'notification:audience:view',
    'notification:audience:edit',
    'notification:audience:preview'
  );
```

---

## Step 2: 创建 `database/021_rollback.sql`

```sql
DELETE FROM `admin_role_permissions`
WHERE permission_id IN (
  SELECT id FROM `admin_permissions`
  WHERE code IN (
    'notification:audience:view',
    'notification:audience:edit',
    'notification:audience:preview'
  )
);
DELETE FROM `admin_permissions`
WHERE code IN (
  'notification:audience:view',
  'notification:audience:edit',
  'notification:audience:preview'
);

ALTER TABLE `notification_tasks`
  DROP INDEX `idx_audience_id`,
  DROP COLUMN `audience_id`;

DROP TABLE IF EXISTS `notification_audiences`;
```

---

## Step 3: 修改 `app/constants/errorCodes.ts`

P1+P2.1+P2.2 已有错误码后追加：

```typescript
// 受众扩展 108211-108222（108201 已在 P1 占位为 DYNAMIC_NOT_IMPL，本次保留为兼容；新代码不再使用）
NOTIFY_AUDIENCE_FIELD_INVALID:    { code: 108211, message: '受众规则字段不在白名单' },
NOTIFY_AUDIENCE_OP_INVALID:       { code: 108212, message: '受众规则操作符非法' },
NOTIFY_AUDIENCE_NESTED_TOO_DEEP:  { code: 108220, message: '受众规则嵌套层数过深（≤3）' },
NOTIFY_AUDIENCE_VALUE_INVALID:    { code: 108221, message: '受众规则 value 类型与字段不匹配' },
NOTIFY_AUDIENCE_PREVIEW_TIMEOUT:  { code: 108222, message: '受众预览查询超时' },
```

> P1 已存在 `108201 DYNAMIC_NOT_IMPL / 108202 AUDIENCE_TYPE_INVALID / 108210 AUDIENCE_NOT_FOUND` 三个，本次不动。

`NOTIF_ERR` 短别名段补：

```typescript
AUDIENCE_FIELD_INVALID:   ErrorCodes.NOTIFY_AUDIENCE_FIELD_INVALID,
AUDIENCE_OP_INVALID:      ErrorCodes.NOTIFY_AUDIENCE_OP_INVALID,
AUDIENCE_NESTED_TOO_DEEP: ErrorCodes.NOTIFY_AUDIENCE_NESTED_TOO_DEEP,
AUDIENCE_VALUE_INVALID:   ErrorCodes.NOTIFY_AUDIENCE_VALUE_INVALID,
AUDIENCE_PREVIEW_TIMEOUT: ErrorCodes.NOTIFY_AUDIENCE_PREVIEW_TIMEOUT,
```

---

## Step 4: 创建 / 完善 `app/model/notification_audience.ts`

```typescript
import { Application } from 'egg';

export default (app: Application) => {
  const { BIGINT, STRING, INTEGER, JSON: JSONType, DATE, ENUM } = app.Sequelize;
  const NotificationAudience = app.model.define('NotificationAudience', {
    id:            { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name:          { type: STRING(200), allowNull: false },
    description:   { type: STRING(500), allowNull: true },
    audienceType:  { type: ENUM('static','dynamic'), allowNull: false,
                     defaultValue: 'dynamic', field: 'audience_type' },
    audienceRule:  { type: JSONType, allowNull: false, field: 'audience_rule' },
    lastPreviewCount: { type: INTEGER.UNSIGNED, allowNull: true, field: 'last_preview_count' },
    lastPreviewAt:    { type: DATE, allowNull: true, field: 'last_preview_at' },
    createdBy:     { type: BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
    createdAt:     { type: DATE, field: 'created_at' },
    updatedAt:     { type: DATE, field: 'updated_at' },
  }, { tableName: 'notification_audiences' });
  return NotificationAudience;
};
```

---

## Step 5: 修改 `app/model/notification_task.ts`，加 `audienceId` 字段

```typescript
audienceId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'audience_id' },
```

---

## Step 6: 验证

```bash
mysql -u root -p super_tools < super-tool-node/database/021_p2_dynamic_audience.sql
mysql -u root -p super_tools -e "DESC notification_audiences;"
mysql -u root -p super_tools -e "SELECT code FROM admin_permissions WHERE code LIKE 'notification:audience:%';"
```

预期：表存在；3 个权限码可见。

回滚验证：

```bash
mysql -u root -p super_tools < super-tool-node/database/021_rollback.sql
mysql -u root -p super_tools -e "SHOW TABLES LIKE 'notification_audiences';"
```

预期：返回 0 行。

up → rollback → up 循环 2 次成功。

---

## Step 7: Commit

```bash
git add super-tool-node/database/021_p2_dynamic_audience.sql super-tool-node/database/021_rollback.sql super-tool-node/app/constants/errorCodes.ts super-tool-node/app/model/notification_audience.ts super-tool-node/app/model/notification_task.ts
git commit -m "feat(notification): db migration 021 (audiences table + 3 perms) + 5 error codes

- New table notification_audiences (reusable groups)
- notification_tasks.audience_id (link to reusable group; null=inline rule)
- 3 perms (audience view/edit/preview) bound to superadmin & opsAdmin
- 5 new error codes 108211-108222

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 1)"
```

---

## Verification Checklist

- [ ] 表 `notification_audiences` 建立成功
- [ ] 3 个权限码 + role 映射就绪
- [ ] 5 个错误码 + 短别名映射
- [ ] up & rollback 双向通过
- [ ] commit 已提交

完成后进入 [`p2-3-02-relative-time.md`](./p2-3-02-relative-time.md)。

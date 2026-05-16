# P2.2-02：DB 迁移 020 + Model 字段（Task 2）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 1（[`p2-2-01-deps-config.md`](./p2-2-01-deps-config.md)）

---

## Step 1: 创建 `database/020_p2_task_schedule.sql`

```sql
-- =====================================================
-- 020: P2.2 任务调度字段补齐
-- =====================================================

-- 1. 任务表新增 8 字段 + 扩展 send_type / status 枚举
ALTER TABLE `notification_tasks`
  MODIFY COLUMN `send_type` ENUM('immediate','scheduled','cron','rrule') NOT NULL DEFAULT 'immediate',
  MODIFY COLUMN `status` ENUM('pending','scheduled','running','paused','completed','failed','canceled') NOT NULL DEFAULT 'pending',
  ADD COLUMN `scheduled_at`   DATETIME NULL COMMENT 'send_type=scheduled 时的目标时间' AFTER `send_type`,
  ADD COLUMN `cron_expr`      VARCHAR(100) NULL COMMENT 'send_type=cron 表达式（如 0 9 * * *）' AFTER `scheduled_at`,
  ADD COLUMN `rrule`          VARCHAR(500) NULL COMMENT 'send_type=rrule 字符串（FREQ=...）' AFTER `cron_expr`,
  ADD COLUMN `undo_window_sec` INT UNSIGNED NULL COMMENT 'immediate 任务的撤销窗口秒数' AFTER `rrule`,
  ADD COLUMN `paused_at`      DATETIME NULL AFTER `started_at`,
  ADD COLUMN `canceled_at`    DATETIME NULL AFTER `paused_at`,
  ADD COLUMN `next_fire_at`   DATETIME NULL COMMENT '下次触发时间（cron/rrule）' AFTER `canceled_at`,
  ADD COLUMN `last_fire_at`   DATETIME NULL COMMENT '上次触发时间（cron/rrule）' AFTER `next_fire_at`,
  ADD INDEX `idx_status_next_fire` (`status`, `next_fire_at`),
  ADD INDEX `idx_send_type` (`send_type`);

-- 2. 权限码补齐
INSERT IGNORE INTO `admin_permissions` (`code`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  ('notification:task:pause',  '暂停通知任务', 'notification', '可暂停 scheduled/running 任务', NOW(), NOW()),
  ('notification:task:cancel', '取消通知任务', 'notification', '可取消未完成任务',           NOW(), NOW()),
  ('notification:task:undo',   '撤销立即任务', 'notification', '撤销窗口内可撤销 immediate', NOW(), NOW());

INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code = 'superadmin'
  AND p.code IN ('notification:task:pause','notification:task:cancel','notification:task:undo');

-- 3. 把上述 3 个权限同样挂到 opsAdmin（运营管理员）若存在
INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code = 'opsAdmin'
  AND p.code IN ('notification:task:pause','notification:task:cancel','notification:task:undo');
```

---

## Step 2: 创建 `database/020_rollback.sql`

```sql
DELETE FROM `admin_role_permissions`
WHERE permission_id IN (
  SELECT id FROM `admin_permissions`
  WHERE code IN ('notification:task:pause','notification:task:cancel','notification:task:undo')
);
DELETE FROM `admin_permissions`
WHERE code IN ('notification:task:pause','notification:task:cancel','notification:task:undo');

ALTER TABLE `notification_tasks`
  DROP INDEX `idx_send_type`,
  DROP INDEX `idx_status_next_fire`,
  DROP COLUMN `last_fire_at`,
  DROP COLUMN `next_fire_at`,
  DROP COLUMN `canceled_at`,
  DROP COLUMN `paused_at`,
  DROP COLUMN `undo_window_sec`,
  DROP COLUMN `rrule`,
  DROP COLUMN `cron_expr`,
  DROP COLUMN `scheduled_at`,
  MODIFY COLUMN `status` ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
  MODIFY COLUMN `send_type` ENUM('immediate') NOT NULL DEFAULT 'immediate';
```

> **回滚警告**：`status` 与 `send_type` 收窄前应确保不存在 scheduled/cron/rrule/paused/canceled 行，否则 ALTER 会失败。本计划文档建议在生产回滚前先 `UPDATE notification_tasks SET status='failed' WHERE status IN (...)`。

---

## Step 3: 更新 Sequelize Model `app/model/notification_task.ts`

在字段定义中追加：

```typescript
sendType:       { type: STRING(20), allowNull: false, defaultValue: 'immediate', field: 'send_type' },
status:         { type: STRING(20), allowNull: false, defaultValue: 'pending' },
scheduledAt:    { type: DATE, allowNull: true,  field: 'scheduled_at' },
cronExpr:       { type: STRING(100), allowNull: true, field: 'cron_expr' },
rrule:          { type: STRING(500), allowNull: true },
undoWindowSec:  { type: INTEGER.UNSIGNED, allowNull: true, field: 'undo_window_sec' },
pausedAt:       { type: DATE, allowNull: true, field: 'paused_at' },
canceledAt:     { type: DATE, allowNull: true, field: 'canceled_at' },
nextFireAt:     { type: DATE, allowNull: true, field: 'next_fire_at' },
lastFireAt:     { type: DATE, allowNull: true, field: 'last_fire_at' },
```

> P1 已存在的字段（id / name / typeId / audienceType / audienceRule / params / channels / status / startedAt / finishedAt / totalUsers / totalMessages / failReason / createdBy）保留不动。

---

## Step 4: 验证

```bash
mysql -u root -p super_tools < super-tool-node/database/020_p2_task_schedule.sql
mysql -u root -p super_tools -e "DESC notification_tasks;" | grep -E "send_type|scheduled_at|cron_expr|rrule|paused_at|next_fire_at"
mysql -u root -p super_tools -e "SHOW INDEX FROM notification_tasks WHERE Key_name='idx_status_next_fire';"
```

预期：8 个新列与 2 个新索引存在。

回滚验证：

```bash
mysql -u root -p super_tools < super-tool-node/database/020_rollback.sql
mysql -u root -p super_tools -e "DESC notification_tasks;" | grep -c rrule
# 预期 0
```

up → rollback → up 循环 2 次成功。

---

## Step 5: Commit

```bash
git add super-tool-node/database/020_p2_task_schedule.sql super-tool-node/database/020_rollback.sql super-tool-node/app/model/notification_task.ts
git commit -m "feat(notification): db migration 020 (task scheduling fields + 3 perms)

- Extend send_type enum: immediate/scheduled/cron/rrule
- Extend status enum: +scheduled/paused/canceled
- Add 8 new columns: scheduled_at/cron_expr/rrule/undo_window_sec/paused_at/canceled_at/next_fire_at/last_fire_at
- Add 2 indexes (status+next_fire_at, send_type)
- Seed 3 perms (task:pause/cancel/undo) bound to superadmin & opsAdmin

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6 §5.4)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 2)"
```

---

## Verification Checklist

- [ ] up & rollback 各执行成功
- [ ] up → rollback → up 循环 2 次
- [ ] Model 含 10 个新字段
- [ ] commit 已提交

完成后进入 [`p2-2-03-helpers.md`](./p2-2-03-helpers.md)。

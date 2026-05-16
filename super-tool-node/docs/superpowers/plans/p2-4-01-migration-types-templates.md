# P2.4-01：DB 迁移 022（5 业务类型 + 模板）+ 错误码（Task 1）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)

---

## Step 1: 创建 `database/022_p2_business_triggers.sql`

```sql
-- =====================================================
-- 022: P2.4 业务触发点 5 类型 + 模板
-- =====================================================

-- 1. 5 个业务类型
INSERT INTO `notification_types`
  (`type_key`, `name`, `category`, `default_channels`, `priority`,
   `quiet_hour_policy`, `enabled`, `created_at`, `updated_at`) VALUES
  ('member_upgrade',     '会员升级成功', 'business', JSON_ARRAY('inApp','email'), 'high',   'respect', 1, NOW(), NOW()),
  ('points_change',      '积分变动',     'business', JSON_ARRAY('inApp'),         'normal', 'respect', 1, NOW(), NOW()),
  ('invite_success',     '邀请好友成功', 'business', JSON_ARRAY('inApp'),         'normal', 'respect', 1, NOW(), NOW()),
  ('tool_published',     '工具上线',     'business', JSON_ARRAY('inApp'),         'normal', 'respect', 1, NOW(), NOW()),
  ('tool_unpublished',   '工具下架',     'business', JSON_ARRAY('inApp'),         'normal', 'respect', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  default_channels = VALUES(default_channels),
  updated_at = NOW();

-- 2. 模板（zh-CN/inApp 5 条 + zh-CN/email 1 条 for member_upgrade）
INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '🎉 会员升级成功',
       '亲爱的 {{userName}}，您已成功升级为 {{levelName}} 会员，有效期至 {{expireAt}}。',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'member_upgrade'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'email',
       '【super-tools】您的会员已升级为 {{levelName}}',
       '<p>您好 {{userName}}，</p><p>您于 {{upgradeAt}} 成功升级为 <b>{{levelName}}</b> 会员。</p><p>有效期至 <b>{{expireAt}}</b>。</p><p>感谢您的支持！</p>',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'member_upgrade'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '积分变动通知',
       '您的积分 {{action}} {{amount}}，当前余额 {{balance}}。原因：{{reason}}。',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'points_change'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '🎁 邀请好友成功',
       '您邀请的好友 {{inviteeName}} 已成功注册，奖励 {{rewardPoints}} 积分已到账。',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'invite_success'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '🆕 您收藏的工具已上线',
       '您收藏的工具 <b>{{toolName}}</b> 已正式上线，立即体验：{{toolUrl}}',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'tool_published'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`,
   `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '工具下架通知',
       '您收藏的工具 <b>{{toolName}}</b> 已下架，原因：{{reason}}。建议查看类似工具：{{alternativeUrl}}',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'tool_unpublished'
ON DUPLICATE KEY UPDATE updated_at = NOW();
```

> **注意**：`notification_templates` 表 P1 应已加唯一约束 `UNIQUE(type_id, lang, channel, version)`；如未加则上述 ON DUPLICATE KEY 不会触发。可在迁移开头追加：
>
> ```sql
> -- 兜底：如未加唯一索引则补
> ALTER TABLE `notification_templates`
>   ADD UNIQUE KEY IF NOT EXISTS `uk_type_lang_channel_version` (`type_id`,`lang`,`channel`,`version`);
> ```

---

## Step 2: 创建 `database/022_rollback.sql`

```sql
DELETE FROM `notification_templates`
WHERE type_id IN (
  SELECT id FROM `notification_types`
  WHERE type_key IN ('member_upgrade','points_change','invite_success','tool_published','tool_unpublished')
);

DELETE FROM `notification_types`
WHERE type_key IN ('member_upgrade','points_change','invite_success','tool_published','tool_unpublished');
```

> 回滚前请确保无任务/消息引用这些 type；生产场景建议 `UPDATE` enabled=0 而非 DELETE。

---

## Step 3: 修改 `app/constants/errorCodes.ts`，追加 2 个

```typescript
NOTIFY_TEMPLATE_VERSION_NOT_FOUND:    { code: 108120, message: '模板版本不存在' },
NOTIFY_TEMPLATE_ROLLBACK_SAME_VERSION:{ code: 108121, message: '回滚目标与当前活跃版本相同' },
```

`NOTIF_ERR` 短别名补：

```typescript
TEMPLATE_VERSION_NOT_FOUND:     ErrorCodes.NOTIFY_TEMPLATE_VERSION_NOT_FOUND,
TEMPLATE_ROLLBACK_SAME_VERSION: ErrorCodes.NOTIFY_TEMPLATE_ROLLBACK_SAME_VERSION,
```

---

## Step 4: 验证

```bash
mysql -u root -p super_tools < super-tool-node/database/022_p2_business_triggers.sql
mysql -u root -p super_tools -e "SELECT type_key, default_channels, priority FROM notification_types WHERE type_key IN ('member_upgrade','points_change','invite_success','tool_published','tool_unpublished');"
mysql -u root -p super_tools -e "SELECT t.type_key, tpl.lang, tpl.channel, tpl.version, tpl.is_active FROM notification_templates tpl JOIN notification_types t ON t.id = tpl.type_id WHERE t.type_key LIKE 'member_%' OR t.type_key LIKE 'tool_%' OR t.type_key IN ('points_change','invite_success');"
```

预期：5 type + 6 template 行可见（member_upgrade 多一条 email 模板）。

回滚验证：

```bash
mysql -u root -p super_tools < super-tool-node/database/022_rollback.sql
```

up → rollback → up 循环 2 次成功。

---

## Step 5: Commit

```bash
git add super-tool-node/database/022_p2_business_triggers.sql super-tool-node/database/022_rollback.sql super-tool-node/app/constants/errorCodes.ts
git commit -m "feat(notification): db migration 022 (5 business triggers types+templates) + 2 errcodes

- 5 types: member_upgrade / points_change / invite_success / tool_published / tool_unpublished
- 6 templates (5 inApp + 1 email for member_upgrade)
- 2 new errcodes 108120/108121 for template version rollback

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11.2 §5.2)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 1)"
```

---

## Verification Checklist

- [ ] 5 type + 6 template seed 成功
- [ ] up & rollback 双向成功
- [ ] errorCodes 含 108120/108121 + 短别名
- [ ] commit 已提交

完成后并行进入 [`p2-4-02-template-rollback.md`](./p2-4-02-template-rollback.md) / [`p2-4-03-trigger-member.md`](./p2-4-03-trigger-member.md) / [`p2-4-04-trigger-invite.md`](./p2-4-04-trigger-invite.md) / [`p2-4-05-trigger-tool.md`](./p2-4-05-trigger-tool.md)。

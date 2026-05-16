# P3.2：Member 到期 schedule + 数据清理 schedule + Stuck 增强 + alert 对接

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 把"被动响应业务"的通知系统升级为"主动巡检 + 系统告警双向"：
- 4 个定时 schedule（会员到期 7/3/1 天 / 数据清理 / 导出过期清理 / stuck 巡检）
- alert 系统对接（系统告警转 inApp 通知给超管）

**Architecture:**
- 复用 P2.2 BullMQ cron 能力，新增 `notif.schedule` 队列；启动时由 `taskScheduleBoot` 注册
- `member-expire-soon-{user_id}-{YYYYMMDD}-{Nd}` 幂等键避免重复发送
- 数据清理：`notification_messages` 保留 90 天 + `notification_send_logs` 保留 30 天
- alert 对接：在 `app/service/alert.ts` 触发 alert 时调 `notification.send` 给所有超管

**Tech Stack:** Egg.js + 复用 P2.2 BullMQ + cron-parser

**前置条件**：tag `p3-1-done`；P2.2 已实现 `notification.task` 队列与 boot 恢复机制。

**Reference:** 需求文档 V2 §11.2.8（alert）+ §6.6（schedule）+ §4.2.6（messages 保留策略）

---

## 范围

### ✅ 做

- DB 迁移 024：1 张 `notification_schedules` 表（schedule 元数据 + 上次触发记录）+ 错误码 108710-108715
- 4 个 schedule 注册：
  1. `member.expireSoon`：每天 09:00 扫描 7/3/1 天后到期的会员
  2. `cleanup.messages`：每天 03:00 删除 90 天前的 messages
  3. `cleanup.sendLogs`：每天 03:30 删除 30 天前的 send_logs
  4. `cleanup.exports`：每小时 :15 清理 7 天前过期的导出文件
- Stuck 增强：扫描 `notification_tasks` + `notification_export_jobs` 都 stuck 时标 failed
- alert 对接：`app/service/alert.ts` 内插入 notification.send（typeKey=`alert_critical`）
- 1 个新触发点 type：`alert_critical`（admin 系统告警）+ 1 个会员到期 type 模板补齐

### ❌ 不做（P3.3/P3.4）

- 多 SMTP（P3.3）
- i18n（P3.3）
- 短信真实接入（P3.4）

---

## 任务列表（7 Tasks）

| # | Task |
|---|------|
| 1 | 依赖 + config + 错误码 108710-108715 |
| 2 | DB 迁移 024（schedules 表 + 2 type seed + 模板） |
| 3 | notification-schedule service（注册/卸载/列表）+ 6 单测 |
| 4 | 4 个 schedule 处理器（member-expire / cleanup-messages / cleanup-sendLogs / cleanup-exports）+ 测试 |
| 5 | boot 集成：app didReady 注册 4 schedule + Stuck 扫描扩展到 export |
| 6 | alert 对接 + admin API（schedules 列表/暂停/恢复） |
| 7 | 端到端联调 + 验收 + tag p3-2-done |

---

## Task 1：依赖 + config + 错误码

`config/config.default.ts` 追加：

```typescript
config.notification = {
  ...config.notification,
  schedule: {
    enabled: true,
    queueName: 'notif.schedule',
    /** 4 个内置 schedule 的 cron + 是否启用，admin 可在 UI 关闭 */
    presets: {
      memberExpireSoon: { cron: '0 9 * * *',  enabled: true,
        days: [7, 3, 1],  // 提前 N 天提醒 */ },
      cleanupMessages:  { cron: '0 3 * * *',  enabled: true, retentionDays: 90 },
      cleanupSendLogs:  { cron: '30 3 * * *', enabled: true, retentionDays: 30 },
      cleanupExports:   { cron: '15 * * * *', enabled: true },
    },
  },
};
```

错误码 `errorCodes.ts` 追加：

```typescript
NOTIFY_SCHEDULE_NOT_FOUND:        { code: 108710, message: 'schedule 任务不存在' },
NOTIFY_SCHEDULE_ALREADY_EXISTS:   { code: 108711, message: 'schedule 已注册' },
NOTIFY_SCHEDULE_HANDLER_MISSING:  { code: 108712, message: 'schedule 处理器未实现' },
NOTIFY_SCHEDULE_PAUSED:           { code: 108713, message: 'schedule 已暂停' },
NOTIFY_MEMBER_EXPIRE_NO_TARGET:   { code: 108714, message: '到期会员扫描未命中' },
NOTIFY_CLEANUP_FAILED:            { code: 108715, message: '数据清理执行失败' },
```

短别名同步加。

```bash
git commit -m "feat(notification): p3.2 deps/config/errcodes (108710-108715)"
```

---

## Task 2：DB 迁移 024

`database/024_p3_schedules.sql`：

```sql
-- 1. schedule 元数据
CREATE TABLE IF NOT EXISTS `notification_schedules` (
  `id`              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `code`            VARCHAR(100) NOT NULL UNIQUE,
  `name`            VARCHAR(200) NOT NULL,
  `handler`         VARCHAR(100) NOT NULL COMMENT '处理器 key',
  `cron_expr`       VARCHAR(100) NOT NULL,
  `enabled`         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `params`          JSON NULL COMMENT '处理器参数（如 retentionDays）',
  `last_fire_at`    DATETIME NULL,
  `last_status`     ENUM('success','failed') NULL,
  `last_message`    TEXT NULL,
  `next_fire_at`    DATETIME NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. 4 个内置 schedule 预置
INSERT INTO `notification_schedules` (`code`,`name`,`handler`,`cron_expr`,`enabled`,`params`,`created_at`,`updated_at`) VALUES
  ('member_expire_soon', '会员到期提醒',  'memberExpireSoon', '0 9 * * *',  1, JSON_OBJECT('days', JSON_ARRAY(7,3,1)), NOW(), NOW()),
  ('cleanup_messages',   '消息表清理',    'cleanupMessages',  '0 3 * * *',  1, JSON_OBJECT('retentionDays', 90), NOW(), NOW()),
  ('cleanup_send_logs',  '发送日志清理',  'cleanupSendLogs',  '30 3 * * *', 1, JSON_OBJECT('retentionDays', 30), NOW(), NOW()),
  ('cleanup_exports',    '导出文件清理',  'cleanupExports',   '15 * * * *', 1, JSON_OBJECT(), NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 3. 2 个新通知类型 + 模板
INSERT INTO `notification_types`
  (`type_key`, `name`, `category`, `default_channels`, `priority`, `quiet_hour_policy`, `enabled`, `created_at`, `updated_at`) VALUES
  ('member_expire_soon', '会员即将到期', 'business', JSON_ARRAY('inApp','email'), 'high',   'respect', 1, NOW(), NOW()),
  ('alert_critical',     '系统严重告警', 'system',   JSON_ARRAY('inApp','email'), 'high',   'bypass',  1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`, `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '⏰ 您的会员将在 {{daysLeft}} 天后到期',
       '亲爱的 {{userName}}，您的 {{levelName}} 会员将于 {{expireAt}} 到期。立即续费享受连续优惠：{{renewUrl}}',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'member_expire_soon'
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO `notification_templates`
  (`type_id`, `lang`, `channel`, `title_tpl`, `body_tpl`, `version`, `is_active`, `created_at`, `updated_at`)
SELECT t.id, 'zh-CN', 'inApp',
       '🚨 系统告警：{{alertTitle}}',
       '严重程度：{{level}}\n详情：{{message}}\n时间：{{occurredAt}}\n查看：{{linkUrl}}',
       1, 1, NOW(), NOW()
FROM `notification_types` t WHERE t.type_key = 'alert_critical'
ON DUPLICATE KEY UPDATE updated_at = NOW();
```

回滚脚本对应 DROP TABLE + DELETE seeds。

Model `notification_schedule.ts`：略（标准 Sequelize define）。

```bash
git commit -m "feat(notification): db migration 024 (schedules table + 2 types + templates)"
```

---

## Task 3：notification-schedule service

文件 `app/service/notification-schedule.ts`：

```typescript
import { Service } from 'egg';
import { getScheduleQueue } from '../queue/queues'; // 在 queues.ts 加新导出
import { nextFireFromCron } from '../lib/cronHelper';
import { NOTIF_ERR } from '../constants/errorCodes';

const HANDLERS: Record<string, (ctx: any, params: any) => Promise<{ message: string }>> = {};

export function registerScheduleHandler(
  key: string, fn: (ctx: any, params: any) => Promise<{ message: string }>) {
  HANDLERS[key] = fn;
}

export default class NotificationScheduleService extends Service {

  /** 启动时由 boot 调用：把 enabled=1 的 schedule 注册到 BullMQ */
  async registerAll(): Promise<void> {
    const list = await this.ctx.model.NotificationSchedule.findAll({ where: { enabled: 1 } });
    const queue = getScheduleQueue(this.app);
    for (const s of list) {
      if (!HANDLERS[s.handler]) {
        this.ctx.logger.warn(`[notif.schedule] handler '${s.handler}' missing for ${s.code}`);
        continue;
      }
      await queue.add('schedule',
        { scheduleId: s.id, code: s.code },
        { repeat: { cron: s.cronExpr }, jobId: `sch-${s.code}` });
      const next = nextFireFromCron(s.cronExpr);
      await s.update({ nextFireAt: next });
      this.ctx.logger.info(`[notif.schedule] registered ${s.code} cron='${s.cronExpr}' next=${next.toISOString()}`);
    }
  }

  async executeSchedule(scheduleId: number) {
    const { ctx } = this;
    const s = await ctx.model.NotificationSchedule.findByPk(scheduleId);
    if (!s) ctx.throwBiz(NOTIF_ERR.SCHEDULE_NOT_FOUND);
    if (!s.enabled) ctx.throwBiz(NOTIF_ERR.SCHEDULE_PAUSED);
    const handler = HANDLERS[s.handler];
    if (!handler) ctx.throwBiz(NOTIF_ERR.SCHEDULE_HANDLER_MISSING);
    try {
      const r = await handler(ctx, s.params || {});
      await s.update({
        lastFireAt: new Date(),
        lastStatus: 'success',
        lastMessage: r.message,
        nextFireAt: nextFireFromCron(s.cronExpr),
      });
    } catch (e: any) {
      await s.update({
        lastFireAt: new Date(),
        lastStatus: 'failed',
        lastMessage: e.message,
        nextFireAt: nextFireFromCron(s.cronExpr),
      });
      throw e;
    }
  }

  async pause(id: number) {
    const s = await this.ctx.model.NotificationSchedule.findByPk(id);
    if (!s) this.ctx.throwBiz(NOTIF_ERR.SCHEDULE_NOT_FOUND);
    await s.update({ enabled: 0 });
    const q = getScheduleQueue(this.app);
    try { await q.removeRepeatable('schedule', { cron: s.cronExpr }); } catch (_) {}
    return s;
  }

  async resume(id: number) {
    const s = await this.ctx.model.NotificationSchedule.findByPk(id);
    if (!s) this.ctx.throwBiz(NOTIF_ERR.SCHEDULE_NOT_FOUND);
    await s.update({ enabled: 1 });
    const q = getScheduleQueue(this.app);
    await q.add('schedule',
      { scheduleId: s.id, code: s.code },
      { repeat: { cron: s.cronExpr }, jobId: `sch-${s.code}` });
    return s;
  }

  async list() {
    return this.ctx.model.NotificationSchedule.findAll({ order: [['code', 'ASC']] });
  }
}
```

测试：6 用例（registerAll / executeSchedule 成功 / handler 缺失 / pause / resume / list）。

```bash
git commit -m "feat(notification): add schedule service + handler registry + 6 tests"
```

---

## Task 4：4 个 schedule 处理器

新建 `app/schedule/notification/`：

```
app/schedule/notification/
├── memberExpireSoon.ts
├── cleanupMessages.ts
├── cleanupSendLogs.ts
├── cleanupExports.ts
└── index.ts            # 注册全部 handler 到 service registry
```

### 4.1 `memberExpireSoon.ts`

```typescript
import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('memberExpireSoon', async (ctx, params: { days: number[] }) => {
  const days: number[] = params.days || [7, 3, 1];
  let total = 0;
  for (const N of days) {
    const targetStart = new Date(Date.now() + N * 86400_000); targetStart.setHours(0,0,0,0);
    const targetEnd = new Date(targetStart); targetEnd.setHours(23,59,59,999);
    const subs = await ctx.model.MemberSubscription.findAll({
      where: { status: 1,
        expireAt: { [ctx.app.Sequelize.Op.between]: [targetStart, targetEnd] },
      },
      include: [{ model: ctx.model.User, as: 'user', attributes: ['id','nickname','mobile'] },
                { model: ctx.model.MemberLevel, as: 'level', attributes: ['name'] }],
    });
    for (const sub of subs) {
      const ymd = targetStart.toISOString().slice(0,10).replace(/-/g,'');
      // 幂等键检查（如已通知则跳过）
      const dup = await ctx.model.NotificationMessage.findOne({
        where: {
          userId: sub.userId,
          bizRefType: 'member_expire_soon',
          bizRefId: `${sub.userId}-${ymd}-${N}d`,
        },
      });
      if (dup) continue;
      try {
        await ctx.service.notification.send({
          typeKey: 'member_expire_soon',
          userId: sub.userId,
          params: {
            userName: sub.user?.nickname || sub.user?.mobile,
            levelName: sub.level?.name || `lv${sub.levelId}`,
            daysLeft: N,
            expireAt: sub.expireAt.toLocaleString('zh-CN'),
            renewUrl: `${ctx.app.config.notification.frontend.h5BaseUrl}/member/renew`,
          },
          bizRefType: 'member_expire_soon',
          bizRefId: `${sub.userId}-${ymd}-${N}d`,
        });
        total++;
      } catch (e: any) {
        ctx.logger.warn(`[sched.memberExpire] user=${sub.userId} N=${N} failed: ${e.message}`);
      }
    }
  }
  return { message: `notified ${total} members across ${days.length} windows` };
});
```

### 4.2 `cleanupMessages.ts`

```typescript
import { registerScheduleHandler } from '../../service/notification-schedule';
import { NOTIF_ERR } from '../../constants/errorCodes';

registerScheduleHandler('cleanupMessages', async (ctx, params: { retentionDays: number }) => {
  const cutoff = new Date(Date.now() - (params.retentionDays || 90) * 86400_000);
  try {
    const r = await ctx.model.query(
      'DELETE FROM notification_messages WHERE created_at < ? LIMIT 50000',
      { replacements: [cutoff] },
    );
    return { message: `deleted ${(r as any)[0]?.affectedRows ?? 0} rows older than ${cutoff.toISOString()}` };
  } catch (e: any) {
    ctx.throwBiz(NOTIF_ERR.CLEANUP_FAILED, e.message);
    throw e;
  }
});
```

### 4.3 `cleanupSendLogs.ts`

同上模式，`DELETE FROM notification_send_logs WHERE created_at < ?`，retentionDays=30。

### 4.4 `cleanupExports.ts`

```typescript
import * as fs from 'fs';
import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('cleanupExports', async (ctx) => {
  const expired = await ctx.model.NotificationExportJob.findAll({
    where: {
      status: 'completed',
      expiresAt: { [ctx.app.Sequelize.Op.lt]: new Date() },
    },
  });
  let cleaned = 0;
  for (const j of expired) {
    if (j.filePath && fs.existsSync(j.filePath)) {
      try { fs.unlinkSync(j.filePath); } catch (_) {}
    }
    await j.update({ status: 'expired', filePath: null });
    cleaned++;
  }
  return { message: `cleaned ${cleaned} expired export files` };
});
```

### 4.5 `index.ts` 集中 import 触发注册

```typescript
import './memberExpireSoon';
import './cleanupMessages';
import './cleanupSendLogs';
import './cleanupExports';
```

测试：每个 handler 一个用例，共 4 个；mock DB query / send。

```bash
git commit -m "feat(notification): 4 schedule handlers (member-expire/cleanup-msgs/sendLogs/exports)"
```

---

## Task 5：boot 集成 + Stuck 扩展

修改 `app/boot/taskScheduleBoot.ts`（P2.2 已建），在 `start()` 末尾调：

```typescript
// 注册 schedule
await import('../schedule/notification');  // 触发 handler 注册
const ctx = this.app.createAnonymousContext();
await ctx.service.notificationSchedule.registerAll();
```

扩展 stuck 扫描覆盖 `notification_export_jobs`：在 `_initialStuckScan / _scheduleStuckScan` 中加 export 表的同样逻辑（status=running > 30min → status=failed）。

测试：3 用例（boot 启动注册 4 schedule / export 也被 stuck 扫描覆盖 / paused schedule 不注册）。

```bash
git commit -m "feat(notification): boot integrates 4 schedules + stuck scan covers exports"
```

---

## Task 6：alert 对接 + admin API

### 6.1 修改 `app/service/alert.ts`

在原有 alert 触发逻辑之后追加：

```typescript
// === P3.2 触发点：系统告警通知超管 ===
try {
  // 取所有超管 user.id（admin role=superadmin 的 user_id）
  const superadmins = await this.ctx.model.query(`
    SELECT DISTINCT u.id FROM users u
    JOIN admin_users au ON au.user_id = u.id
    JOIN admin_user_roles aur ON aur.admin_user_id = au.id
    JOIN admin_roles ar ON ar.id = aur.role_id
    WHERE ar.code = 'superadmin' AND u.status = 1
  `, { type: this.app.Sequelize.QueryTypes.SELECT }) as any[];
  const userIds = superadmins.map((r: any) => r.id);
  if (userIds.length > 0) {
    await this.ctx.service.notification.sendByAudience({
      typeKey: 'alert_critical',
      audienceType: 'static',
      audienceRule: { userIds },
      params: {
        alertTitle: alert.title,
        level: alert.level,
        message: alert.message,
        occurredAt: alert.occurredAt.toLocaleString('zh-CN'),
        linkUrl: `${this.ctx.app.config.notification.frontend.h5BaseUrl}/dashboard/alerts/${alert.id}`,
      },
      bizRefType: 'alert',
      bizRefId: String(alert.id),
    });
  }
} catch (e: any) {
  this.ctx.logger.warn(`[alert.notify] failed: ${e.message}`);
}
```

### 6.2 admin API：`/api/admin/notification/schedules`

```typescript
router.get('/api/admin/notification/schedules',
  adminAuth, adminPerm('notification:config:view'), controller.admin.notificationSchedule.list);
router.post('/api/admin/notification/schedules/:id/pause',
  adminAuth, adminPerm('notification:config:edit'), controller.admin.notificationSchedule.pause);
router.post('/api/admin/notification/schedules/:id/resume',
  adminAuth, adminPerm('notification:config:edit'), controller.admin.notificationSchedule.resume);
```

controller 转 service。

### 6.3 admin UI（小页面）

`src/pages/Notification/Configs/Schedules/index.tsx`：表格列出 4 schedule + lastFireAt + nextFireAt + lastStatus + 操作（暂停/恢复）。

```bash
git commit -m "feat(notification): alert system → notification.sendByAudience for superadmins + schedules admin api/page"
```

---

## Task 7：端到端联调 + 验收 + tag

### 验收 e2e

| # | 场景 | 预期 |
|---|------|------|
| 1 | 会员 7 天后到期 | 09:00 自动收到通知；幂等键防重复 |
| 2 | 同一用户同一天再触发 | 命中幂等键跳过 |
| 3 | cleanup_messages 删除 90+ 天数据 | DB 行数减少；保留 ≤ 90 天的不动 |
| 4 | cleanup_exports 文件清理 | 文件不存在；status=expired |
| 5 | schedule 暂停 → 不再触发 | nextFireAt 不再更新 |
| 6 | 重启后 schedule 自动注册 | boot 日志可见 |
| 7 | alert 触发 → 所有超管收到通知 | params 含 link_url |
| 8 | export job stuck 30+ min | 自动标 failed |
| 9 | handler 抛错 → schedule 表记录 lastStatus=failed |
| 10 | 数据清理 SQL 走索引（EXPLAIN 验证） | created_at 索引命中 |

### Commit + tag

```bash
git tag p3-2-done
```

---

## 完成检查

- [ ] 7 Tasks 全 commit + tag
- [ ] 4 schedule 在 prod 运行 24 小时无异常
- [ ] self-review 已写
- [ ] 进入 [P3.3 多 SMTP + i18n](./2026-07-04-notification-p3-3-multi-smtp-i18n.md)

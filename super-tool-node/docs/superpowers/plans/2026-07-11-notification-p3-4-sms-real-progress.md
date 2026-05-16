# P3.4：短信真实接入 + 大任务进度推送 + 队列监控页

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:**
1. **短信真实**：替换 P1 SmsAdapter mock 为腾讯云 SMS（项目已用），把 verify-code 路径与通知路径都接入
2. **大任务进度**：sendByAudience 处理 ≥1000 用户时通过 socket 推送进度（每 100 条进度更新一次）
3. **队列监控页**：admin 端展示 send/task/export/schedule 4 个队列的实时深度与健康度

**Architecture:**
- 短信：复用项目 `app/service/sms.ts` 已有的腾讯云 SMS 调用；SmsAdapter 改为调 sms.send；保留 P1 fallback 到日志的开关
- 进度：在 `notification.sendByAudience` 内部分批 + socket emit `task:progress` 给 admin room
- 队列监控：直接调 BullMQ Queue.getJobCounts() 返回 active/waiting/delayed/failed/completed 数

**Tech Stack:** 腾讯云 SMS SDK（项目已用） + 复用 P1 socket.io + BullMQ 内置监控 API

**前置条件**：tag `p3-3-done`；项目已有腾讯云 SMS 账号配置。

**Reference:** 需求文档 V2 §6.5（短信渠道）+ §6.4（Socket 实时推送）+ §14.2.3 队列监控

---

## 范围

### ✅ 做

- DB 迁移 026：channel_config 增加 sms 默认配置 + 错误码 108730-108735
- SmsAdapter 真实化（调 sms.send，写 send_log 含 providerResp）
- sendByAudience 大任务进度推送（≥1000 用户分批 + socket emit）
- admin /notification/queues 队列监控页（BullMQ getJobCounts）
- 队列监控自动刷新 5 秒
- 错误码 108730-108735

### ❌ 不做

- App Push（V2 不做，预留）
- 多短信服务商切换（仅 1 个；P4 如需）
- 进度推送到 C 端（仅 admin room）

---

## 任务列表（7 Tasks）

| # | Task |
|---|------|
| 1 | 依赖 / config / 错误码 108730-108735 |
| 2 | DB 迁移 026（channel sms 默认配置）+ Model |
| 3 | SmsAdapter 真实化（调 sms.send）+ 4 单测 |
| 4 | sendByAudience 进度推送（>=1000 分批）+ 4 单测 |
| 5 | 队列监控 service + admin API（4 队列深度） |
| 6 | admin UI - QueueDepthWidget 真实化 + /notification/queues 页面 |
| 7 | 端到端联调 + 验收 + tag p3-4-done + tag p3-done |

---

## Task 1：依赖 / config / 错误码

`config/config.default.ts` 追加：

```typescript
config.notification = {
  ...config.notification,
  sms: {
    enabled: true,
    fallbackToLog: false, // 生产 false；本地开发或 SMS 配置缺失时设 true
  },
  progress: {
    enabled: true,
    batchSize: 100,        // 每 N 条 emit 一次进度
    minTotalForEmit: 1000, // 受众 < 1000 不推送进度
  },
  queueMonitor: {
    refreshIntervalMs: 5000,
  },
};
```

错误码 errorCodes.ts：

```typescript
NOTIFY_SMS_PROVIDER_DOWN:    { code: 108730, message: '短信服务商不可用' },
NOTIFY_SMS_INVALID_MOBILE:   { code: 108731, message: '手机号格式非法' },
NOTIFY_SMS_QUOTA_EXHAUSTED:  { code: 108732, message: '短信余额不足' },
NOTIFY_PROGRESS_TASK_NOT_FOUND: { code: 108733, message: '进度推送任务不存在' },
NOTIFY_QUEUE_NOT_FOUND:      { code: 108734, message: '队列不存在' },
NOTIFY_QUEUE_REDIS_DOWN:     { code: 108735, message: 'Redis 连接异常' },
```

```bash
git commit -m "feat(notification): p3.4 deps/config/errcodes (108730-108735)"
```

---

## Task 2：DB 迁移 026

`database/026_p3_sms_real.sql`：

```sql
-- 1. SMS 默认配置（如尚无）
INSERT IGNORE INTO `notification_channel_config`
  (`channel`,`provider`,`enabled`,`config`,`is_default`,`priority`,`description`,`created_at`,`updated_at`)
VALUES
  ('sms','tencent',1,JSON_OBJECT(
    'sdk_app_id', 'CHANGE_IN_PROD',
    'secret_id',  'CHANGE_IN_PROD',
    'secret_key', 'CHANGE_IN_PROD',
    'sign',       'super-tools',
    'template_default', '12345' /* 通用通知 SMS 模板 ID（项目侧配置） */
  ),1,10,'腾讯云 SMS 默认',NOW(),NOW());
```

回滚 DELETE。

```bash
git commit -m "feat(notification): db migration 026 (sms tencent default config)"
```

---

## Task 3：SmsAdapter 真实化

修改 `app/adapter/sms.adapter.ts`：

```typescript
import { Context } from 'egg';
import { NOTIF_ERR } from '../constants/errorCodes';

export default class SmsAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; providerResp?: any }> {
    const user = await this.ctx.model.User.findByPk(message.userId);
    if (!user?.mobile) {
      await message.update({ status: 'failed', failReason: 'user has no mobile' });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id, channel: 'sms', status: 'failed',
        errorMessage: 'no_mobile',
      });
      return { ok: false };
    }

    const cfg = this.ctx.app.config.notification.sms;
    if (cfg.fallbackToLog) {
      this.ctx.logger.info(`[sms-fallback] mobile=${user.mobile} body=${message.body}`);
      await message.update({ status: 'sent', sentAt: new Date() });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id, channel: 'sms', status: 'success',
        providerResp: { fallback: true },
      });
      return { ok: true, providerResp: { fallback: true } };
    }

    try {
      // 复用项目已有 sms 服务（腾讯云）
      const r = await this.ctx.service.sms.sendNotification({
        mobile: user.mobile,
        body: message.body,
        // 项目侧 sms.sendNotification 内部读 channel_config 中的 sign / template
      });
      await message.update({ status: 'sent', sentAt: new Date() });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id, channel: 'sms', status: 'success',
        providerResp: r,
      });
      return { ok: true, providerResp: r };
    } catch (e: any) {
      const code = this._mapError(e);
      this.ctx.throwBiz(code, e.message);
      return { ok: false };
    }
  }

  private _mapError(e: any): number {
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('余额')) return NOTIF_ERR.SMS_QUOTA_EXHAUSTED.code;
    if (msg.includes('invalid') && msg.includes('mobile')) return NOTIF_ERR.SMS_INVALID_MOBILE.code;
    return NOTIF_ERR.SMS_PROVIDER_DOWN.code;
  }
}
```

测试 4 用例：
1. 用户有手机 → 调 sms.sendNotification → status=sent
2. 用户无手机 → status=failed，不抛
3. SMS 服务商抛"余额不足" → 抛 108732
4. fallbackToLog=true → 仅打日志且 status=sent

```bash
git commit -m "feat(notification): SmsAdapter real implementation (tencent SMS) + 4 tests"
```

---

## Task 4：sendByAudience 进度推送

修改 `app/service/notification.ts` 的 `sendByAudience`：

```typescript
async sendByAudience(input: SendByAudienceInput) {
  const { ctx, app } = this;
  const userIds = await ctx.service.notificationAudience.resolve({
    audienceType: input.audienceType,
    audienceRule: input.audienceRule,
  });
  const total = userIds.length;
  const cfg = app.config.notification.progress;
  const shouldEmit = cfg.enabled && total >= cfg.minTotalForEmit && input.taskId;

  let totalMessages = 0;
  let processed = 0;

  if (shouldEmit) this._emitProgress(input.taskId!, { processed: 0, total, status: 'running' });

  for (const uid of userIds) {
    try {
      const r = await this.send({
        typeKey: input.typeKey, userId: uid, params: input.params,
        channels: input.channels, taskId: input.taskId ?? null, lang: input.lang,
      });
      totalMessages += r.messages.length;
    } catch (e: any) {
      ctx.logger.warn(`[notif.sendByAudience] user=${uid} failed: ${e.message}`);
    }
    processed++;
    if (shouldEmit && processed % cfg.batchSize === 0) {
      this._emitProgress(input.taskId!, { processed, total, status: 'running' });
    }
  }

  if (shouldEmit) {
    this._emitProgress(input.taskId!, { processed, total, status: 'completed', totalMessages });
  }

  return { totalUsers: total, totalMessages };
}

private _emitProgress(taskId: number, payload: any) {
  const io: any = (this.app as any).io;
  if (!io) return;
  io.of('/').to('admin:dashboard').emit('task:progress', { taskId, ...payload });
}
```

测试 4 用例：
1. <1000 用户不推送进度
2. 1000 用户推送 10 次（每 100）+ 1 次 completed
3. 失败用户计入但不影响 totalMessages 累加
4. 无 io 实例时不抛错

```bash
git commit -m "feat(notification): sendByAudience progress emit (>=1000 users) + 4 tests"
```

---

## Task 5：队列监控 service + admin API

新增 `app/service/notification-queue-monitor.ts`：

```typescript
import { Service } from 'egg';
import { getSendQueue, getTaskQueue, getExportQueue, getScheduleQueue } from '../queue/queues';
import { NOTIF_ERR } from '../constants/errorCodes';

const QUEUE_GETTERS = {
  send:     getSendQueue,
  task:     getTaskQueue,
  export:   getExportQueue,
  schedule: getScheduleQueue,
};

export default class NotificationQueueMonitorService extends Service {

  async overview() {
    const out: any = {};
    for (const [key, getter] of Object.entries(QUEUE_GETTERS)) {
      try {
        const q = (getter as any)(this.app);
        const counts = await q.getJobCounts(
          'active', 'waiting', 'delayed', 'failed', 'completed',
        );
        out[key] = { ok: true, ...counts };
      } catch (e: any) {
        out[key] = { ok: false, error: e.message };
      }
    }
    return out;
  }

  async detail(queueKey: string) {
    const getter = (QUEUE_GETTERS as any)[queueKey];
    if (!getter) this.ctx.throwBiz(NOTIF_ERR.QUEUE_NOT_FOUND);
    const q = getter(this.app);
    const jobs = await q.getJobs(['active', 'waiting', 'delayed', 'failed'], 0, 50);
    return jobs.map((j: any) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
      failedReason: j.failedReason,
    }));
  }

  async retryFailed(queueKey: string) {
    const getter = (QUEUE_GETTERS as any)[queueKey];
    if (!getter) this.ctx.throwBiz(NOTIF_ERR.QUEUE_NOT_FOUND);
    const q = getter(this.app);
    const jobs = await q.getJobs(['failed'], 0, 100);
    let retried = 0;
    for (const j of jobs) {
      try { await j.retry(); retried++; } catch (_) {}
    }
    return { retried };
  }
}
```

admin API：

```typescript
router.get('/api/admin/notification/queues',         adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationQueueMonitor.overview);
router.get('/api/admin/notification/queues/:key',    adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationQueueMonitor.detail);
router.post('/api/admin/notification/queues/:key/retry-failed',
                                                     adminAuth, adminPerm('notification:config:edit'), controller.admin.notificationQueueMonitor.retryFailed);
```

测试 3 用例。

```bash
git commit -m "feat(notification): queue monitor service + 3 admin endpoints"
```

---

## Task 6：admin UI

### 6.1 替换 P3.1 mock 的 QueueDepthWidget

```tsx
// src/pages/Dashboard/widgets/QueueDepthWidget.tsx
import React, { useEffect, useState } from 'react';
import { Card, Statistic, Space } from 'antd';
import { request } from 'umi';

export default function QueueDepthWidget() {
  const [data, setData] = useState<any>({});
  useEffect(() => {
    const tick = async () => {
      try {
        const r: any = await request('/api/admin/notification/queues');
        setData(r);
      } catch (_) {}
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card title="队列深度" size="small">
      <Space>
        {Object.entries(data).map(([k, v]: any) => (
          <Statistic key={k} title={k} value={v.ok ? (v.active + v.waiting + v.delayed) : '-'} />
        ))}
      </Space>
    </Card>
  );
}
```

### 6.2 队列监控独立页面 `/notification/queues`

```tsx
// src/pages/Notification/Queues/index.tsx
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Tabs, Card, Statistic, Row, Col, Button, Space, message } from 'antd';
import { request } from 'umi';

export default function QueuesPage() {
  const [overview, setOverview] = useState<any>({});
  const [active, setActive] = useState('send');

  const reload = async () => {
    const r: any = await request('/api/admin/notification/queues');
    setOverview(r);
  };
  useEffect(() => { reload(); const t = setInterval(reload, 5000); return () => clearInterval(t); }, []);

  return (
    <PageContainer header={{ title: '队列监控' }}>
      <Row gutter={16}>
        {Object.entries(overview).map(([k, v]: any) => (
          <Col span={6} key={k}>
            <Card>
              <Statistic title={`${k} 队列`} value={v.ok ? `${v.active}/${v.waiting}/${v.delayed}/${v.failed}` : 'DOWN'} />
              <Space style={{ marginTop: 12 }}>
                <Button size="small" onClick={async () => {
                  const r: any = await request(`/api/admin/notification/queues/${k}/retry-failed`, { method: 'POST' });
                  message.success(`重试 ${r.retried} 条`);
                }}>重试失败</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Tabs activeKey={active} onChange={setActive} items={[
        { key: 'send', label: 'send', children: <QueueDetail queueKey="send" /> },
        { key: 'task', label: 'task', children: <QueueDetail queueKey="task" /> },
        { key: 'export', label: 'export', children: <QueueDetail queueKey="export" /> },
        { key: 'schedule', label: 'schedule', children: <QueueDetail queueKey="schedule" /> },
      ]} />
    </PageContainer>
  );
}

function QueueDetail({ queueKey }: { queueKey: string }) {
  // 列表展示该队列前 50 个 jobs，列：id/name/state/attempts/failedReason
  // ... 实现略，用 ProTable 或 Table
  return <div>详情：{queueKey}</div>;
}
```

注册路由 + access。

```bash
git commit -m "feat(admin): queue monitor page + real QueueDepthWidget"
```

---

## Task 7：端到端联调 + 验收 + tag

### 验收 e2e

| # | 场景 | 预期 |
|---|------|------|
| 1 | 短信渠道发送 verify-code | 用户实际收到短信，send_log 含 providerResp.tencent |
| 2 | 短信余额不足 | 抛 108732；BullMQ 重试 |
| 3 | 1500 用户 sendByAudience | admin dashboard 收到 15 次 progress + 1 次 completed |
| 4 | <1000 用户不推送进度 | 无 progress 事件 |
| 5 | 队列监控页 4 队列实时刷新 | 5 秒一次 |
| 6 | 失败重试按钮 | 失败 job 进入 waiting；attemptsMade 加 1 |
| 7 | Redis 断开后队列监控 | 显示 DOWN，不影响其他页面 |
| 8 | fallbackToLog=true 模式 | 短信不真发；仅打日志 |

### Commit + 双 tag

```bash
git tag p3-4-done

# === P3 阶段全部完成 ===
git tag p3-done
```

---

## 完成检查（整个 P3.4 + P3）

- [ ] 7 Tasks 全 commit + 双 tag
- [ ] 短信真实接入 24 小时无异常
- [ ] 队列监控页能实时反映 BullMQ 状态
- [ ] self-review 已写
- [ ] 整个通知模块 V2 计划完结

---

## P3 全阶段回顾

| 子计划 | 范围 | tag |
|--------|------|-----|
| P3.1 | Stats + Widget + 导出 | p3-1-done |
| P3.2 | Schedule + alert | p3-2-done |
| P3.3 | 多 SMTP + i18n | p3-3-done |
| **P3.4** | **SMS 真实 + 进度推送 + 队列监控** | **p3-4-done + p3-done** |

整个通知模块（V2）计划完结：

| 阶段 | tag |
|------|-----|
| P1 | p1-notification-done |
| P2 | p2-1-done / p2-2-done / p2-3-done / p2-4-done / **p2-done** |
| P3 | p3-1-done / p3-2-done / p3-3-done / p3-4-done / **p3-done** |

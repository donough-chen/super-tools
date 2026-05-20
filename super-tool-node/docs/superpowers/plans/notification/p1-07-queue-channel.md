# P1-07：BullMQ 队列骨架 + 渠道适配器

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T9 / T10**
> 前置：T1（依赖+config）、T5（models）

---

## Task 9：BullMQ 队列骨架 + send worker

**目标**：搭建 `notif.send` 队列与对应 worker；worker 仅做"读取 message → 调用渠道适配器"，发送逻辑由 T10 提供。

### 9.1 队列定义：`app/queue/queues.ts`

```typescript
import { Queue, QueueEvents } from 'bullmq';
import { Application } from 'egg';

let sendQueue: Queue | null = null;
let sendQueueEvents: QueueEvents | null = null;

export function getSendQueue(app: Application): Queue {
  if (!sendQueue) {
    const cfg = app.config.notification.queue;
    sendQueue = new Queue('notif.send', {
      connection: cfg.connection,
      defaultJobOptions: cfg.defaultJobOptions,
    });
  }
  return sendQueue;
}

export function getSendQueueEvents(app: Application): QueueEvents {
  if (!sendQueueEvents) {
    const cfg = app.config.notification.queue;
    sendQueueEvents = new QueueEvents('notif.send', { connection: cfg.connection });
  }
  return sendQueueEvents;
}

export async function closeQueues() {
  await sendQueue?.close();
  await sendQueueEvents?.close();
  sendQueue = null;
  sendQueueEvents = null;
}
```

### 9.2 Worker：`app/queue/workers/send.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { Application } from 'egg';

export interface SendJobData {
  messageId: number;
  channel: 'inApp' | 'email' | 'sms';
}

export function startSendWorker(app: Application): Worker {
  const cfg = app.config.notification.queue;
  const worker = new Worker<SendJobData>(
    'notif.send',
    async (job: Job<SendJobData>) => {
      const ctx = app.createAnonymousContext();
      ctx.logger.info(`[notif.send] worker job=${job.id} message=${job.data.messageId}`);
      const message = await ctx.model.NotificationMessage.findByPk(job.data.messageId);
      if (!message) {
        ctx.logger.warn(`[notif.send] message ${job.data.messageId} not found, skip`);
        return { skipped: true };
      }
      const result = await ctx.service.notificationChannel.dispatch({
        channel: job.data.channel,
        message,
      });
      return result;
    },
    {
      connection: cfg.connection,
      concurrency: cfg.concurrency ?? 4,
    },
  );

  worker.on('failed', (job, err) => {
    app.logger.error(`[notif.send] worker job=${job?.id} failed: ${err.message}`, err);
  });
  worker.on('completed', (job) => {
    app.logger.info(`[notif.send] worker job=${job.id} completed`);
  });
  return worker;
}
```

### 9.3 启动入口：`app/queue/index.ts`

```typescript
import { Application } from 'egg';
import { startSendWorker } from './workers/send.worker';
import { closeQueues } from './queues';

export class QueueLifecycle {
  private worker: any = null;

  constructor(private app: Application) {}

  async start() {
    if (this.app.config.notification.queue.enabled === false) {
      this.app.logger.warn('[notif] queue disabled by config');
      return;
    }
    this.worker = startSendWorker(this.app);
    this.app.logger.info('[notif] queue lifecycle started');
  }

  async stop() {
    await this.worker?.close();
    await closeQueues();
    this.app.logger.info('[notif] queue lifecycle stopped');
  }
}
```

### 9.4 接入 Egg 生命周期：`app.ts`（项目根）

```typescript
// 已有 app.ts 在末尾追加（若无则新建）
import { Application } from 'egg';
import { QueueLifecycle } from './app/queue';

export default class AppBootHook {
  private lifecycle: QueueLifecycle;
  constructor(private app: Application) {
    this.lifecycle = new QueueLifecycle(app);
  }
  async didReady() {
    if (this.app.config.env !== 'unittest') {
      await this.lifecycle.start();
    }
  }
  async beforeClose() {
    await this.lifecycle.stop();
  }
}
```

> 若项目已有 `app.ts`，请将 `QueueLifecycle` 调用合并进去，不要覆盖。

### 9.5 测试：`test/notification/queue/send-worker.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';
import { getSendQueue } from '../../../app/queue/queues';
import { startSendWorker } from '../../../app/queue/workers/send.worker';

describe('queue/send.worker', () => {
  it('worker 处理 job 时调用 notificationChannel.dispatch', async () => {
    const ctx = app.mockContext();
    const message = await ctx.model.NotificationMessage.create({
      userId: 1, typeId: 1, channel: 'inApp',
      title: 'q test', body: 'q body', priority: 'normal',
      status: 'pending',
    });

    let called = false;
    mock(app.serviceClasses.notificationChannel.prototype, 'dispatch', async (args: any) => {
      assert.equal(args.message.id, message.id);
      called = true;
      return { ok: true };
    });

    const worker = startSendWorker(app);
    const queue = getSendQueue(app);
    const job = await queue.add('send', { messageId: message.id, channel: 'inApp' });
    await job.waitUntilFinished(require('bullmq').QueueEvents
      ? new (require('bullmq').QueueEvents)('notif.send', { connection: app.config.notification.queue.connection })
      : null as any);
    assert.equal(called, true);
    await worker.close();
  });
});
```

> **注意**：单测环境通过 `config.unittest.ts` 让 `notification.queue.connection` 指向 `redis-mock` 或临时 db；如果项目无独立 redis，请在 unittest config 中关闭 worker，仅做 service 层 mock 测试。

### 9.6 验证 & Commit

- [ ] `npm run dev` 启动后日志出现 `[notif] queue lifecycle started`
- [ ] commit: `feat(notification): add bullmq send queue + worker skeleton`

---

## Task 10：渠道适配器（InApp 完整 / Email & Sms stub）

**目标**：

- `InAppAdapter`：写库 status=delivered + 通过 `notificationEmitter` 推送 Socket 事件
- `EmailAdapter` / `SmsAdapter`：仅打 info 日志，并把 message 标记 sent（P1 不接真渠道）
- 统一入口 `service/notification-channel.ts` 按 channel 分发

### 10.1 InApp adapter：`app/adapter/in-app.adapter.ts`

```typescript
import { Context } from 'egg';
import { emitToUser } from '../lib/notificationEmitter';

export default class InAppAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; deliveredAt: Date }> {
    const now = new Date();
    await message.update({ status: 'delivered', deliveredAt: now });
    emitToUser(this.ctx.app, message.userId, 'notification:new', {
      id: message.id,
      typeId: message.typeId,
      title: message.title,
      body: message.body,
      priority: message.priority,
      createdAt: message.createdAt,
    });
    // 更新未读计数 → 推送
    const unread = await this.ctx.model.NotificationMessage.count({
      where: { userId: message.userId, isRead: 0, archivedAt: null },
    });
    emitToUser(this.ctx.app, message.userId, 'notification:unread_count', { count: unread });
    return { ok: true, deliveredAt: now };
  }
}
```

### 10.2 Email stub：`app/adapter/email.adapter.ts`

```typescript
import { Context } from 'egg';

export default class EmailAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean }> {
    this.ctx.logger.info(`[email-stub] would send to userId=${message.userId} title=${message.title}`);
    await message.update({ status: 'sent', sentAt: new Date() });
    await this.ctx.model.NotificationSendLog.create({
      messageId: message.id,
      channel: 'email',
      status: 'success',
      providerResp: { stub: true },
    });
    return { ok: true };
  }
}
```

### 10.3 Sms stub：`app/adapter/sms.adapter.ts`

```typescript
import { Context } from 'egg';

export default class SmsAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean }> {
    // 复用现有 sms.ts mock；P2 改为通过队列调用真渠道
    this.ctx.logger.info(`[sms-stub] would send to userId=${message.userId} body=${message.body}`);
    await message.update({ status: 'sent', sentAt: new Date() });
    await this.ctx.model.NotificationSendLog.create({
      messageId: message.id,
      channel: 'sms',
      status: 'success',
      providerResp: { stub: true },
    });
    return { ok: true };
  }
}
```

### 10.4 emitter：`app/lib/notificationEmitter.ts`

```typescript
import { Application } from 'egg';

export function emitToUser(app: Application, userId: number, event: string, payload: any) {
  // egg-socket.io 通过 app.io 暴露
  const io: any = (app as any).io;
  if (!io) return;
  io.of('/').to(`user:${userId}`).emit(event, payload);
}
```

### 10.5 dispatch service：`app/service/notification-channel.ts`

```typescript
import { Service } from 'egg';
import InAppAdapter from '../adapter/in-app.adapter';
import EmailAdapter from '../adapter/email.adapter';
import SmsAdapter from '../adapter/sms.adapter';
import { NOTIF_ERR } from '../constants/errorCodes';

export default class NotificationChannelService extends Service {

  async dispatch(input: { channel: 'inApp' | 'email' | 'sms'; message: any }) {
    const { ctx } = this;
    let adapter: any;
    switch (input.channel) {
      case 'inApp':
        adapter = new InAppAdapter(ctx);
        break;
      case 'email':
        adapter = new EmailAdapter(ctx);
        break;
      case 'sms':
        adapter = new SmsAdapter(ctx);
        break;
      default:
        ctx.throwBiz(NOTIF_ERR.CHANNEL_INVALID);
    }
    try {
      return await adapter.send(input.message);
    } catch (e: any) {
      await input.message.update({ status: 'failed', failReason: e.message });
      await ctx.model.NotificationSendLog.create({
        messageId: input.message.id,
        channel: input.channel,
        status: 'failed',
        errorMessage: e.message,
      });
      throw e;
    }
  }
}
```

### 10.6 测试：`test/notification/service/notification-channel.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification-channel', () => {
  let ctx: any, message: any;
  beforeEach(async () => {
    ctx = app.mockContext();
    message = await ctx.model.NotificationMessage.create({
      userId: 1, typeId: 1, channel: 'inApp',
      title: 't', body: 'b', priority: 'normal', status: 'pending',
    });
  });

  it('inApp 走 InAppAdapter，msg.status -> delivered', async () => {
    let emitted = false;
    mock(require('../../../app/lib/notificationEmitter'), 'emitToUser', () => { emitted = true; });
    const r = await ctx.service.notificationChannel.dispatch({ channel: 'inApp', message });
    assert.equal(r.ok, true);
    assert.equal(emitted, true);
    await message.reload();
    assert.equal(message.status, 'delivered');
  });

  it('email 走 stub，msg.status -> sent，写 send_log', async () => {
    const r = await ctx.service.notificationChannel.dispatch({ channel: 'email', message });
    assert.equal(r.ok, true);
    await message.reload();
    assert.equal(message.status, 'sent');
    const log = await ctx.model.NotificationSendLog.findOne({ where: { messageId: message.id } });
    assert.equal(log.status, 'success');
  });

  it('adapter 抛错时写 failed log 并重新抛出', async () => {
    mock(require('../../../app/adapter/in-app.adapter').default.prototype, 'send', async () => {
      throw new Error('boom');
    });
    await assert.rejects(
      ctx.service.notificationChannel.dispatch({ channel: 'inApp', message }),
      /boom/,
    );
    await message.reload();
    assert.equal(message.status, 'failed');
    const log = await ctx.model.NotificationSendLog.findOne({ where: { messageId: message.id, status: 'failed' } });
    assert.ok(log);
  });
});
```

### 10.7 验证 & Commit

- [ ] 单测全绿（3 用例）
- [ ] commit: `feat(notification): add channel adapters (inApp full, email/sms stub) + dispatcher`

---

## 完成检查

- [ ] `app/queue/` 三个文件存在
- [ ] `app/adapter/` 三个 adapter 存在
- [ ] `app/lib/notificationEmitter.ts` 存在
- [ ] `app/service/notification-channel.ts` 存在
- [ ] 队列在 `dev` 环境启动可见日志，`unittest` 可关闭

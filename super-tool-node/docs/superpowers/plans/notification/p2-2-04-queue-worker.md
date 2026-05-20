# P2.2-04：notif.task 队列 + worker（Task 4）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 2（migration）

---

## Step 1: 修改 `app/queue/queues.ts`，导出 task 队列

在 P1 已有的 send queue getter 基础上追加：

```typescript
import { Queue, QueueEvents } from 'bullmq';
import { Application } from 'egg';

let taskQueue: Queue | null = null;
let taskQueueEvents: QueueEvents | null = null;

export function getTaskQueue(app: Application): Queue {
  if (!taskQueue) {
    const queueCfg = app.config.notification.queue;
    const taskCfg = app.config.notification.task;
    taskQueue = new Queue(taskCfg.queueName, {
      connection: queueCfg.connection,
      defaultJobOptions: {
        ...queueCfg.defaultJobOptions,
        // task 触发的 job 失败重试 1 次（避免重复发送）
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 500,
      },
    });
  }
  return taskQueue;
}

export function getTaskQueueEvents(app: Application): QueueEvents {
  if (!taskQueueEvents) {
    const queueCfg = app.config.notification.queue;
    const taskCfg = app.config.notification.task;
    taskQueueEvents = new QueueEvents(taskCfg.queueName, { connection: queueCfg.connection });
  }
  return taskQueueEvents;
}

/** 在原 closeQueues 中加入 task 队列关闭 */
export async function closeQueues() {
  // P1 send queue close 保留
  await taskQueue?.close();
  await taskQueueEvents?.close();
  taskQueue = null;
  taskQueueEvents = null;
  // ... 原有 send 队列关闭代码
}
```

> 修改 `closeQueues()` 时需保留 P1 已有的 sendQueue 关闭逻辑。

---

## Step 2: 创建 `app/queue/workers/task.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { Application } from 'egg';

export interface TaskJobData {
  taskId: number;
  /** 触发原因：scheduled / cron / rrule / immediate-confirmed（30s 撤销窗口结束后） */
  trigger: 'immediate-confirmed' | 'scheduled' | 'cron' | 'rrule';
  /** cron/rrule 触发时间，便于 worker 写 lastFireAt */
  fireAt?: number;
}

export function startTaskWorker(app: Application): Worker {
  const queueCfg = app.config.notification.queue;
  const taskCfg = app.config.notification.task;
  const worker = new Worker<TaskJobData>(
    taskCfg.queueName,
    async (job: Job<TaskJobData>) => {
      const ctx = app.createAnonymousContext();
      ctx.logger.info(
        `[notif.task] worker job=${job.id} task=${job.data.taskId} trigger=${job.data.trigger}`,
      );
      const task = await ctx.model.NotificationTask.findByPk(job.data.taskId);
      if (!task) {
        ctx.logger.warn(`[notif.task] task ${job.data.taskId} not found, skip`);
        return { skipped: true };
      }
      // canceled / paused 检查（避免 delayed job 在用户取消后仍执行）
      if (task.status === 'canceled' || task.status === 'paused') {
        ctx.logger.info(`[notif.task] task ${task.id} status=${task.status}, skip`);
        return { skipped: true };
      }

      // 执行触发：调度服务封装"取 type → sendByAudience → 写状态 → 计算 next"
      const result = await ctx.service.notificationTaskScheduler.executeTrigger({
        task,
        trigger: job.data.trigger,
        fireAt: job.data.fireAt ? new Date(job.data.fireAt) : new Date(),
      });
      return result;
    },
    {
      connection: queueCfg.connection,
      concurrency: taskCfg.concurrency ?? 4,
    },
  );

  worker.on('failed', (job, err) => {
    app.logger.error(`[notif.task] worker job=${job?.id} failed: ${err.message}`, err);
  });
  worker.on('completed', (job) => {
    app.logger.info(`[notif.task] worker job=${job.id} completed`);
  });
  return worker;
}
```

---

## Step 3: 修改 `app/queue/index.ts`，启动 task worker

```typescript
import { Application } from 'egg';
import { startSendWorker } from './workers/send.worker';
import { startTaskWorker } from './workers/task.worker';
import { closeQueues } from './queues';

export class QueueLifecycle {
  private sendWorker: any = null;
  private taskWorker: any = null;

  constructor(private app: Application) {}

  async start() {
    if (this.app.config.notification.queue.enabled === false) {
      this.app.logger.warn('[notif] queue disabled by config');
      return;
    }
    this.sendWorker = startSendWorker(this.app);
    if (this.app.config.notification.task.enabled !== false) {
      this.taskWorker = startTaskWorker(this.app);
    }
    this.app.logger.info('[notif] queue lifecycle started (send + task)');
  }

  async stop() {
    await this.sendWorker?.close();
    await this.taskWorker?.close();
    await closeQueues();
    this.app.logger.info('[notif] queue lifecycle stopped');
  }
}
```

---

## Step 4: 测试 `test/notification/queue/task-worker.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';
import { getTaskQueue } from '../../../app/queue/queues';
import { startTaskWorker } from '../../../app/queue/workers/task.worker';

describe('queue/task.worker', () => {
  beforeEach(async () => {
    await (app as any).model.NotificationTask.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_WORKER_%' } }, force: true,
    });
  });

  it('worker 处理 job → 调用 scheduler.executeTrigger', async () => {
    const ctx = app.mockContext();
    const task = await ctx.model.NotificationTask.create({
      name: 'TEST_WORKER_1', typeId: 1, audienceType: 'static',
      audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
      sendType: 'scheduled', status: 'scheduled', scheduledAt: new Date(),
    });

    let captured: any = null;
    mock(app.serviceClasses.notificationTaskScheduler.prototype, 'executeTrigger',
      async (args: any) => {
        captured = args;
        return { ok: true, totalUsers: 1, totalMessages: 1 };
      });

    const worker = startTaskWorker(app);
    const queue = getTaskQueue(app);
    const job = await queue.add('task', { taskId: task.id, trigger: 'scheduled' });
    const QueueEvents = require('bullmq').QueueEvents;
    const ev = new QueueEvents(app.config.notification.task.queueName, {
      connection: app.config.notification.queue.connection,
    });
    await job.waitUntilFinished(ev);

    assert.ok(captured);
    assert.equal(captured.task.id, task.id);
    assert.equal(captured.trigger, 'scheduled');
    await worker.close();
    await ev.close();
  });

  it('canceled 任务 worker 跳过执行', async () => {
    const ctx = app.mockContext();
    const task = await ctx.model.NotificationTask.create({
      name: 'TEST_WORKER_2', typeId: 1, audienceType: 'static',
      audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
      sendType: 'scheduled', status: 'canceled', canceledAt: new Date(),
    });

    let called = false;
    mock(app.serviceClasses.notificationTaskScheduler.prototype, 'executeTrigger',
      async () => { called = true; return { ok: true }; });

    const worker = startTaskWorker(app);
    const queue = getTaskQueue(app);
    const job = await queue.add('task', { taskId: task.id, trigger: 'scheduled' });
    const QueueEvents = require('bullmq').QueueEvents;
    const ev = new QueueEvents(app.config.notification.task.queueName, {
      connection: app.config.notification.queue.connection,
    });
    await job.waitUntilFinished(ev);
    assert.equal(called, false);
    await worker.close();
    await ev.close();
  });
});
```

---

## Step 5: 验证

```bash
npm test -- --testPathPattern=task-worker
```

预期：2/2 PASS。

`npm run dev` 启动后日志含 `[notif] queue lifecycle started (send + task)`。

---

## Step 6: Commit

```bash
git add super-tool-node/app/queue/queues.ts super-tool-node/app/queue/workers/task.worker.ts super-tool-node/app/queue/index.ts super-tool-node/test/notification/queue/task-worker.test.ts
git commit -m "feat(notification): add notif.task queue + worker (delegates to scheduler.executeTrigger)

- New 'notif.task' queue: attempts=1 (no auto-retry, idempotency by jobId)
- Worker checks canceled/paused before execute
- QueueLifecycle starts both send + task workers; gated by notification.task.enabled
- 2 unit tests: dispatch + canceled-skip

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 4)"
```

---

## Verification Checklist

- [ ] `getTaskQueue / getTaskQueueEvents` 存在
- [ ] task worker 启动 + 取消任务跳过
- [ ] 2 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-2-05-scheduler-service.md`](./p2-2-05-scheduler-service.md)。

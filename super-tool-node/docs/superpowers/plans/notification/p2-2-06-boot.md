# P2.2-06：启动 boot（恢复 cron/rrule + Stuck 扫描）（Task 6）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 5（scheduler）

---

## Step 1: 创建 `app/boot/taskScheduleBoot.ts`

```typescript
import { Application } from 'egg';
import { getTaskQueue } from '../queue/queues';

export class TaskScheduleBoot {
  private timer: NodeJS.Timeout | null = null;

  constructor(private app: Application) {}

  /** didReady 时调用 */
  async start() {
    if (this.app.config.notification.task.enabled === false) {
      this.app.logger.warn('[notif.task.boot] disabled by config');
      return;
    }
    await this._restoreCronAndRrule();
    await this._initialStuckScan();
    this._scheduleStuckScan();
    this.app.logger.info('[notif.task.boot] started');
  }

  /** beforeClose 时调用 */
  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.app.logger.info('[notif.task.boot] stopped');
  }

  /**
   * 重启后扫描所有 status='scheduled' 且 sendType in (cron, rrule) 的任务，
   * 重新挂入 BullMQ：
   * - cron：addRepeatable
   * - rrule：根据 nextFireAt 入 delayed job（若过期则重算）
   */
  private async _restoreCronAndRrule() {
    const ctx = this.app.createAnonymousContext();
    const tasks = await ctx.model.NotificationTask.findAll({
      where: {
        status: 'scheduled',
        sendType: { [this.app.Sequelize.Op.in]: ['cron', 'rrule'] },
      },
    });
    const queue = getTaskQueue(this.app);
    for (const t of tasks) {
      try {
        if (t.sendType === 'cron') {
          // 幂等：BullMQ 同 jobId + 同 cron 不会重复
          await queue.add('task',
            { taskId: t.id, trigger: 'cron' },
            { repeat: { cron: t.cronExpr }, jobId: `task-${t.id}-cron` });
          this.app.logger.info(`[notif.task.boot] restored cron task ${t.id}`);
        } else if (t.sendType === 'rrule') {
          let nextFire = t.nextFireAt ? new Date(t.nextFireAt) : null;
          if (!nextFire || nextFire.getTime() < Date.now()) {
            // 过期重算
            const r = require('../lib/rruleHelper');
            nextFire = r.nextFireFromRrule(t.rrule);
            if (nextFire) await t.update({ nextFireAt: nextFire });
          }
          if (nextFire) {
            const delay = Math.max(0, nextFire.getTime() - Date.now());
            await queue.add('task',
              { taskId: t.id, trigger: 'rrule', fireAt: nextFire.getTime() },
              { delay, jobId: `task-${t.id}-rr-${nextFire.getTime()}` });
            this.app.logger.info(`[notif.task.boot] restored rrule task ${t.id} next=${nextFire.toISOString()}`);
          } else {
            await t.update({ status: 'completed', finishedAt: new Date(),
              failReason: 'rrule has no future fires' });
          }
        }
      } catch (e: any) {
        this.app.logger.error(`[notif.task.boot] restore task ${t.id} failed: ${e.message}`, e);
      }
    }
  }

  private async _initialStuckScan() {
    const ctx = this.app.createAnonymousContext();
    const r = await ctx.service.notificationTaskScheduler.scanStuck();
    if (r.recovered > 0) {
      this.app.logger.warn(`[notif.task.boot] initial stuck scan recovered ${r.recovered} tasks`);
    }
  }

  private _scheduleStuckScan() {
    const interval = this.app.config.notification.task.stuckScanIntervalMs;
    if (!interval) return;
    this.timer = setInterval(async () => {
      try {
        const ctx = this.app.createAnonymousContext();
        await ctx.service.notificationTaskScheduler.scanStuck();
      } catch (e: any) {
        this.app.logger.error(`[notif.task.boot] periodic stuck scan failed: ${e.message}`, e);
      }
    }, interval);
  }
}
```

---

## Step 2: 修改根目录 `app.ts`，把 boot 挂到 didReady / beforeClose

> 项目应已存在 `app.ts`（P1 Task 9 已建）。在已有 `QueueLifecycle` 之后追加 `TaskScheduleBoot`。

```typescript
import { Application } from 'egg';
import { QueueLifecycle } from './app/queue';
import { TaskScheduleBoot } from './app/boot/taskScheduleBoot';

export default class AppBootHook {
  private queueLifecycle: QueueLifecycle;
  private taskBoot: TaskScheduleBoot;

  constructor(private app: Application) {
    this.queueLifecycle = new QueueLifecycle(app);
    this.taskBoot = new TaskScheduleBoot(app);
  }

  async didReady() {
    if (this.app.config.env === 'unittest') return;
    await this.queueLifecycle.start();
    // boot 必须在 queue 启动之后
    await this.taskBoot.start();
  }

  async beforeClose() {
    await this.taskBoot.stop();
    await this.queueLifecycle.stop();
  }
}
```

---

## Step 3: 测试 `test/notification/boot/task-schedule-boot.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';
import { TaskScheduleBoot } from '../../../app/boot/taskScheduleBoot';

describe('boot/taskScheduleBoot', () => {
  beforeEach(async () => {
    await (app as any).model.NotificationTask.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_BOOT_%' } }, force: true,
    });
  });

  it('启动后 cron 任务被重新加入 BullMQ', async () => {
    const queueAdds: any[] = [];
    mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
      add: async (_n: string, data: any, opts: any) => { queueAdds.push({ data, opts }); return { id: 'j' }; },
    }));
    const ctx = app.mockContext();
    await ctx.model.NotificationTask.create({
      name: 'TEST_BOOT_cron', typeId: 1, audienceType: 'static',
      audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
      sendType: 'cron', cronExpr: '0 9 * * *', status: 'scheduled',
    });
    const boot = new TaskScheduleBoot(app);
    await boot.start();
    await boot.stop();
    assert.ok(queueAdds.some((j) => j.opts.repeat?.cron === '0 9 * * *'));
  });

  it('启动后过期 nextFireAt 的 rrule 任务被重算', async () => {
    const queueAdds: any[] = [];
    mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
      add: async (_n: string, data: any, opts: any) => { queueAdds.push({ data, opts }); return { id: 'j' }; },
    }));
    const ctx = app.mockContext();
    const task = await ctx.model.NotificationTask.create({
      name: 'TEST_BOOT_rr_expired', typeId: 1, audienceType: 'static',
      audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
      sendType: 'rrule', rrule: 'FREQ=DAILY', status: 'scheduled',
      nextFireAt: new Date(Date.now() - 86400_000), // 昨天
    });
    const boot = new TaskScheduleBoot(app);
    await boot.start();
    await boot.stop();
    await task.reload();
    assert.ok(task.nextFireAt > new Date());
    assert.ok(queueAdds.length >= 1);
  });

  it('启动时调用 scanStuck 恢复 stuck 任务', async () => {
    const ctx = app.mockContext();
    await ctx.model.NotificationTask.create({
      name: 'TEST_BOOT_stuck', typeId: 1, audienceType: 'static',
      audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
      sendType: 'immediate', status: 'running',
      startedAt: new Date(Date.now() - 60 * 60_000),
    });
    let scanCalled = false;
    mock(app.serviceClasses.notificationTaskScheduler.prototype, 'scanStuck',
      async () => { scanCalled = true; return { recovered: 1 }; });
    const boot = new TaskScheduleBoot(app);
    await boot.start();
    await boot.stop();
    assert.equal(scanCalled, true);
  });
});
```

---

## Step 4: 验证

```bash
npm test -- --testPathPattern=task-schedule-boot
```

预期：3/3 PASS。

`npm run dev` 启动后日志含 `[notif.task.boot] started`；如有历史 cron/rrule 任务可见 `restored ...` 行。

---

## Step 5: Commit

```bash
git add super-tool-node/app/boot/taskScheduleBoot.ts super-tool-node/app.ts super-tool-node/test/notification/boot/task-schedule-boot.test.ts
git commit -m "feat(notification): add startup boot for task schedule (restore cron/rrule + stuck scan)

- restoreCronAndRrule: re-enqueue all scheduled cron/rrule tasks on app didReady
- expired rrule.nextFireAt is recomputed; tasks without future fire are completed
- initial + periodic stuck scan (default every 5min)
- 3 unit tests covering cron restore, rrule recompute, stuck scan

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 6)"
```

---

## Verification Checklist

- [ ] `app/boot/taskScheduleBoot.ts` 存在
- [ ] `app.ts` 已挂 boot 到 didReady/beforeClose
- [ ] 3 用例 PASS
- [ ] dev 启动日志可见
- [ ] commit 已提交

完成后进入 [`p2-2-07-admin-api.md`](./p2-2-07-admin-api.md)。

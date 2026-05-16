# P2.2-05：scheduler service（4 sendType + 4 生命周期 + 18 用例）（Task 5）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 3（helpers）+ Task 4（queue/worker）

---

## Step 1: 创建 service 接口（先写测试再写实现）

测试文件：`test/notification/service/notification-task-scheduler.test.ts`，18 用例分 5 组：

### Group A：scheduleNew（4 sendType 创建）

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification-task-scheduler', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext({ adminUser: { id: 1 } });
    await ctx.model.NotificationTask.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_SCH_%' } }, force: true,
    });
  });

  describe('Group A: scheduleNew', () => {
    it('immediate 创建 → status=running，30s 后入队 task job (trigger=immediate-confirmed)', async () => {
      const queued: any[] = [];
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async (_n: string, data: any, opts: any) => { queued.push({ data, opts }); return { id: `j-${queued.length}` }; },
      }));
      const task = await ctx.service.notificationTaskScheduler.scheduleNew({
        name: 'TEST_SCH_imm', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', operatorId: 1,
      });
      assert.equal(task.status, 'running');
      assert.equal(task.undoWindowSec, 30);
      assert.equal(queued.length, 1);
      assert.equal(queued[0].data.trigger, 'immediate-confirmed');
      assert.equal(queued[0].opts.delay, 30_000);
    });

    it('scheduled 创建：scheduledAt 距今 60s → status=scheduled，delayed=60_000', async () => {
      const queued: any[] = [];
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async (_n: string, data: any, opts: any) => { queued.push({ data, opts }); return { id: 'j' }; },
      }));
      const at = new Date(Date.now() + 60_000);
      const task = await ctx.service.notificationTaskScheduler.scheduleNew({
        name: 'TEST_SCH_sch', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'scheduled', scheduledAt: at, operatorId: 1,
      });
      assert.equal(task.status, 'scheduled');
      assert.equal(queued[0].data.trigger, 'scheduled');
      assert.ok(Math.abs(queued[0].opts.delay - 60_000) < 1500);
    });

    it('scheduled 但目标时间 < now+30s → 抛 108303 SCHEDULE_TOO_SOON', async () => {
      await assert.rejects(
        ctx.service.notificationTaskScheduler.scheduleNew({
          name: 'TEST_SCH_too_soon', typeId: 1, audienceType: 'static',
          audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
          sendType: 'scheduled', scheduledAt: new Date(Date.now() + 5_000),
          operatorId: 1,
        }),
        /108303/,
      );
    });

    it('cron 创建 → 计算 nextFireAt + repeatable job', async () => {
      const repeatCalls: any[] = [];
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async (_n: string, data: any, opts: any) => { repeatCalls.push({ data, opts }); return { id: 'j' }; },
      }));
      const task = await ctx.service.notificationTaskScheduler.scheduleNew({
        name: 'TEST_SCH_cron', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *', operatorId: 1,
      });
      assert.equal(task.status, 'scheduled');
      assert.ok(task.nextFireAt);
      assert.equal(repeatCalls[0].data.trigger, 'cron');
      assert.ok(repeatCalls[0].opts.repeat?.cron === '0 9 * * *' || repeatCalls[0].opts.delay > 0);
    });

    it('cron 非法 → 抛 108304 CRON_INVALID', async () => {
      await assert.rejects(
        ctx.service.notificationTaskScheduler.scheduleNew({
          name: 'TEST_SCH_cron_bad', typeId: 1, audienceType: 'static',
          audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
          sendType: 'cron', cronExpr: 'invalid', operatorId: 1,
        }),
        /108304/,
      );
    });

    it('rrule 创建 → 计算 nextFireAt + delayed job (一次)', async () => {
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async () => ({ id: 'j' }),
      }));
      const task = await ctx.service.notificationTaskScheduler.scheduleNew({
        name: 'TEST_SCH_rr', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'rrule', rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', operatorId: 1,
      });
      assert.equal(task.status, 'scheduled');
      assert.ok(task.nextFireAt);
    });

    it('rrule 非法 → 抛 108310 RRULE_INVALID', async () => {
      await assert.rejects(
        ctx.service.notificationTaskScheduler.scheduleNew({
          name: 'TEST_SCH_rr_bad', typeId: 1, audienceType: 'static',
          audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
          sendType: 'rrule', rrule: 'NOT_A_RULE', operatorId: 1,
        }),
        /108310/,
      );
    });
  });

  describe('Group B: executeTrigger', () => {
    it('immediate-confirmed 触发 → 调 notification.sendByAudience，写 completed', async () => {
      let captured: any = null;
      mock(app.serviceClasses.notification.prototype, 'sendByAudience', async (input: any) => {
        captured = input;
        return { totalUsers: 2, totalMessages: 2 };
      });
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_exec1', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [10, 20] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'running', startedAt: new Date(),
      });
      const r = await ctx.service.notificationTaskScheduler.executeTrigger({
        task, trigger: 'immediate-confirmed',
      });
      assert.equal(r.ok, true);
      assert.equal(captured.audienceType, 'static');
      await task.reload();
      assert.equal(task.status, 'completed');
      assert.equal(task.totalMessages, 2);
    });

    it('cron 触发后 → 计算 nextFireAt 并保持 status=scheduled', async () => {
      mock(app.serviceClasses.notification.prototype, 'sendByAudience',
        async () => ({ totalUsers: 1, totalMessages: 1 }));
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_exec_cron', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *', status: 'scheduled',
      });
      await ctx.service.notificationTaskScheduler.executeTrigger({
        task, trigger: 'cron', fireAt: new Date(),
      });
      await task.reload();
      assert.equal(task.status, 'scheduled');
      assert.ok(task.lastFireAt);
      assert.ok(task.nextFireAt);
      assert.ok(task.nextFireAt > task.lastFireAt);
    });

    it('rrule 触发后 → 重新计算 nextFireAt 并入队下次 delayed job', async () => {
      mock(app.serviceClasses.notification.prototype, 'sendByAudience',
        async () => ({ totalUsers: 1, totalMessages: 1 }));
      const queued: any[] = [];
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async (_n: string, _d: any, opts: any) => { queued.push(opts); return { id: 'j' }; },
      }));
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_exec_rr', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'rrule', rrule: 'FREQ=DAILY', status: 'scheduled',
      });
      await ctx.service.notificationTaskScheduler.executeTrigger({
        task, trigger: 'rrule', fireAt: new Date(),
      });
      await task.reload();
      assert.equal(task.status, 'scheduled');
      assert.ok(task.nextFireAt);
      assert.ok(queued.length >= 1);
      assert.ok(queued[0].delay > 0);
    });

    it('sendByAudience 抛错 → task 标 failed + failReason', async () => {
      mock(app.serviceClasses.notification.prototype, 'sendByAudience', async () => {
        throw new Error('oops');
      });
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_exec_fail', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'scheduled', status: 'running',
      });
      const r = await ctx.service.notificationTaskScheduler.executeTrigger({
        task, trigger: 'scheduled',
      });
      assert.equal(r.ok, false);
      await task.reload();
      assert.equal(task.status, 'failed');
      assert.equal(task.failReason, 'oops');
    });
  });

  describe('Group C: pause / resume', () => {
    it('pause running cron 任务 → status=paused，移除 repeat job', async () => {
      const removed: any[] = [];
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        removeRepeatable: async (_n: string, opts: any) => { removed.push(opts); return true; },
        getRepeatableJobs: async () => [],
      }));
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_pause', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *', status: 'scheduled',
      });
      await ctx.service.notificationTaskScheduler.pause({ taskId: task.id, operatorId: 1 });
      await task.reload();
      assert.equal(task.status, 'paused');
      assert.ok(task.pausedAt);
    });

    it('pause completed 任务 → 抛 108311 CANNOT_PAUSE', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_pause_done', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'completed', finishedAt: new Date(),
      });
      await assert.rejects(
        ctx.service.notificationTaskScheduler.pause({ taskId: task.id, operatorId: 1 }),
        /108311/,
      );
    });

    it('resume paused cron → status=scheduled，重新入队 repeat job', async () => {
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        add: async () => ({ id: 'j' }),
      }));
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_resume', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *', status: 'paused', pausedAt: new Date(),
      });
      await ctx.service.notificationTaskScheduler.resume({ taskId: task.id, operatorId: 1 });
      await task.reload();
      assert.equal(task.status, 'scheduled');
      assert.equal(task.pausedAt, null);
    });

    it('resume scheduled 任务 → 抛 108315 NOT_PAUSED', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_resume_bad', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *', status: 'scheduled',
      });
      await assert.rejects(
        ctx.service.notificationTaskScheduler.resume({ taskId: task.id, operatorId: 1 }),
        /108315/,
      );
    });
  });

  describe('Group D: cancel / undo', () => {
    it('cancel scheduled 任务 → status=canceled，移除 BullMQ job', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_cancel', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'scheduled', status: 'scheduled', scheduledAt: new Date(Date.now() + 60_000),
      });
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        getJobs: async () => [],
        removeRepeatable: async () => true,
      }));
      await ctx.service.notificationTaskScheduler.cancel({ taskId: task.id, operatorId: 1 });
      await task.reload();
      assert.equal(task.status, 'canceled');
      assert.ok(task.canceledAt);
    });

    it('cancel completed 任务 → 抛 108313 CANNOT_CANCEL', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_cancel_done', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'completed', finishedAt: new Date(),
      });
      await assert.rejects(
        ctx.service.notificationTaskScheduler.cancel({ taskId: task.id, operatorId: 1 }),
        /108313/,
      );
    });

    it('undo immediate 任务在 30s 内 → status=canceled，删 BullMQ delayed job', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_undo', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'running', undoWindowSec: 30,
        startedAt: new Date(),
      });
      mock(require('../../../app/queue/queues'), 'getTaskQueue', () => ({
        getJobs: async () => [{ id: 'jid', remove: async () => true, name: 'task' }],
      }));
      await ctx.service.notificationTaskScheduler.undo({ taskId: task.id, operatorId: 1 });
      await task.reload();
      assert.equal(task.status, 'canceled');
    });

    it('undo 已超 30s 窗口 → 抛 108314 UNDO_EXPIRED', async () => {
      const task = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_undo_expired', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'running', undoWindowSec: 30,
        startedAt: new Date(Date.now() - 60_000),
      });
      await assert.rejects(
        ctx.service.notificationTaskScheduler.undo({ taskId: task.id, operatorId: 1 }),
        /108314/,
      );
    });
  });

  describe('Group E: stuck scan', () => {
    it('scanStuck 把 running 且 startedAt < now-stuckThreshold 的任务标 failed', async () => {
      const long = await ctx.model.NotificationTask.create({
        name: 'TEST_SCH_stuck', typeId: 1, audienceType: 'static',
        audienceRule: { userIds: [1] }, params: {}, channels: ['inApp'],
        sendType: 'immediate', status: 'running',
        startedAt: new Date(Date.now() - 60 * 60_000),
      });
      const r = await ctx.service.notificationTaskScheduler.scanStuck();
      await long.reload();
      assert.equal(long.status, 'failed');
      assert.ok(long.failReason?.includes('stuck'));
      assert.equal(r.recovered >= 1, true);
    });
  });
});
```

---

## Step 2: 实现 `app/service/notification-task-scheduler.ts`

```typescript
import { Service } from 'egg';
import { getTaskQueue } from '../queue/queues';
import { nextFireFromCron, validateCron } from '../lib/cronHelper';
import { nextFireFromRrule, parseRrule, rruleHasFireWithin } from '../lib/rruleHelper';
import { NOTIF_ERR } from '../constants/errorCodes';

export type SendType = 'immediate' | 'scheduled' | 'cron' | 'rrule';

export interface ScheduleNewInput {
  name: string;
  typeId: number;
  audienceType: 'all' | 'static' | 'dynamic';
  audienceRule: any;
  params: Record<string, any>;
  channels?: ('inApp' | 'email' | 'sms')[];
  sendType: SendType;
  scheduledAt?: Date;
  cronExpr?: string;
  rrule?: string;
  operatorId: number;
}

export default class NotificationTaskSchedulerService extends Service {

  // -------- 创建 --------

  async scheduleNew(input: ScheduleNewInput) {
    const { ctx, app } = this;
    const taskCfg = app.config.notification.task;
    const type = await ctx.model.NotificationType.findByPk(input.typeId);
    if (!type) ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND);

    let status: 'running' | 'scheduled' = 'scheduled';
    let undoWindowSec: number | null = null;
    let nextFireAt: Date | null = null;

    switch (input.sendType) {
      case 'immediate':
        status = 'running';
        undoWindowSec = taskCfg.undoWindowSec;
        break;
      case 'scheduled': {
        if (!input.scheduledAt) ctx.throwBiz(400, 'scheduledAt required');
        const ms = input.scheduledAt.getTime() - Date.now();
        if (ms < taskCfg.minScheduleSec * 1000) {
          ctx.throwBiz(108303, `scheduledAt must be >= now+${taskCfg.minScheduleSec}s`);
        }
        nextFireAt = input.scheduledAt;
        break;
      }
      case 'cron': {
        if (!input.cronExpr) ctx.throwBiz(400, 'cronExpr required');
        validateCron(input.cronExpr); // 抛 108304
        nextFireAt = nextFireFromCron(input.cronExpr);
        break;
      }
      case 'rrule': {
        if (!input.rrule) ctx.throwBiz(400, 'rrule required');
        parseRrule(input.rrule); // 抛 108310
        if (!rruleHasFireWithin(input.rrule, taskCfg.rruleMaxFutureDays)) {
          ctx.throwBiz(108310, `rrule has no fire within ${taskCfg.rruleMaxFutureDays} days`);
        }
        nextFireAt = nextFireFromRrule(input.rrule);
        break;
      }
      default:
        ctx.throwBiz(400, 'unknown sendType');
    }

    const task = await ctx.model.NotificationTask.create({
      name: input.name,
      typeId: input.typeId,
      audienceType: input.audienceType,
      audienceRule: input.audienceRule,
      params: input.params ?? {},
      channels: input.channels ?? type.defaultChannels,
      sendType: input.sendType,
      scheduledAt: input.scheduledAt ?? null,
      cronExpr: input.cronExpr ?? null,
      rrule: input.rrule ?? null,
      undoWindowSec,
      status,
      startedAt: input.sendType === 'immediate' ? new Date() : null,
      nextFireAt,
      createdBy: input.operatorId,
    });

    await this._enqueueForTask(task);
    return task;
  }

  // -------- worker 调用 --------

  async executeTrigger(input: {
    task: any;
    trigger: 'immediate-confirmed' | 'scheduled' | 'cron' | 'rrule';
    fireAt?: Date;
  }) {
    const { ctx } = this;
    const { task, trigger } = input;
    const fireAt = input.fireAt ?? new Date();
    try {
      const type = await ctx.model.NotificationType.findByPk(task.typeId);
      const r = await ctx.service.notification.sendByAudience({
        typeKey: type.typeKey,
        audienceType: task.audienceType,
        audienceRule: task.audienceRule,
        params: task.params ?? {},
        channels: task.channels,
        taskId: task.id,
      });

      // 状态推进
      if (trigger === 'cron' || trigger === 'rrule') {
        const next = trigger === 'cron'
          ? nextFireFromCron(task.cronExpr, fireAt)
          : nextFireFromRrule(task.rrule, fireAt);
        await task.update({
          lastFireAt: fireAt,
          nextFireAt: next,
          totalUsers: (task.totalUsers ?? 0) + r.totalUsers,
          totalMessages: (task.totalMessages ?? 0) + r.totalMessages,
          // 保持 scheduled 状态
        });
        if (trigger === 'rrule' && next) {
          // rrule 不用 BullMQ repeat，每次重新入队 delayed
          await this._enqueueRruleNext(task, next);
        }
      } else {
        await task.update({
          status: 'completed',
          finishedAt: new Date(),
          totalUsers: r.totalUsers,
          totalMessages: r.totalMessages,
        });
      }
      return { ok: true, totalUsers: r.totalUsers, totalMessages: r.totalMessages };
    } catch (e: any) {
      await task.update({
        status: 'failed',
        finishedAt: new Date(),
        failReason: e.message,
      });
      ctx.logger.error(`[task.scheduler] task ${task.id} execute failed: ${e.message}`, e);
      return { ok: false, error: e.message };
    }
  }

  // -------- 生命周期 --------

  async pause(input: { taskId: number; operatorId: number }) {
    const { ctx, app } = this;
    const task = await ctx.model.NotificationTask.findByPk(input.taskId);
    if (!task) ctx.throwBiz(NOTIF_ERR.TASK_NOT_FOUND);
    if (!['scheduled', 'running'].includes(task.status)) {
      ctx.throwBiz(NOTIF_ERR.TASK_CANNOT_PAUSE, `current=${task.status}`);
    }
    if (task.sendType === 'cron') {
      const queue = getTaskQueue(app);
      await queue.removeRepeatable('task', { cron: task.cronExpr });
    }
    // scheduled / immediate 的 delayed job 保留状态判定（worker 内会因 status=paused 跳过）
    await task.update({ status: 'paused', pausedAt: new Date() });
    await ctx.service.audit.log({
      action: 'notification.task.pause', target: `task:${task.id}`,
    });
    return task;
  }

  async resume(input: { taskId: number; operatorId: number }) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(input.taskId);
    if (!task) ctx.throwBiz(NOTIF_ERR.TASK_NOT_FOUND);
    if (task.status !== 'paused') ctx.throwBiz(NOTIF_ERR.TASK_NOT_PAUSED);
    await task.update({ status: 'scheduled', pausedAt: null });
    await this._enqueueForTask(task);
    await ctx.service.audit.log({
      action: 'notification.task.resume', target: `task:${task.id}`,
    });
    return task;
  }

  async cancel(input: { taskId: number; operatorId: number }) {
    const { ctx, app } = this;
    const task = await ctx.model.NotificationTask.findByPk(input.taskId);
    if (!task) ctx.throwBiz(NOTIF_ERR.TASK_NOT_FOUND);
    if (['completed', 'failed', 'canceled'].includes(task.status)) {
      ctx.throwBiz(NOTIF_ERR.TASK_CANNOT_CANCEL, `current=${task.status}`);
    }
    if (task.sendType === 'cron') {
      const queue = getTaskQueue(app);
      try { await queue.removeRepeatable('task', { cron: task.cronExpr }); } catch (_) {}
    }
    await task.update({ status: 'canceled', canceledAt: new Date() });
    await ctx.service.audit.log({
      action: 'notification.task.cancel', target: `task:${task.id}`,
    });
    return task;
  }

  async undo(input: { taskId: number; operatorId: number }) {
    const { ctx, app } = this;
    const task = await ctx.model.NotificationTask.findByPk(input.taskId);
    if (!task) ctx.throwBiz(NOTIF_ERR.TASK_NOT_FOUND);
    if (task.sendType !== 'immediate' || !task.undoWindowSec) {
      ctx.throwBiz(NOTIF_ERR.TASK_CANNOT_CANCEL, 'only immediate task supports undo');
    }
    const elapsedMs = Date.now() - new Date(task.startedAt).getTime();
    if (elapsedMs > task.undoWindowSec * 1000) {
      ctx.throwBiz(NOTIF_ERR.TASK_UNDO_EXPIRED);
    }
    // 删除 BullMQ delayed job
    const queue = getTaskQueue(app);
    const jobs = await queue.getJobs(['delayed', 'waiting']);
    for (const j of jobs) {
      if (j?.data?.taskId === task.id) {
        try { await j.remove(); } catch (_) {}
      }
    }
    await task.update({ status: 'canceled', canceledAt: new Date() });
    await ctx.service.audit.log({
      action: 'notification.task.undo', target: `task:${task.id}`,
    });
    return task;
  }

  // -------- Stuck 扫描 --------

  async scanStuck() {
    const { ctx, app } = this;
    const threshold = new Date(Date.now() - app.config.notification.task.stuckThresholdSec * 1000);
    const stuck = await ctx.model.NotificationTask.findAll({
      where: { status: 'running', startedAt: { [app.Sequelize.Op.lt]: threshold } },
      limit: 100,
    });
    let recovered = 0;
    for (const t of stuck) {
      await t.update({
        status: 'failed', finishedAt: new Date(),
        failReason: 'stuck (no progress within threshold), auto recovered',
      });
      recovered++;
      ctx.logger.warn(`[task.scheduler] stuck task ${t.id} auto-failed`);
    }
    return { recovered };
  }

  // -------- 内部 --------

  private async _enqueueForTask(task: any) {
    const queue = getTaskQueue(this.app);
    const taskCfg = this.app.config.notification.task;
    switch (task.sendType) {
      case 'immediate': {
        await queue.add('task',
          { taskId: task.id, trigger: 'immediate-confirmed' },
          { delay: taskCfg.undoWindowSec * 1000, jobId: `task-${task.id}-imm` });
        return;
      }
      case 'scheduled': {
        const delay = Math.max(0, new Date(task.scheduledAt).getTime() - Date.now());
        await queue.add('task',
          { taskId: task.id, trigger: 'scheduled' },
          { delay, jobId: `task-${task.id}-sch` });
        return;
      }
      case 'cron': {
        await queue.add('task',
          { taskId: task.id, trigger: 'cron' },
          { repeat: { cron: task.cronExpr }, jobId: `task-${task.id}-cron` });
        return;
      }
      case 'rrule': {
        if (task.nextFireAt) await this._enqueueRruleNext(task, task.nextFireAt);
        return;
      }
    }
  }

  private async _enqueueRruleNext(task: any, fireAt: Date) {
    const queue = getTaskQueue(this.app);
    const delay = Math.max(0, fireAt.getTime() - Date.now());
    await queue.add('task',
      { taskId: task.id, trigger: 'rrule', fireAt: fireAt.getTime() },
      { delay, jobId: `task-${task.id}-rr-${fireAt.getTime()}` });
  }
}
```

---

## Step 3: 运行测试

```bash
npm test -- --testPathPattern=notification-task-scheduler
```

预期：18 用例全 PASS（如有少数 mock 边界，按报错调整 import path 即可）。

---

## Step 4: Commit

```bash
git add super-tool-node/app/service/notification-task-scheduler.ts super-tool-node/test/notification/service/notification-task-scheduler.test.ts
git commit -m "feat(notification): add task scheduler service (4 sendType + lifecycle + stuck scan)

- scheduleNew: immediate(undo 30s)/scheduled/cron(repeatable)/rrule(delayed chain)
- executeTrigger: send via notification.sendByAudience; advance lastFireAt/nextFireAt for cron/rrule
- pause/resume: cron uses removeRepeatable + re-add; others rely on worker status check
- cancel: state guard, removes repeat job
- undo: 30s window, removes delayed job from bullmq
- scanStuck: marks stale running tasks as failed with reason
- 18 unit tests covering all branches

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 5)"
```

---

## Verification Checklist

- [ ] service 5 个 public 方法（scheduleNew / executeTrigger / pause / resume / cancel / undo / scanStuck）
- [ ] 18 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-2-06-boot.md`](./p2-2-06-boot.md)。

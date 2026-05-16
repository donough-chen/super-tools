# P2.2-07：admin API（扩展 task 创建 + 4 操作端点）（Task 7）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 5（scheduler service）

---

## Step 1: 修改 `app/router.ts` 路由

在 P1 已有的 `/api/admin/notification/tasks` 之外追加 4 个操作端点 + 1 个 preview 端点：

```typescript
// 任务创建保留 P1 路由，但 controller 内部改走 scheduler
// 新增 4 个操作端点
router.post('/api/admin/notification/tasks/:id/pause',
  adminAuth, adminPerm('notification:task:pause'),
  controller.admin.notificationTask.pause);
router.post('/api/admin/notification/tasks/:id/resume',
  adminAuth, adminPerm('notification:task:pause'),
  controller.admin.notificationTask.resume);
router.post('/api/admin/notification/tasks/:id/cancel',
  adminAuth, adminPerm('notification:task:cancel'),
  controller.admin.notificationTask.cancel);
router.post('/api/admin/notification/tasks/:id/undo',
  adminAuth, adminPerm('notification:task:undo'),
  controller.admin.notificationTask.undo);

// 调度预览（cron / rrule 都用此端点）
router.post('/api/admin/notification/tasks/preview-schedule',
  adminAuth, adminPerm('notification:task:create'),
  controller.admin.notificationTask.previewSchedule);
```

---

## Step 2: 修改 `app/controller/admin/notification-task.ts`

替换 P1 `create` 方法，改走 scheduler；并新增 5 个方法：

```typescript
import { Controller } from 'egg';
import { previewCron } from '../../lib/cronHelper';
import { previewRrule } from '../../lib/rruleHelper';

export default class NotificationTaskController extends Controller {

  // P1 已有：list / detail，保留
  async list() { /* P1 实现保留 */ }
  async detail() { /* P1 实现保留 */ }

  /** 替换 P1 create：转交 scheduler */
  async create() {
    const { ctx } = this;
    ctx.validate({
      name: { type: 'string', max: 200 },
      typeId: { type: 'integer' },
      audienceType: { type: 'enum', values: ['all', 'static', 'dynamic'] },
      audienceRule: { type: 'object' },
      params: { type: 'object', required: false },
      channels: { type: 'array', required: false },
      sendType: { type: 'enum', values: ['immediate', 'scheduled', 'cron', 'rrule'] },
      scheduledAt: { type: 'string', required: false }, // ISO
      cronExpr: { type: 'string', required: false, max: 100 },
      rrule: { type: 'string', required: false, max: 500 },
    }, ctx.request.body);

    const body = ctx.request.body;
    const task = await ctx.service.notificationTaskScheduler.scheduleNew({
      name: body.name,
      typeId: body.typeId,
      audienceType: body.audienceType,
      audienceRule: body.audienceRule,
      params: body.params ?? {},
      channels: body.channels,
      sendType: body.sendType,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      cronExpr: body.cronExpr,
      rrule: body.rrule,
      operatorId: ctx.adminUser.id,
    });

    await ctx.service.audit.log({
      action: 'notification.task.create',
      target: `task:${task.id}`,
      detail: { sendType: body.sendType },
    });
    ctx.success(task);
  }

  async pause() {
    const { ctx } = this;
    const r = await ctx.service.notificationTaskScheduler.pause({
      taskId: Number(ctx.params.id), operatorId: ctx.adminUser.id,
    });
    ctx.success(r);
  }

  async resume() {
    const { ctx } = this;
    const r = await ctx.service.notificationTaskScheduler.resume({
      taskId: Number(ctx.params.id), operatorId: ctx.adminUser.id,
    });
    ctx.success(r);
  }

  async cancel() {
    const { ctx } = this;
    const r = await ctx.service.notificationTaskScheduler.cancel({
      taskId: Number(ctx.params.id), operatorId: ctx.adminUser.id,
    });
    ctx.success(r);
  }

  async undo() {
    const { ctx } = this;
    const r = await ctx.service.notificationTaskScheduler.undo({
      taskId: Number(ctx.params.id), operatorId: ctx.adminUser.id,
    });
    ctx.success(r);
  }

  async previewSchedule() {
    const { ctx } = this;
    ctx.validate({
      sendType: { type: 'enum', values: ['cron', 'rrule'] },
      cronExpr: { type: 'string', required: false },
      rrule: { type: 'string', required: false },
      count: { type: 'integer', required: false, min: 1, max: 20 },
    }, ctx.request.body);
    const count = ctx.request.body.count ?? 5;
    let list: Date[] = [];
    if (ctx.request.body.sendType === 'cron') {
      list = previewCron(ctx.request.body.cronExpr, count);
    } else {
      list = previewRrule(ctx.request.body.rrule, count);
    }
    ctx.success({ list: list.map((d) => d.toISOString()) });
  }
}
```

---

## Step 3: 测试 `test/notification/controller/admin/notification-task-schedule.test.ts`（6 用例）

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-task-schedule', () => {
  let token: string;
  before(async () => { token = await (app as any).testHelper.adminLoginAs('superadmin'); });

  beforeEach(async () => {
    await (app as any).model.NotificationTask.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_API_%' } }, force: true,
    });
  });

  it('POST /tasks 创建 scheduled 任务，返回 status=scheduled + nextFireAt', async () => {
    const at = new Date(Date.now() + 60_000).toISOString();
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const r = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_API_sch', typeId: type.id,
        audienceType: 'static', audienceRule: { userIds: [1] },
        params: { announcement: 'x' }, channels: ['inApp'],
        sendType: 'scheduled', scheduledAt: at,
      });
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.status, 'scheduled');
    assert.ok(r.body.data.nextFireAt);
  });

  it('POST /tasks 创建 cron 任务，返回 nextFireAt', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const r = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_API_cron', typeId: type.id,
        audienceType: 'static', audienceRule: { userIds: [1] },
        params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *',
      });
    assert.equal(r.body.code, 0);
    assert.ok(r.body.data.nextFireAt);
  });

  it('POST /tasks/:id/pause 暂停 scheduled 任务', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const c = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_API_pause', typeId: type.id,
        audienceType: 'static', audienceRule: { userIds: [1] },
        params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *',
      });
    const id = c.body.data.id;
    const r = await app.httpRequest().post(`/api/admin/notification/tasks/${id}/pause`)
      .set('Authorization', `Bearer ${token}`).send({});
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.status, 'paused');
  });

  it('POST /tasks/:id/resume 恢复 paused → scheduled', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const c = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_API_resume', typeId: type.id,
        audienceType: 'static', audienceRule: { userIds: [1] },
        params: {}, channels: ['inApp'],
        sendType: 'cron', cronExpr: '0 9 * * *',
      });
    const id = c.body.data.id;
    await app.httpRequest().post(`/api/admin/notification/tasks/${id}/pause`)
      .set('Authorization', `Bearer ${token}`).send({});
    const r = await app.httpRequest().post(`/api/admin/notification/tasks/${id}/resume`)
      .set('Authorization', `Bearer ${token}`).send({});
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.status, 'scheduled');
  });

  it('POST /tasks/:id/cancel scheduled → canceled', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const c = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_API_cancel', typeId: type.id,
        audienceType: 'static', audienceRule: { userIds: [1] },
        params: {}, channels: ['inApp'],
        sendType: 'scheduled', scheduledAt: new Date(Date.now() + 600_000).toISOString(),
      });
    const id = c.body.data.id;
    const r = await app.httpRequest().post(`/api/admin/notification/tasks/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`).send({});
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.status, 'canceled');
  });

  it('POST /tasks/preview-schedule cron → 返回 5 个 ISO 时间', async () => {
    const r = await app.httpRequest().post('/api/admin/notification/tasks/preview-schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ sendType: 'cron', cronExpr: '0 9 * * *', count: 5 });
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.list.length, 5);
  });
});
```

---

## Step 4: 验证 & Commit

```bash
npm test -- --testPathPattern=notification-task-schedule
```

预期：6/6 PASS（除非测试库无 system_broadcast type，可改为 feedback_reply 等已存在的）。

```bash
git add super-tool-node/app/router.ts super-tool-node/app/controller/admin/notification-task.ts super-tool-node/test/notification/controller/admin/notification-task-schedule.test.ts
git commit -m "feat(notification): admin api for task scheduling (4 sendType + pause/resume/cancel/undo + preview)

- create now delegates to scheduler.scheduleNew (supports immediate/scheduled/cron/rrule)
- 4 lifecycle endpoints with separate perm codes (pause/cancel/undo)
- preview-schedule endpoint returns next N fire times for cron/rrule
- 6 e2e tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 7)"
```

---

## Verification Checklist

- [ ] 5 个新路由可访问且鉴权生效
- [ ] create 走 scheduler 路径
- [ ] 6 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-2-08-admin-ui.md`](./p2-2-08-admin-ui.md)。

# P1-10：Admin 任务/消息 + C 端 API + 三触发点改造

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T14 / T15 / T16**
> 前置：T11（notification.send）、T13（admin types/templates API）

---

## Task 14：Admin API（任务创建立即发送 + 消息查询）

**目标**：

- `notification-task` controller：创建任务（仅 `sendType=immediate`）+ 列表 + 详情
- `notification-message` controller：管理员视角消息记录查询
- 任务执行逻辑：创建 task 行 → 调用 `service.notification.sendByAudience` → 写回 task 状态

### 14.1 路由：`app/router.ts` 追加

```typescript
// 任务
router.get('/api/admin/notification/tasks', adminAuth, adminPerm('notification:task:view'), controller.admin.notificationTask.list);
router.get('/api/admin/notification/tasks/:id', adminAuth, adminPerm('notification:task:view'), controller.admin.notificationTask.detail);
router.post('/api/admin/notification/tasks', adminAuth, adminPerm('notification:task:create'), controller.admin.notificationTask.create);

// 消息（管理员视角）
router.get('/api/admin/notification/messages', adminAuth, adminPerm('notification:message:view'), controller.admin.notificationMessage.list);
router.get('/api/admin/notification/messages/:id', adminAuth, adminPerm('notification:message:view'), controller.admin.notificationMessage.detail);
```

### 14.2 controller：`app/controller/admin/notification-task.ts`

```typescript
import { Controller } from 'egg';

export default class NotificationTaskController extends Controller {

  async list() {
    const { ctx } = this;
    const { status, typeId, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (status) where.status = status;
    if (typeId) where.typeId = Number(typeId);
    const { rows, count } = await ctx.model.NotificationTask.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    ctx.success({ list: rows, total: count });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const task = await ctx.model.NotificationTask.findByPk(id);
    if (!task) ctx.throwBiz(108301);
    const stats = await ctx.model.NotificationMessage.findAll({
      where: { taskId: id },
      attributes: [
        'status',
        [ctx.app.Sequelize.fn('COUNT', ctx.app.Sequelize.col('id')), 'cnt'],
      ],
      group: ['status'],
      raw: true,
    });
    ctx.success({ task, stats });
  }

  async create() {
    const { ctx } = this;
    ctx.validate({
      name: { type: 'string', max: 200 },
      typeId: { type: 'integer' },
      audienceType: { type: 'enum', values: ['all', 'static', 'dynamic'] },
      audienceRule: { type: 'object' },
      params: { type: 'object', required: false },
      channels: { type: 'array', required: false },
      sendType: { type: 'enum', values: ['immediate'] }, // P1 仅 immediate
    }, ctx.request.body);

    const type = await ctx.model.NotificationType.findByPk(ctx.request.body.typeId);
    if (!type) ctx.throwBiz(108101);

    const task = await ctx.model.NotificationTask.create({
      name: ctx.request.body.name,
      typeId: ctx.request.body.typeId,
      audienceType: ctx.request.body.audienceType,
      audienceRule: ctx.request.body.audienceRule,
      params: ctx.request.body.params ?? {},
      channels: ctx.request.body.channels ?? type.defaultChannels,
      sendType: 'immediate',
      status: 'running',
      createdBy: ctx.adminUser.id,
      startedAt: new Date(),
    });

    await ctx.service.audit.log({
      action: 'notification.task.create',
      target: `task:${task.id}`,
      detail: { typeKey: type.typeKey, audienceType: task.audienceType },
    });

    // 异步执行（不 await）
    this._runTask(task, type).catch((e) => {
      ctx.logger.error(`[notif.task] task ${task.id} run failed: ${e.message}`);
    });

    ctx.success(task);
  }

  private async _runTask(task: any, type: any) {
    const { ctx } = this;
    try {
      const r = await ctx.service.notification.sendByAudience({
        typeKey: type.typeKey,
        audienceType: task.audienceType,
        audienceRule: task.audienceRule,
        params: task.params,
        channels: task.channels,
        taskId: task.id,
      });
      await task.update({
        status: 'completed',
        finishedAt: new Date(),
        totalUsers: r.totalUsers,
        totalMessages: r.totalMessages,
      });
    } catch (e: any) {
      await task.update({
        status: 'failed',
        finishedAt: new Date(),
        failReason: e.message,
      });
    }
  }
}
```

### 14.3 controller：`app/controller/admin/notification-message.ts`

```typescript
import { Controller } from 'egg';

export default class NotificationMessageController extends Controller {

  async list() {
    const { ctx } = this;
    const { userId, typeId, channel, status, taskId, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (typeId) where.typeId = Number(typeId);
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (taskId) where.taskId = Number(taskId);
    const { rows, count } = await ctx.model.NotificationMessage.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    ctx.success({ list: rows, total: count });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const msg = await ctx.model.NotificationMessage.findByPk(id);
    if (!msg) ctx.throwBiz(108401);
    const logs = await ctx.model.NotificationSendLog.findAll({
      where: { messageId: id }, order: [['id', 'ASC']],
    });
    ctx.success({ message: msg, sendLogs: logs });
  }
}
```

### 14.4 测试：`test/notification/controller/admin/notification-task.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-task', () => {
  let token: string;
  before(async () => { token = await (app as any).testHelper.adminLoginAs('superadmin'); });

  it('创建立即发送任务 → completed', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'system_broadcast' } });
    const r = await app.httpRequest().post('/api/admin/notification/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '联调任务',
        typeId: type.id,
        audienceType: 'static',
        audienceRule: { userIds: [1, 2] },
        params: { announcement: 'hello' },
        channels: ['inApp'],
        sendType: 'immediate',
      });
    assert.equal(r.body.code, 0);
    const taskId = r.body.data.id;
    // 等待异步执行（粗略 sleep）
    await new Promise((res) => setTimeout(res, 1500));
    const detail = await app.httpRequest().get(`/api/admin/notification/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    assert.ok(['running', 'completed'].includes(detail.body.data.task.status));
  });
});
```

### 14.5 Commit

```
feat(notification): add admin API for tasks (immediate send) + message query
```

---

## Task 15：C 端 API（消息列表 / 未读数 / 已读 / 偏好）

**目标**：用户视角接口；权限码统一 `userAuthRequired`，无 RBAC。

### 15.1 路由：`app/router.ts` 追加

```typescript
const userAuth = middleware.userAuthRequired();

router.get('/api/notifications', userAuth, controller.notification.list);
router.get('/api/notifications/unread-count', userAuth, controller.notification.unreadCount);
router.post('/api/notifications/mark-read', userAuth, controller.notification.markRead);
router.post('/api/notifications/mark-all-read', userAuth, controller.notification.markAllRead);
router.post('/api/notifications/:id/archive', userAuth, controller.notification.archive);
router.get('/api/notifications/:id', userAuth, controller.notification.detail);

router.get('/api/notification-preferences', userAuth, controller.notification.listPreferences);
router.put('/api/notification-preferences', userAuth, controller.notification.upsertPreference);
```

### 15.2 controller：`app/controller/notification.ts`

```typescript
import { Controller } from 'egg';

export default class NotificationController extends Controller {

  async list() {
    const { ctx } = this;
    const userId = ctx.user.id;
    const { isRead, typeId, archived = '0', page = 1, pageSize = 20 } = ctx.query;
    const where: any = { userId, channel: 'inApp' };
    if (isRead !== undefined) where.isRead = Number(isRead);
    if (typeId) where.typeId = Number(typeId);
    where.archivedAt = archived === '1'
      ? { [ctx.app.Sequelize.Op.ne]: null }
      : null;
    const { rows, count } = await ctx.model.NotificationMessage.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    ctx.success({ list: rows, total: count });
  }

  async unreadCount() {
    const { ctx } = this;
    const count = await ctx.model.NotificationMessage.count({
      where: {
        userId: ctx.user.id,
        channel: 'inApp',
        isRead: 0,
        archivedAt: null,
      },
    });
    ctx.success({ count });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const msg = await ctx.model.NotificationMessage.findOne({
      where: { id, userId: ctx.user.id },
    });
    if (!msg) ctx.throwBiz(108401);
    ctx.success(msg);
  }

  async markRead() {
    const { ctx } = this;
    ctx.validate({ ids: { type: 'array', itemType: 'integer' } }, ctx.request.body);
    await ctx.model.NotificationMessage.update(
      { isRead: 1, readAt: new Date() },
      { where: { id: ctx.request.body.ids, userId: ctx.user.id, isRead: 0 } },
    );
    ctx.success();
  }

  async markAllRead() {
    const { ctx } = this;
    await ctx.model.NotificationMessage.update(
      { isRead: 1, readAt: new Date() },
      { where: { userId: ctx.user.id, channel: 'inApp', isRead: 0, archivedAt: null } },
    );
    ctx.success();
  }

  async archive() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const r = await ctx.model.NotificationMessage.update(
      { archivedAt: new Date() },
      { where: { id, userId: ctx.user.id } },
    );
    if (r[0] === 0) ctx.throwBiz(108401);
    ctx.success();
  }

  async listPreferences() {
    const { ctx } = this;
    const list = await ctx.service.notificationPreference.listForUser({ userId: ctx.user.id });
    ctx.success(list);
  }

  async upsertPreference() {
    const { ctx } = this;
    ctx.validate({
      typeId: { type: 'integer' },
      channels: { type: 'array', itemType: 'string' },
      enabled: { type: 'integer', values: [0, 1] },
    }, ctx.request.body);
    const row = await ctx.service.notificationPreference.upsert({
      userId: ctx.user.id, ...ctx.request.body,
    });
    ctx.success(row);
  }
}
```

### 15.3 测试：`test/notification/controller/notification.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/notification (C 端)', () => {
  let token: string; let userId: number;
  before(async () => {
    const r = await (app as any).testHelper.userLoginByMobile('13800000001');
    token = r.token; userId = r.userId;
  });

  it('GET /api/notifications/unread-count', async () => {
    const r = await app.httpRequest().get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.body.code, 0);
    assert.equal(typeof r.body.data.count, 'number');
  });

  it('完整链路：发消息 → 列表可见 → 标记已读 → 归档', async () => {
    const before = (await app.httpRequest().get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)).body.data.total;
    const ctx = app.mockContext();
    const r = await ctx.service.notification.send({
      typeKey: 'feedback_reply', userId, params: { content: 'XX' },
    });
    await new Promise((res) => setTimeout(res, 600)); // 等 worker
    const list = await app.httpRequest().get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(list.body.data.total >= before + 1, true);
    const id = list.body.data.list[0].id;
    await app.httpRequest().post('/api/notifications/mark-read')
      .set('Authorization', `Bearer ${token}`).send({ ids: [id] });
    await app.httpRequest().post(`/api/notifications/${id}/archive`)
      .set('Authorization', `Bearer ${token}`);
  });

  it('偏好 upsert + listForUser', async () => {
    const list = await app.httpRequest().get('/api/notification-preferences')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(list.body.code, 0);
    assert.ok(list.body.data.length > 0);
    const first = list.body.data[0];
    await app.httpRequest().put('/api/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ typeId: first.typeId, channels: ['inApp'], enabled: 1 });
  });
});
```

### 15.4 Commit

```
feat(notification): add C-end API (messages list/read/archive + preferences)
```

---

## Task 16：触发点改造（feedback / auth.unusualLogin / verify-code）

**目标**：把现有三处直接发短信/邮件的代码，改为调用 `ctx.service.notification.send` / `sendDirect`。

### 16.1 feedback.reply 改造

**位置**：`app/service/feedback.ts` 中现有的 reply 方法。

**改前**（示例）：
```typescript
// 旧：直接调用 sms 或不通知
await this.ctx.service.sms.send(user.mobile, `您的反馈已回复...`);
```

**改后**：
```typescript
await this.ctx.service.notification.send({
  typeKey: 'feedback_reply',
  userId: feedback.userId,
  params: {
    feedbackTitle: feedback.title,
    replyContent: replyContent.slice(0, 200),
  },
  bizRefType: 'feedback',
  bizRefId: String(feedback.id),
});
```

### 16.2 auth.unusualLogin 改造

**位置**：`app/service/auth.ts` 中检测异地登录的位置。

```typescript
// 在异地登录检测分支
if (isUnusual) {
  await this.ctx.service.notification.sendDirect({
    typeKey: 'unusual_login',
    userId: user.id,
    params: {
      ip: ctx.ip,
      city: ctx.helper.geoFromIp(ctx.ip)?.city || '未知',
      device: ctx.headers['user-agent'] || '未知',
      time: new Date().toLocaleString('zh-CN'),
    },
  });
}
```

> `sendDirect` 用于安全级通知，绕过用户偏好（用户不能关闭安全告警）。

### 16.3 verify-code.send 改造

**位置**：`app/service/verify-code.ts` 或对应控制器。

短信验证码与通知系统的关系：保持现有发短信路径不变（验证码 1 分钟内必须送达，不走异步队列），但同时**写一条 inApp 通知**用于审计。

```typescript
// 短信仍然走原 sms.ts 同步通道（不改）
await this.ctx.service.sms.sendVerifyCode(mobile, code);

// 额外写 inApp 用于审计与多端可见
try {
  await this.ctx.service.notification.sendDirect({
    typeKey: 'verify_code_sent',
    userId,
    params: { mobile: this.ctx.helper.maskMobile(mobile), scene },
    channels: ['inApp'], // 仅站内信，避免循环发短信
  });
} catch (e) {
  this.ctx.logger.warn(`[verify-code] notify failed: ${e.message}`);
}
```

### 16.4 测试：`test/notification/trigger/feedback-reply.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/feedback-reply', () => {
  it('回复反馈触发 notification.send', async () => {
    let called: any = null;
    mock(app.serviceClasses.notification.prototype, 'send', async (input: any) => {
      called = input;
      return { skipped: false, messages: [{ id: 1, channel: 'inApp' }] };
    });
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    const fb = await ctx.model.Feedback.create({
      userId: 100, title: 't', content: 'c', status: 'pending',
    });
    await ctx.service.feedback.reply({ feedbackId: fb.id, replyContent: 'hello' });
    assert.equal(called.typeKey, 'feedback_reply');
    assert.equal(called.userId, 100);
    assert.ok(called.params.replyContent);
  });
});
```

类似为 `auth-unusual-login.test.ts` 与 `verify-code.test.ts` 编写测试，断言 `notification.send`/`sendDirect` 被调用且参数正确。

### 16.5 验证 & Commit

- [ ] 三处触发点改造完成，旧代码彻底替换（不留 dead code）
- [ ] 所有原有 e2e（feedback/auth/verify-code）继续通过
- [ ] commit: `refactor(notification): migrate feedback-reply, unusual-login, verify-code to notification service`

---

## 完成检查

- [ ] T14：admin task/message API 就绪并写入审计
- [ ] T15：C 端 7 个接口可用（list/unreadCount/detail/markRead/markAllRead/archive/preferences）
- [ ] T16：3 处触发点全部走 notification.send / sendDirect
- [ ] 所有相关单测/e2e 通过
- [ ] 错误码：`108301` `108401`

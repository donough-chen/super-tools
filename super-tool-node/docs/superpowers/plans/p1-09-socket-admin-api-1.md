# P1-09：Socket.IO 鉴权 + Admin API（类型/模板）

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T12 / T13**
> 前置：T1（依赖+config）、T5（models）、T6（template service）

---

## Task 12：Socket.IO 配置 + JWT 鉴权中间件 + io controller

**目标**：

- 启用 `egg-socket.io`，根命名空间 `/`
- 鉴权中间件：从 `socket.handshake.auth.token` / `query.token` 取 JWT，验证后挂 `socket.user`，加入房间 `user:{id}`
- io controller：处理 `disconnect` 日志、`heartbeat` 响应（用于前端连接探活）

### 12.1 plugin.ts 启用（已在 T1 完成）确认

```typescript
// config/plugin.ts
socketIo: { enable: true, package: 'egg-socket.io' },
```

### 12.2 config 段（已在 T1 完成）确认

```typescript
// config/config.default.ts （T1 已加，此处仅参考）
config.io = {
  init: { wsEngine: 'ws' }, // 或保持默认
  namespace: {
    '/': {
      connectionMiddleware: ['notificationAuth'],
      packetMiddleware: [],
    },
  },
};
```

### 12.3 鉴权中间件：`app/io/middleware/notificationAuth.ts`

```typescript
import jwt from 'jsonwebtoken';

export default () => {
  return async (ctx: any, next: any) => {
    const socket = ctx.socket;
    const token =
      socket.handshake?.auth?.token ||
      socket.handshake?.query?.token ||
      '';
    if (!token) {
      ctx.app.logger.warn('[notif.io] no token, disconnect');
      socket.disconnect(true);
      return;
    }
    try {
      const decoded: any = jwt.verify(token, ctx.app.config.jwt.secret);
      socket.user = { id: decoded.id, role: decoded.role };
      socket.join(`user:${decoded.id}`);
      ctx.app.logger.info(`[notif.io] connected user=${decoded.id} sid=${socket.id}`);
      await next();
    } catch (e: any) {
      ctx.app.logger.warn(`[notif.io] invalid token: ${e.message}`);
      socket.disconnect(true);
    }
  };
};
```

### 12.4 io controller：`app/io/controller/notification.ts`

```typescript
import { Controller } from 'egg';

export default class NotificationIoController extends Controller {
  async disconnect() {
    const { ctx } = this;
    const socket = ctx.socket;
    ctx.app.logger.info(`[notif.io] disconnect sid=${socket.id} user=${socket.user?.id}`);
  }

  async heartbeat() {
    const { ctx } = this;
    ctx.socket.emit('heartbeat:ack', { ts: Date.now() });
  }
}
```

### 12.5 io router：`app/router.ts` 末尾追加

```typescript
// router.ts 在 export default 函数体追加
const { io } = app;
io.of('/').route('disconnect', app.io.controller.notification.disconnect);
io.of('/').route('heartbeat', app.io.controller.notification.heartbeat);
```

### 12.6 测试：`test/notification/io/auth.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';

describe('io/middleware/notificationAuth', () => {
  let port: number;
  before(async () => {
    await app.ready();
    const server = app.listen(0);
    port = (server.address() as any).port;
  });

  it('无 token → 立即断开', (done) => {
    const c = Client(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    c.on('disconnect', () => done());
  });

  it('有效 token → 加入 user:{id} 房间', (done) => {
    const token = jwt.sign({ id: 999, role: 'user' }, app.config.jwt.secret);
    const c = Client(`http://127.0.0.1:${port}`, {
      transports: ['websocket'], auth: { token },
    });
    c.on('connect', async () => {
      // 在另一个上下文 emit 给 user:999
      const io: any = (app as any).io;
      io.of('/').to('user:999').emit('test:hello', { ok: 1 });
    });
    c.on('test:hello', (payload) => {
      assert.deepEqual(payload, { ok: 1 });
      c.disconnect();
      done();
    });
  });
});
```

### 12.7 验证 & Commit

- [ ] dev 启动后 `socket.io-client` 带 token 能连上，无 token 立即断开
- [ ] commit: `feat(notification): add socket.io auth middleware + io controller`

---

## Task 13：Admin API（类型 + 模板 CRUD）

**目标**：管理端两块基础能力 API；权限码使用 T2 定义。

### 13.1 路由：`app/router.ts` 追加

```typescript
const adminAuth = middleware.adminAuthRequired();
const adminPerm = middleware.adminPermRequired;

// 类型
router.get('/api/admin/notification/types', adminAuth, adminPerm('notification:type:view'), controller.admin.notificationType.list);
router.post('/api/admin/notification/types', adminAuth, adminPerm('notification:type:edit'), controller.admin.notificationType.create);
router.put('/api/admin/notification/types/:id', adminAuth, adminPerm('notification:type:edit'), controller.admin.notificationType.update);
router.delete('/api/admin/notification/types/:id', adminAuth, adminPerm('notification:type:edit'), controller.admin.notificationType.destroy);

// 模板
router.get('/api/admin/notification/templates', adminAuth, adminPerm('notification:template:view'), controller.admin.notificationTemplate.list);
router.get('/api/admin/notification/templates/:id', adminAuth, adminPerm('notification:template:view'), controller.admin.notificationTemplate.detail);
router.post('/api/admin/notification/templates', adminAuth, adminPerm('notification:template:edit'), controller.admin.notificationTemplate.create);
router.put('/api/admin/notification/templates/:id', adminAuth, adminPerm('notification:template:edit'), controller.admin.notificationTemplate.update);
router.post('/api/admin/notification/templates/:id/publish', adminAuth, adminPerm('notification:template:publish'), controller.admin.notificationTemplate.publish);
router.post('/api/admin/notification/templates/:id/preview', adminAuth, adminPerm('notification:template:view'), controller.admin.notificationTemplate.preview);
router.post('/api/admin/notification/templates/:id/test-send', adminAuth, adminPerm('notification:template:test_send'), controller.admin.notificationTemplate.testSend);
```

### 13.2 controller：`app/controller/admin/notification-type.ts`

```typescript
import { Controller } from 'egg';

export default class NotificationTypeController extends Controller {

  async list() {
    const { ctx } = this;
    const { keyword, category, enabled, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (keyword) where.typeKey = { [ctx.app.Sequelize.Op.like]: `%${keyword}%` };
    if (category) where.category = category;
    if (enabled !== undefined) where.enabled = Number(enabled);
    const { rows, count } = await ctx.model.NotificationType.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    ctx.success({ list: rows, total: count });
  }

  async create() {
    const { ctx } = this;
    ctx.validate({
      typeKey: { type: 'string', max: 100 },
      name: { type: 'string', max: 200 },
      category: { type: 'enum', values: ['system', 'business', 'security', 'marketing'] },
      defaultChannels: { type: 'array', itemType: 'string' },
      priority: { type: 'enum', values: ['low', 'normal', 'high'], required: false },
      enabled: { type: 'integer', required: false, values: [0, 1] },
    }, ctx.request.body);

    const exists = await ctx.model.NotificationType.findOne({ where: { typeKey: ctx.request.body.typeKey } });
    if (exists) ctx.throwBiz(108110, 'typeKey duplicated');

    const row = await ctx.model.NotificationType.create({
      ...ctx.request.body,
      createdBy: ctx.adminUser.id,
      updatedBy: ctx.adminUser.id,
    });
    await ctx.service.audit.log({
      action: 'notification.type.create', target: `type:${row.id}`,
      detail: { typeKey: row.typeKey },
    });
    ctx.success(row);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationType.findByPk(id);
    if (!row) ctx.throwBiz(108101);
    await row.update({ ...ctx.request.body, updatedBy: ctx.adminUser.id });
    await ctx.service.audit.log({
      action: 'notification.type.update', target: `type:${id}`,
      detail: ctx.request.body,
    });
    ctx.success(row);
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const inUse = await ctx.model.NotificationTemplate.count({ where: { typeId: id } });
    if (inUse > 0) ctx.throwBiz(108111, 'type in use, disable instead of delete');
    const row = await ctx.model.NotificationType.findByPk(id);
    if (!row) ctx.throwBiz(108101);
    await row.destroy();
    await ctx.service.audit.log({ action: 'notification.type.delete', target: `type:${id}` });
    ctx.success();
  }
}
```

### 13.3 controller：`app/controller/admin/notification-template.ts`

```typescript
import { Controller } from 'egg';
import { renderTemplate } from '../../lib/templateRenderer';

export default class NotificationTemplateController extends Controller {

  async list() {
    const { ctx } = this;
    const { typeId, lang, channel, isActive, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (typeId) where.typeId = Number(typeId);
    if (lang) where.lang = lang;
    if (channel) where.channel = channel;
    if (isActive !== undefined) where.isActive = Number(isActive);
    const { rows, count } = await ctx.model.NotificationTemplate.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['typeId', 'ASC'], ['lang', 'ASC'], ['channel', 'ASC'], ['version', 'DESC']],
    });
    ctx.success({ list: rows, total: count });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throwBiz(108102);
    const versions = await ctx.model.NotificationTemplateVersion.findAll({
      where: { templateId: id },
      order: [['publishedAt', 'DESC']],
    });
    ctx.success({ template: tpl, versions });
  }

  async create() {
    const { ctx } = this;
    ctx.validate({
      typeId: { type: 'integer' },
      lang: { type: 'string' },
      channel: { type: 'enum', values: ['inApp', 'email', 'sms'] },
      titleTpl: { type: 'string' },
      bodyTpl: { type: 'string' },
    }, ctx.request.body);
    const draft = await ctx.service.notificationTemplate.createDraft({
      ...ctx.request.body,
      operatorId: ctx.adminUser.id,
    });
    await ctx.service.audit.log({ action: 'notification.template.create', target: `tpl:${draft.id}` });
    ctx.success(draft);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throwBiz(108102);
    if (tpl.isActive === 1) ctx.throwBiz(108112, 'cannot edit active template, create draft instead');
    await tpl.update({ ...ctx.request.body, updatedBy: ctx.adminUser.id });
    await ctx.service.audit.log({ action: 'notification.template.update', target: `tpl:${id}` });
    ctx.success(tpl);
  }

  async publish() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.service.notificationTemplate.publishVersion({
      templateId: id, operatorId: ctx.adminUser.id,
    });
    await ctx.service.audit.log({ action: 'notification.template.publish', target: `tpl:${id}` });
    ctx.success(tpl);
  }

  async preview() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throwBiz(108102);
    const params = ctx.request.body?.params || {};
    const out = renderTemplate(
      { titleTpl: tpl.titleTpl, bodyTpl: tpl.bodyTpl, channel: tpl.channel },
      params,
    );
    ctx.success(out);
  }

  async testSend() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throwBiz(108102);
    const type = await ctx.model.NotificationType.findByPk(tpl.typeId);
    const targetUserId = ctx.request.body?.userId ?? ctx.adminUser.id;
    const params = ctx.request.body?.params || {};
    const r = await ctx.service.notification.sendDirect({
      typeKey: type.typeKey,
      userId: targetUserId,
      params,
      channels: [tpl.channel],
      lang: tpl.lang,
    });
    await ctx.service.audit.log({
      action: 'notification.template.test_send',
      target: `tpl:${id}`,
      detail: { targetUserId, channel: tpl.channel },
    });
    ctx.success(r);
  }
}
```

### 13.4 测试：`test/notification/controller/admin/notification-type.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-type', () => {
  let token: string;
  before(async () => {
    // 借用项目 admin 测试登录工具，假设已有：
    token = await (app as any).testHelper.adminLoginAs('superadmin');
  });

  it('GET /api/admin/notification/types 列表 200', async () => {
    const r = await app.httpRequest()
      .get('/api/admin/notification/types?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.code, 0);
    assert.ok(Array.isArray(r.body.data.list));
  });

  it('POST 创建+typeKey重复返回 108110', async () => {
    const a = await app.httpRequest().post('/api/admin/notification/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ typeKey: 'admin_test_dup', name: 'D', category: 'system', defaultChannels: ['inApp'] });
    assert.equal(a.body.code, 0);
    const b = await app.httpRequest().post('/api/admin/notification/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ typeKey: 'admin_test_dup', name: 'D2', category: 'system', defaultChannels: ['inApp'] });
    assert.equal(b.body.code, 108110);
  });

  it('权限不足 → 403', async () => {
    const r = await app.httpRequest()
      .get('/api/admin/notification/types')
      .set('Authorization', 'Bearer invalid');
    assert.notEqual(r.status, 200);
  });
});
```

### 13.5 测试：`test/notification/controller/admin/notification-template.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-template', () => {
  let token: string;
  before(async () => {
    token = await (app as any).testHelper.adminLoginAs('superadmin');
  });

  it('草稿创建 → preview → publish 全链路', async () => {
    const type = await (app as any).model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
    const create = await app.httpRequest().post('/api/admin/notification/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ typeId: type.id, lang: 'zh-CN', channel: 'inApp',
              titleTpl: '测试 {{x}}', bodyTpl: '正文 {{x}}' });
    assert.equal(create.body.code, 0);
    const id = create.body.data.id;

    const preview = await app.httpRequest().post(`/api/admin/notification/templates/${id}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({ params: { x: 'hello' } });
    assert.equal(preview.body.code, 0);
    assert.equal(preview.body.data.title, '测试 hello');

    const publish = await app.httpRequest().post(`/api/admin/notification/templates/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(publish.body.code, 0);
    assert.equal(publish.body.data.isActive, 1);
  });

  it('修改 active 模板 → 108112', async () => {
    const tpl = await (app as any).model.NotificationTemplate.findOne({ where: { isActive: 1 } });
    const r = await app.httpRequest().put(`/api/admin/notification/templates/${tpl.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ titleTpl: 'new' });
    assert.equal(r.body.code, 108112);
  });
});
```

### 13.6 验证 & Commit

- [ ] 单测全绿
- [ ] 在 admin 端用 superadmin 调用接口能通过
- [ ] commit: `feat(notification): add admin API for types & templates (CRUD/publish/preview/test-send)`

---

## 完成检查

- [ ] Socket.IO 鉴权链路打通
- [ ] 类型与模板 admin API 全部就绪
- [ ] 所有写操作均写入 audit log
- [ ] 错误码：`108101` `108102` `108110` `108111` `108112`

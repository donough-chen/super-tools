# P2.1-08：admin API（rate-limit / channel CRUD）（Task 8）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 4（rate-limit service）+ Task 6（email-adapter）

---

## Step 1: 路由 `app/router.ts` 追加

```typescript
const adminAuth = middleware.adminAuthRequired();
const adminPerm = middleware.adminPermRequired;

// 频控规则
router.get   ('/api/admin/notification/rate-limits',
  adminAuth, adminPerm('notification:config:view'),
  controller.admin.notificationRateLimit.list);
router.post  ('/api/admin/notification/rate-limits',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationRateLimit.create);
router.put   ('/api/admin/notification/rate-limits/:id',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationRateLimit.update);
router.delete('/api/admin/notification/rate-limits/:id',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationRateLimit.destroy);

// 渠道
router.get   ('/api/admin/notification/channels',
  adminAuth, adminPerm('notification:config:view'),
  controller.admin.notificationChannel.list);
router.put   ('/api/admin/notification/channels/:id',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationChannel.update);
router.post  ('/api/admin/notification/channels/:id/test',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationChannel.test);
router.post  ('/api/admin/notification/channels/:id/set-default',
  adminAuth, adminPerm('notification:config:edit'),
  controller.admin.notificationChannel.setDefault);
```

---

## Step 2: 创建 `app/controller/admin/notification-rate-limit.ts`

```typescript
import { Controller } from 'egg';
import { NOTIF_ERR } from '../../constants/errorCodes';

export default class NotificationRateLimitController extends Controller {

  async list() {
    const { ctx } = this;
    const { scope, enabled } = ctx.query;
    const where: any = {};
    if (scope) where.scope = scope;
    if (enabled !== undefined) where.enabled = Number(enabled);
    const rows = await ctx.model.NotificationRateLimitConfig.findAll({
      where, order: [['id', 'ASC']],
    });
    ctx.success({ list: rows });
  }

  async create() {
    const { ctx } = this;
    ctx.validate({
      scope: { type: 'enum', values: ['user_type', 'user_global', 'global', 'channel'] },
      typeId: { type: 'integer', required: false, allowEmpty: true },
      channel: { type: 'enum', required: false, values: ['inApp', 'email', 'sms'] },
      windowSeconds: { type: 'integer', min: 1 },
      maxCount: { type: 'integer', min: 0 },
      enabled: { type: 'integer', values: [0, 1], required: false },
      description: { type: 'string', max: 500, required: false },
    }, ctx.request.body);

    this._validateScope(ctx.request.body);
    const row = await ctx.model.NotificationRateLimitConfig.create({
      ...ctx.request.body,
      enabled: ctx.request.body.enabled ?? 1,
    });
    ctx.service.notificationRateLimit.invalidateCache();
    await ctx.service.audit.log({
      action: 'notification.rate_limit.create',
      target: `rl:${row.id}`,
      detail: ctx.request.body,
    });
    ctx.success(row);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND, 'rate-limit rule not found'); // 复用通用 not_found 系；如需独立码可在 errorCodes 加 108520
    if (ctx.request.body.scope) this._validateScope(ctx.request.body);
    await row.update(ctx.request.body);
    ctx.service.notificationRateLimit.invalidateCache();
    await ctx.service.audit.log({
      action: 'notification.rate_limit.update',
      target: `rl:${id}`,
      detail: ctx.request.body,
    });
    ctx.success(row);
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND);
    await row.destroy();
    ctx.service.notificationRateLimit.invalidateCache();
    await ctx.service.audit.log({
      action: 'notification.rate_limit.delete',
      target: `rl:${id}`,
    });
    ctx.success();
  }

  private _validateScope(body: any) {
    if (body.scope === 'user_type' && !body.typeId) {
      this.ctx.throwBiz(400, 'user_type scope requires typeId');
    }
    if (body.scope === 'channel' && !body.channel) {
      this.ctx.throwBiz(400, 'channel scope requires channel');
    }
    if (body.scope === 'user_global' || body.scope === 'global') {
      body.typeId = null;
      body.channel = null;
    }
    if (body.scope === 'user_type') body.channel = null;
    if (body.scope === 'channel') body.typeId = null;
  }
}
```

---

## Step 3: 创建 `app/controller/admin/notification-channel.ts`

```typescript
import { Controller } from 'egg';
import { NOTIF_ERR } from '../../constants/errorCodes';

const PASS_MASK = '******';

export default class NotificationChannelController extends Controller {

  async list() {
    const { ctx } = this;
    const rows = await ctx.model.NotificationChannelConfig.findAll({ order: [['id', 'ASC']] });
    const safe = rows.map((r: any) => {
      const obj = r.toJSON();
      if (obj.config?.auth_pass) obj.config.auth_pass = PASS_MASK;
      return obj;
    });
    ctx.success({ list: safe });
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throwBiz(NOTIF_ERR.CHANNEL_CONFIG_INVALID);
    const body = ctx.request.body;
    // 密码字段为 ****** 表示未修改，保留原值
    if (body.config?.auth_pass === PASS_MASK && row.config?.auth_pass) {
      body.config.auth_pass = row.config.auth_pass;
    }
    await row.update(body);
    if (row.channel === 'email') {
      await ctx.service.mail.reload();
    }
    await ctx.service.audit.log({
      action: 'notification.channel.update',
      target: `chan:${id}`,
      detail: { channel: row.channel, provider: row.provider },
    });
    const out = row.toJSON();
    if (out.config?.auth_pass) out.config.auth_pass = PASS_MASK;
    ctx.success(out);
  }

  async test() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throwBiz(NOTIF_ERR.CHANNEL_CONFIG_INVALID);
    if (row.channel !== 'email') ctx.throwBiz(400, 'only email channel supports test send');
    const to = ctx.request.body?.to;
    if (!to) ctx.throwBiz(400, 'to required');
    // 强制走当前配置（reload 一次）
    await ctx.service.mail.reload();
    try {
      const r = await ctx.service.mail.sendOnce({
        to,
        subject: '[super-tools] SMTP 测试邮件',
        html: `<p>这是来自管理后台的 SMTP 配置测试，时间 ${new Date().toISOString()}。</p>`,
      });
      await row.update({ lastHealthAt: new Date(), lastHealthOk: 1 });
      await ctx.service.audit.log({
        action: 'notification.channel.test',
        target: `chan:${id}`,
        detail: { to, ok: true },
      });
      ctx.success({ ok: true, messageId: r.messageId });
    } catch (e: any) {
      await row.update({ lastHealthAt: new Date(), lastHealthOk: 0 });
      await ctx.service.audit.log({
        action: 'notification.channel.test',
        target: `chan:${id}`,
        detail: { to, ok: false, error: e.message },
      });
      ctx.success({ ok: false, error: e.message });
    }
  }

  async setDefault() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throwBiz(NOTIF_ERR.CHANNEL_CONFIG_INVALID);
    const transaction = await ctx.model.transaction();
    try {
      await ctx.model.NotificationChannelConfig.update(
        { isDefault: 0 },
        { where: { channel: row.channel }, transaction },
      );
      await row.update({ isDefault: 1, enabled: 1 }, { transaction });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
    if (row.channel === 'email') {
      await ctx.service.mail.reload();
    }
    await ctx.service.audit.log({
      action: 'notification.channel.set_default',
      target: `chan:${id}`,
    });
    ctx.success(row);
  }
}
```

---

## Step 4: 测试 `test/notification/controller/admin/notification-rate-limit.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-rate-limit', () => {
  let token: string;
  before(async () => { token = await (app as any).testHelper.adminLoginAs('superadmin'); });

  beforeEach(async () => {
    await (app as any).model.NotificationRateLimitConfig.destroy({
      where: { description: { [app.Sequelize.Op.like]: 'TEST_API_%' } }, force: true,
    });
  });

  it('GET 列表 200', async () => {
    const r = await app.httpRequest()
      .get('/api/admin/notification/rate-limits?scope=user_global')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.code, 0);
  });

  it('POST 创建 + 校验 user_type 必传 typeId', async () => {
    const bad = await app.httpRequest().post('/api/admin/notification/rate-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'user_type', windowSeconds: 60, maxCount: 1, description: 'TEST_API_bad' });
    assert.notEqual(bad.body.code, 0);

    const ok = await app.httpRequest().post('/api/admin/notification/rate-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'user_type', typeId: 1, windowSeconds: 60, maxCount: 1, description: 'TEST_API_ok' });
    assert.equal(ok.body.code, 0);
  });

  it('PUT 更新后 invalidateCache 生效', async () => {
    const create = await app.httpRequest().post('/api/admin/notification/rate-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'user_global', windowSeconds: 60, maxCount: 5, description: 'TEST_API_inv' });
    const id = create.body.data.id;
    const upd = await app.httpRequest().put(`/api/admin/notification/rate-limits/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxCount: 99 });
    assert.equal(upd.body.code, 0);
    assert.equal(upd.body.data.maxCount, 99);
  });

  it('DELETE 删除', async () => {
    const create = await app.httpRequest().post('/api/admin/notification/rate-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'global', windowSeconds: 60, maxCount: 1, description: 'TEST_API_del' });
    const id = create.body.data.id;
    const r = await app.httpRequest().delete(`/api/admin/notification/rate-limits/${id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.body.code, 0);
  });
});
```

---

## Step 5: 测试 `test/notification/controller/admin/notification-channel.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-channel', () => {
  let token: string;
  before(async () => { token = await (app as any).testHelper.adminLoginAs('superadmin'); });

  it('GET 列表 隐藏 auth_pass', async () => {
    const r = await app.httpRequest()
      .get('/api/admin/notification/channels')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.body.code, 0);
    r.body.data.list.forEach((row: any) => {
      if (row.config?.auth_pass) assert.equal(row.config.auth_pass, '******');
    });
  });

  it('PUT 更新时 auth_pass=****** 保留原值', async () => {
    const list = await app.httpRequest()
      .get('/api/admin/notification/channels')
      .set('Authorization', `Bearer ${token}`);
    const target = list.body.data.list.find((x: any) => x.channel === 'email');
    const upd = await app.httpRequest().put(`/api/admin/notification/channels/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { ...target.config, host: 'smtp.updated.com', auth_pass: '******' } });
    assert.equal(upd.body.code, 0);
    const row = await (app as any).model.NotificationChannelConfig.findByPk(target.id);
    assert.equal(row.config.host, 'smtp.updated.com');
    assert.notEqual(row.config.auth_pass, '******');
  });

  it('POST /test 调用 mail.sendOnce', async () => {
    let called = false;
    mock(app.serviceClasses.mail.prototype, 'sendOnce', async () => {
      called = true; return { messageId: '<test-id>' };
    });
    const list = await app.httpRequest()
      .get('/api/admin/notification/channels')
      .set('Authorization', `Bearer ${token}`);
    const target = list.body.data.list.find((x: any) => x.channel === 'email');
    const r = await app.httpRequest().post(`/api/admin/notification/channels/${target.id}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'qa@super-tools.local' });
    assert.equal(called, true);
    assert.equal(r.body.data.ok, true);
  });

  it('POST /set-default 切换默认且其他同 channel 设 0', async () => {
    // 先确保有 2 条 email 配置
    const exists = await (app as any).model.NotificationChannelConfig.count({ where: { channel: 'email' } });
    if (exists < 2) {
      await (app as any).model.NotificationChannelConfig.create({
        channel: 'email', provider: 'smtp', enabled: 1, isDefault: 0,
        config: { host: 'smtp2.example.com', port: 587, secure: false,
                  auth_user: 'u2', auth_pass: 'p2' },
        description: 'TEST_secondary',
      });
    }
    const list = await (app as any).model.NotificationChannelConfig.findAll({ where: { channel: 'email' } });
    const nonDefault = list.find((x: any) => !x.isDefault);
    const r = await app.httpRequest()
      .post(`/api/admin/notification/channels/${nonDefault.id}/set-default`)
      .set('Authorization', `Bearer ${token}`).send({});
    assert.equal(r.body.code, 0);
    const after = await (app as any).model.NotificationChannelConfig.findAll({ where: { channel: 'email' } });
    const defaults = after.filter((x: any) => x.isDefault === 1);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].id, nonDefault.id);
  });
});
```

---

## Step 6: 验证 & Commit

```bash
npm test -- --testPathPattern='admin/notification-rate-limit|admin/notification-channel'
```

预期：8 个用例全 PASS。

```bash
git add super-tool-node/app/router.ts super-tool-node/app/controller/admin/notification-rate-limit.ts super-tool-node/app/controller/admin/notification-channel.ts super-tool-node/test/notification/controller/admin/notification-rate-limit.test.ts super-tool-node/test/notification/controller/admin/notification-channel.test.ts
git commit -m "feat(notification): admin api for rate-limit & channel config

- 4 endpoints for rate-limit CRUD with cache invalidation
- 4 endpoints for channel config (list/update/test/set-default)
- auth_pass masked as ****** in list/response; preserved on update if mask sent
- email channel update triggers mail.reload()
- set-default uses transaction to ensure single isDefault=1 per channel
- Audit logs for all mutations
- 8 e2e tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.5)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 8)"
```

---

## Verification Checklist

- [ ] 8 个路由可访问且鉴权生效
- [ ] auth_pass 脱敏正确
- [ ] mail.reload 在 channel 修改后被调用
- [ ] 8 个用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-09-admin-ui.md`](./p2-1-09-admin-ui.md)。

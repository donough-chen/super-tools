# P2.3-06：admin API（audiences CRUD + preview）（Task 6）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 5（audience service）

---

## Step 1: 路由 `app/router.ts`

```typescript
const adminAuth = middleware.adminAuthRequired();
const adminPerm = middleware.adminPermRequired;

// 受众分组 CRUD
router.get   ('/api/admin/notification/audiences',
  adminAuth, adminPerm('notification:audience:view'),
  controller.admin.notificationAudience.list);
router.get   ('/api/admin/notification/audiences/:id',
  adminAuth, adminPerm('notification:audience:view'),
  controller.admin.notificationAudience.detail);
router.post  ('/api/admin/notification/audiences',
  adminAuth, adminPerm('notification:audience:edit'),
  controller.admin.notificationAudience.create);
router.put   ('/api/admin/notification/audiences/:id',
  adminAuth, adminPerm('notification:audience:edit'),
  controller.admin.notificationAudience.update);
router.delete('/api/admin/notification/audiences/:id',
  adminAuth, adminPerm('notification:audience:edit'),
  controller.admin.notificationAudience.destroy);

// 预览（不需要先保存）
router.post  ('/api/admin/notification/audiences/preview',
  adminAuth, adminPerm('notification:audience:preview'),
  controller.admin.notificationAudience.preview);

// UI 元数据：字段白名单
router.get   ('/api/admin/notification/audiences/meta/fields',
  adminAuth, adminPerm('notification:audience:view'),
  controller.admin.notificationAudience.metaFields);
```

---

## Step 2: 创建 `app/controller/admin/notification-audience.ts`

```typescript
import { Controller } from 'egg';
import { listFieldsForUI } from '../../lib/audienceFieldWhitelist';
import { NOTIF_ERR } from '../../constants/errorCodes';

export default class NotificationAudienceController extends Controller {

  async list() {
    const { ctx } = this;
    const { keyword, audienceType, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (audienceType) where.audienceType = audienceType;
    if (keyword) where.name = { [ctx.app.Sequelize.Op.like]: `%${keyword}%` };
    const { rows, count } = await ctx.model.NotificationAudience.findAndCountAll({
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
    const aud = await ctx.model.NotificationAudience.findByPk(id);
    if (!aud) ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND);
    ctx.success(aud);
  }

  async create() {
    const { ctx } = this;
    ctx.validate({
      name: { type: 'string', max: 200 },
      description: { type: 'string', max: 500, required: false },
      audienceType: { type: 'enum', values: ['static', 'dynamic'] },
      audienceRule: { type: 'object' },
    }, ctx.request.body);

    // 校验规则：直接试算一次（小代价）
    if (ctx.request.body.audienceType === 'dynamic') {
      try {
        await ctx.service.notificationAudience.previewAudience(ctx.request.body.audienceRule);
      } catch (e: any) {
        if (e.biz) ctx.throwBiz(e.biz.code, e.biz.message);
        throw e;
      }
    }

    const row = await ctx.model.NotificationAudience.create({
      ...ctx.request.body,
      createdBy: ctx.adminUser.id,
    });
    await ctx.service.audit.log({
      action: 'notification.audience.create',
      target: `aud:${row.id}`,
      detail: { name: row.name, type: row.audienceType },
    });
    ctx.success(row);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const aud = await ctx.model.NotificationAudience.findByPk(id);
    if (!aud) ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND);
    if (ctx.request.body.audienceRule && (ctx.request.body.audienceType === 'dynamic' || aud.audienceType === 'dynamic')) {
      try {
        await ctx.service.notificationAudience.previewAudience(ctx.request.body.audienceRule);
      } catch (e: any) {
        if (e.biz) ctx.throwBiz(e.biz.code, e.biz.message);
        throw e;
      }
    }
    await aud.update(ctx.request.body);
    await ctx.service.audit.log({
      action: 'notification.audience.update',
      target: `aud:${id}`,
      detail: ctx.request.body,
    });
    ctx.success(aud);
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const aud = await ctx.model.NotificationAudience.findByPk(id);
    if (!aud) ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND);
    // 检查是否被任务引用
    const inUse = await ctx.model.NotificationTask.count({ where: { audienceId: id } });
    if (inUse > 0) ctx.throwBiz(400, `audience in use by ${inUse} tasks`);
    await aud.destroy();
    await ctx.service.audit.log({ action: 'notification.audience.delete', target: `aud:${id}` });
    ctx.success();
  }

  async preview() {
    const { ctx } = this;
    ctx.validate({
      audienceRule: { type: 'object' },
    }, ctx.request.body);
    const r = await ctx.service.notificationAudience.previewAudience(ctx.request.body.audienceRule);
    // 缓存最近一次预览的 count（如果传了 audienceId）
    if (ctx.request.body.audienceId) {
      const aud = await ctx.model.NotificationAudience.findByPk(ctx.request.body.audienceId);
      if (aud) await aud.update({ lastPreviewCount: r.total, lastPreviewAt: new Date() });
    }
    ctx.success(r);
  }

  async metaFields() {
    const { ctx } = this;
    ctx.success({ list: listFieldsForUI() });
  }
}
```

---

## Step 3: 测试 `test/notification/controller/admin/notification-audience.test.ts`（6 用例）

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('controller/admin/notification-audience', () => {
  let token: string;
  before(async () => { token = await (app as any).testHelper.adminLoginAs('superadmin'); });

  beforeEach(async () => {
    await (app as any).model.NotificationAudience.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_AUD_%' } }, force: true,
    });
  });

  it('GET /audiences/meta/fields 返回 9 字段', async () => {
    const r = await app.httpRequest()
      .get('/api/admin/notification/audiences/meta/fields')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.list.length, 9);
  });

  it('POST /audiences 创建 dynamic 受众，自动 preview 校验', async () => {
    mock(app.serviceClasses.notificationAudience.prototype, 'previewAudience',
      async () => ({ sampleIds: [1, 2], total: 2, timedOut: false }));
    const r = await app.httpRequest().post('/api/admin/notification/audiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_AUD_active',
        audienceType: 'dynamic',
        audienceRule: { operator: 'and', conditions: [
          { field: 'user.status', op: 'eq', value: 1 },
        ]},
      });
    assert.equal(r.body.code, 0);
    assert.ok(r.body.data.id);
  });

  it('POST 创建非法字段 → 108211', async () => {
    const r = await app.httpRequest().post('/api/admin/notification/audiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_AUD_bad',
        audienceType: 'dynamic',
        audienceRule: { operator: 'and', conditions: [
          { field: 'user.password', op: 'eq', value: 'x' },
        ]},
      });
    assert.equal(r.body.code, 108211);
  });

  it('POST /audiences/preview 返回 sampleIds + total', async () => {
    mock(app.serviceClasses.notificationAudience.prototype, 'previewAudience',
      async () => ({ sampleIds: [10, 20, 30], total: 3, timedOut: false }));
    const r = await app.httpRequest().post('/api/admin/notification/audiences/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        audienceRule: { operator: 'and', conditions: [
          { field: 'user.status', op: 'eq', value: 1 },
        ]},
      });
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.total, 3);
    assert.deepEqual(r.body.data.sampleIds, [10, 20, 30]);
  });

  it('DELETE 引用中的受众 → 400', async () => {
    mock(app.serviceClasses.notificationAudience.prototype, 'previewAudience',
      async () => ({ sampleIds: [], total: 0, timedOut: false }));
    const c = await app.httpRequest().post('/api/admin/notification/audiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_AUD_inuse',
        audienceType: 'dynamic',
        audienceRule: { operator: 'and', conditions: [
          { field: 'user.status', op: 'eq', value: 1 },
        ]},
      });
    const id = c.body.data.id;
    // 创建一个引用任务
    await (app as any).model.NotificationTask.create({
      name: 'TEST_AUD_inuse_task', typeId: 1,
      audienceType: 'dynamic', audienceRule: {}, audienceId: id,
      params: {}, channels: ['inApp'], sendType: 'immediate', status: 'completed',
    });
    const del = await app.httpRequest().delete(`/api/admin/notification/audiences/${id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.notEqual(del.body.code, 0);
    // 清理
    await (app as any).model.NotificationTask.destroy({ where: { name: 'TEST_AUD_inuse_task' }, force: true });
    await (app as any).model.NotificationAudience.destroy({ where: { id }, force: true });
  });

  it('PUT 更新受众规则', async () => {
    mock(app.serviceClasses.notificationAudience.prototype, 'previewAudience',
      async () => ({ sampleIds: [], total: 0, timedOut: false }));
    const c = await app.httpRequest().post('/api/admin/notification/audiences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'TEST_AUD_upd',
        audienceType: 'dynamic',
        audienceRule: { operator: 'and', conditions: [
          { field: 'user.status', op: 'eq', value: 1 },
        ]},
      });
    const id = c.body.data.id;
    const r = await app.httpRequest().put(`/api/admin/notification/audiences/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'TEST_AUD_upd_renamed' });
    assert.equal(r.body.code, 0);
    assert.equal(r.body.data.name, 'TEST_AUD_upd_renamed');
  });
});
```

---

## Step 4: 验证 & Commit

```bash
npm test -- --testPathPattern='admin/notification-audience'
```

预期：6/6 PASS。

```bash
git add super-tool-node/app/router.ts super-tool-node/app/controller/admin/notification-audience.ts super-tool-node/test/notification/controller/admin/notification-audience.test.ts
git commit -m "feat(notification): admin api for audience groups (CRUD + preview + meta)

- 5 CRUD endpoints + preview + meta/fields
- Auto-validates rule on create/update by running preview once
- Delete blocked when tasks reference the audience
- 6 e2e tests (incl. invalid field 108211, in-use blocked)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §5.3 §8)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 6)"
```

---

## Verification Checklist

- [ ] 7 个路由可访问且鉴权生效
- [ ] auth_pass 不涉及（受众无敏感字段）
- [ ] 6 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-3-07-admin-rule-builder.md`](./p2-3-07-admin-rule-builder.md)。

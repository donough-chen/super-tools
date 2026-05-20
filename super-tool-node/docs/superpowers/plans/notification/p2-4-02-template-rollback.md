# P2.4-02：模板版本回滚 service + API（Task 2）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 1（errcodes 已添加）

---

## Step 1: 测试 `test/notification/service/notification-template-rollback.test.ts`（4 用例）

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification-template - rollbackToVersion', () => {
  let ctx: any;
  let typeId: number;

  beforeEach(async () => {
    ctx = app.mockContext();
    // 准备：1 个测试 type + 1 个 active 模板 v1 + 1 个草稿 v2 已发布过（即 v2 是 active）
    await ctx.model.NotificationType.destroy({ where: { typeKey: 'tpl_rollback_test' }, force: true });
    const t = await ctx.model.NotificationType.create({
      typeKey: 'tpl_rollback_test', name: 'rollback test', category: 'system',
      defaultChannels: ['inApp'], priority: 'normal', enabled: 1,
    });
    typeId = t.id;
    // v1
    const v1 = await ctx.model.NotificationTemplate.create({
      typeId, lang: 'zh-CN', channel: 'inApp',
      titleTpl: 'V1 title', bodyTpl: 'V1 body', version: 1, isActive: 0,
    });
    await ctx.model.NotificationTemplateVersion.create({
      templateId: v1.id, version: 1,
      titleTpl: 'V1 title', bodyTpl: 'V1 body', publishedBy: 1,
    });
    // v2 active
    const v2 = await ctx.model.NotificationTemplate.create({
      typeId, lang: 'zh-CN', channel: 'inApp',
      titleTpl: 'V2 title', bodyTpl: 'V2 body', version: 2, isActive: 1,
    });
    await ctx.model.NotificationTemplateVersion.create({
      templateId: v2.id, version: 2,
      titleTpl: 'V2 title', bodyTpl: 'V2 body', publishedBy: 1,
    });
  });

  it('rollbackToVersion v1 → 创建 v3（内容拷贝自 v1） + active 切到 v3', async () => {
    // 拿到 v1 的快照行
    const v1tpl = await ctx.model.NotificationTemplate.findOne({
      where: { typeId, version: 1 },
    });
    const newTpl = await ctx.service.notificationTemplate.rollbackToVersion({
      typeId, lang: 'zh-CN', channel: 'inApp',
      targetVersion: 1, operatorId: 1,
    });
    assert.equal(newTpl.version, 3);
    assert.equal(newTpl.isActive, 1);
    assert.equal(newTpl.titleTpl, 'V1 title');
    assert.equal(newTpl.bodyTpl, 'V1 body');
    // 旧 active 应改为 0
    const v2 = await ctx.model.NotificationTemplate.findOne({ where: { typeId, version: 2 } });
    assert.equal(v2.isActive, 0);
  });

  it('回滚到不存在的 version → 抛 108120', async () => {
    await assert.rejects(
      ctx.service.notificationTemplate.rollbackToVersion({
        typeId, lang: 'zh-CN', channel: 'inApp',
        targetVersion: 999, operatorId: 1,
      }),
      /108120/,
    );
  });

  it('回滚到当前 active 版本 → 抛 108121', async () => {
    await assert.rejects(
      ctx.service.notificationTemplate.rollbackToVersion({
        typeId, lang: 'zh-CN', channel: 'inApp',
        targetVersion: 2, operatorId: 1,
      }),
      /108121/,
    );
  });

  it('rollback 写新版本快照到 notification_template_versions', async () => {
    await ctx.service.notificationTemplate.rollbackToVersion({
      typeId, lang: 'zh-CN', channel: 'inApp',
      targetVersion: 1, operatorId: 1,
    });
    const v3tpl = await ctx.model.NotificationTemplate.findOne({
      where: { typeId, version: 3 },
    });
    const snap = await ctx.model.NotificationTemplateVersion.findOne({
      where: { templateId: v3tpl.id, version: 3 },
    });
    assert.ok(snap);
    assert.equal(snap.titleTpl, 'V1 title');
  });
});
```

---

## Step 2: 修改 `app/service/notification-template.ts`，新增 `rollbackToVersion`

在 P1 已有 `createDraft / publishVersion` 之后追加：

```typescript
async rollbackToVersion(input: {
  typeId: number;
  lang: string;
  channel: 'inApp' | 'email' | 'sms';
  targetVersion: number;
  operatorId: number;
}) {
  const { ctx } = this;

  // 1. 找到目标版本的模板行
  const target = await ctx.model.NotificationTemplate.findOne({
    where: { typeId: input.typeId, lang: input.lang, channel: input.channel, version: input.targetVersion },
  });
  if (!target) ctx.throwBiz(NOTIF_ERR.TEMPLATE_VERSION_NOT_FOUND);

  // 2. 检查是否就是当前 active
  const current = await ctx.model.NotificationTemplate.findOne({
    where: { typeId: input.typeId, lang: input.lang, channel: input.channel, isActive: 1 },
  });
  if (current && current.version === input.targetVersion) {
    ctx.throwBiz(NOTIF_ERR.TEMPLATE_ROLLBACK_SAME_VERSION);
  }

  // 3. 找最大 version + 1
  const last = await ctx.model.NotificationTemplate.findOne({
    where: { typeId: input.typeId, lang: input.lang, channel: input.channel },
    order: [['version', 'DESC']],
  });
  const newVersion = (last?.version ?? 0) + 1;

  // 4. 事务：创建新草稿（拷贝 target 内容） → 切 active
  const transaction = await ctx.model.transaction();
  try {
    const newTpl = await ctx.model.NotificationTemplate.create({
      typeId: input.typeId,
      lang: input.lang,
      channel: input.channel,
      titleTpl: target.titleTpl,
      bodyTpl: target.bodyTpl,
      version: newVersion,
      isActive: 0,
      createdBy: input.operatorId,
      updatedBy: input.operatorId,
    }, { transaction });

    // 旧 active 写历史快照（如不同于 target）
    if (current && current.id !== target.id) {
      await ctx.model.NotificationTemplateVersion.create({
        templateId: current.id,
        version: current.version,
        titleTpl: current.titleTpl,
        bodyTpl: current.bodyTpl,
        publishedBy: input.operatorId,
      }, { transaction });
      await current.update({ isActive: 0 }, { transaction });
    }

    // 新版置 active
    await newTpl.update({ isActive: 1 }, { transaction });

    // 写新版本快照
    await ctx.model.NotificationTemplateVersion.create({
      templateId: newTpl.id,
      version: newTpl.version,
      titleTpl: newTpl.titleTpl,
      bodyTpl: newTpl.bodyTpl,
      publishedBy: input.operatorId,
    }, { transaction });

    await transaction.commit();
    return newTpl.reload();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}
```

---

## Step 3: 路由 `app/router.ts` 追加

```typescript
router.get('/api/admin/notification/templates/:id/versions',
  adminAuth, adminPerm('notification:template:view'),
  controller.admin.notificationTemplate.listVersions);

router.post('/api/admin/notification/templates/:typeId/rollback',
  adminAuth, adminPerm('notification:template:publish'),
  controller.admin.notificationTemplate.rollback);
```

---

## Step 4: 修改 `app/controller/admin/notification-template.ts` 追加 2 方法

```typescript
async listVersions() {
  const { ctx } = this;
  const id = Number(ctx.params.id); // template id（任一版本的 id）
  const tpl = await ctx.model.NotificationTemplate.findByPk(id);
  if (!tpl) ctx.throwBiz(NOTIF_ERR.TEMPLATE_NOT_FOUND);

  // 列出同 type+lang+channel 全部版本
  const allTpls = await ctx.model.NotificationTemplate.findAll({
    where: { typeId: tpl.typeId, lang: tpl.lang, channel: tpl.channel },
    order: [['version', 'DESC']],
  });
  const allVersions = await ctx.model.NotificationTemplateVersion.findAll({
    where: { templateId: { [ctx.app.Sequelize.Op.in]: allTpls.map((t: any) => t.id) } },
    order: [['publishedAt', 'DESC']],
  });
  ctx.success({
    typeId: tpl.typeId, lang: tpl.lang, channel: tpl.channel,
    versions: allTpls.map((t: any) => ({
      templateId: t.id,
      version: t.version,
      isActive: t.isActive,
      titleTpl: t.titleTpl,
      bodyTpl: t.bodyTpl,
      updatedAt: t.updatedAt,
    })),
    snapshots: allVersions,
  });
}

async rollback() {
  const { ctx } = this;
  ctx.validate({
    lang: { type: 'string' },
    channel: { type: 'enum', values: ['inApp', 'email', 'sms'] },
    targetVersion: { type: 'integer', min: 1 },
  }, ctx.request.body);
  const typeId = Number(ctx.params.typeId);
  const r = await ctx.service.notificationTemplate.rollbackToVersion({
    typeId,
    lang: ctx.request.body.lang,
    channel: ctx.request.body.channel,
    targetVersion: ctx.request.body.targetVersion,
    operatorId: ctx.adminUser.id,
  });
  await ctx.service.audit.log({
    action: 'notification.template.rollback',
    target: `type:${typeId}/${ctx.request.body.lang}/${ctx.request.body.channel}`,
    detail: { targetVersion: ctx.request.body.targetVersion, newVersion: r.version },
  });
  ctx.success(r);
}
```

---

## Step 5: 验证 & Commit

```bash
npm test -- --testPathPattern=notification-template-rollback
```

预期：4/4 PASS。

```bash
git add super-tool-node/app/service/notification-template.ts super-tool-node/app/controller/admin/notification-template.ts super-tool-node/app/router.ts super-tool-node/test/notification/service/notification-template-rollback.test.ts
git commit -m "feat(notification): template version rollback (service + admin api)

- rollbackToVersion: clone target snapshot as new version, set active, write history
- 2 errcodes: 108120 VERSION_NOT_FOUND, 108121 SAME_VERSION
- 2 endpoints: GET .../templates/:id/versions, POST .../templates/:typeId/rollback
- Audit log on every rollback
- 4 unit tests (success / not found / same version / snapshot written)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §10.2)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 2)"
```

---

## Verification Checklist

- [ ] service 含 `rollbackToVersion` 方法
- [ ] 2 个新路由就绪
- [ ] 4 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-4-06-admin-version-ui.md`](./p2-4-06-admin-version-ui.md)（UI）。

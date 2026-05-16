# P1-06：Service 层（template / preference / audience）

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T6 / T7 / T8**
> 前置：`p1-05-models.md`（Models 必须已完成）；T6 还依赖 `p1-03-renderer.md`

---

## Task 6：notification-template service + 测试

**目标**：把 P1-03 的纯函数 `templateRenderer` 包装为业务 service，提供"按 typeKey + lang 取活动模板 + 渲染 + 落库前合规检查"的完整能力。

### 6.1 测试先行：`test/notification/service/notification-template.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification-template.ts', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext();
    // 准备：插入一条 type + active template
    await ctx.model.NotificationType.destroy({ where: { typeKey: 'test_tpl_svc' }, force: true });
    const type = await ctx.model.NotificationType.create({
      typeKey: 'test_tpl_svc',
      name: '模板服务测试',
      category: 'system',
      defaultChannels: ['inApp'],
      priority: 'normal',
      enabled: 1,
    });
    await ctx.model.NotificationTemplate.destroy({ where: { typeId: type.id }, force: true });
    await ctx.model.NotificationTemplate.create({
      typeId: type.id,
      lang: 'zh-CN',
      channel: 'inApp',
      titleTpl: '你好 {{name}}',
      bodyTpl: '欢迎使用 {{product}}',
      version: 1,
      isActive: 1,
    });
  });

  it('renderByType 返回渲染后的 title / body', async () => {
    const result = await ctx.service.notificationTemplate.renderByType({
      typeKey: 'test_tpl_svc',
      channel: 'inApp',
      lang: 'zh-CN',
      params: { name: '小明', product: 'super-tools' },
    });
    assert.equal(result.title, '你好 小明');
    assert.equal(result.body, '欢迎使用 super-tools');
    assert.equal(result.templateId > 0, true);
    assert.equal(result.templateVersion, 1);
  });

  it('typeKey 不存在抛 NOTIF_TYPE_NOT_FOUND', async () => {
    await assert.rejects(
      ctx.service.notificationTemplate.renderByType({
        typeKey: 'nonexistent_xxx',
        channel: 'inApp',
        lang: 'zh-CN',
        params: {},
      }),
      /108101/,
    );
  });

  it('找不到 active 模板时回退 zh-CN', async () => {
    const result = await ctx.service.notificationTemplate.renderByType({
      typeKey: 'test_tpl_svc',
      channel: 'inApp',
      lang: 'en-US', // 不存在 en-US，应回退 zh-CN
      params: { name: 'Tom', product: 'st' },
    });
    assert.equal(result.title, '你好 Tom');
  });

  it('既无目标 lang 也无 zh-CN 抛 NOTIF_TEMPLATE_NOT_FOUND', async () => {
    await ctx.model.NotificationTemplate.destroy({
      where: { lang: 'zh-CN' },
      force: true,
    });
    await assert.rejects(
      ctx.service.notificationTemplate.renderByType({
        typeKey: 'test_tpl_svc',
        channel: 'inApp',
        lang: 'en-US',
        params: {},
      }),
      /108102/,
    );
  });

  it('createDraft 创建草稿不影响 active', async () => {
    const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'test_tpl_svc' } });
    const draft = await ctx.service.notificationTemplate.createDraft({
      typeId: type.id,
      lang: 'zh-CN',
      channel: 'inApp',
      titleTpl: '草稿 {{name}}',
      bodyTpl: '草稿正文',
      operatorId: 1,
    });
    assert.equal(draft.version, 2);
    assert.equal(draft.isActive, 0);
    const active = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: type.id, lang: 'zh-CN', channel: 'inApp', isActive: 1 },
    });
    assert.equal(active.version, 1); // 仍是 v1
  });

  it('publishVersion 切换 active 并写历史快照', async () => {
    const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'test_tpl_svc' } });
    const draft = await ctx.service.notificationTemplate.createDraft({
      typeId: type.id, lang: 'zh-CN', channel: 'inApp',
      titleTpl: 'v2 {{name}}', bodyTpl: 'v2 body', operatorId: 1,
    });
    await ctx.service.notificationTemplate.publishVersion({ templateId: draft.id, operatorId: 1 });
    const newActive = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: type.id, lang: 'zh-CN', channel: 'inApp', isActive: 1 },
    });
    assert.equal(newActive.id, draft.id);
    const versions = await ctx.model.NotificationTemplateVersion.findAll({ where: { templateId: draft.id } });
    assert.equal(versions.length >= 1, true);
  });
});
```

### 6.2 实现：`app/service/notification-template.ts`

```typescript
import { Service } from 'egg';
import { renderTemplate } from '../lib/templateRenderer';
import { NOTIF_ERR } from '../constants/errorCodes';

export interface RenderByTypeInput {
  typeKey: string;
  channel: 'inApp' | 'email' | 'sms';
  lang: string;
  params: Record<string, any>;
}

export interface RenderByTypeOutput {
  title: string;
  body: string;
  templateId: number;
  templateVersion: number;
}

export default class NotificationTemplateService extends Service {

  async renderByType(input: RenderByTypeInput): Promise<RenderByTypeOutput> {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findOne({
      where: { typeKey: input.typeKey, enabled: 1 },
    });
    if (!type) ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND, `type ${input.typeKey} not found`);

    let template = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: type.id, lang: input.lang, channel: input.channel, isActive: 1 },
    });
    if (!template && input.lang !== 'zh-CN') {
      template = await ctx.model.NotificationTemplate.findOne({
        where: { typeId: type.id, lang: 'zh-CN', channel: input.channel, isActive: 1 },
      });
    }
    if (!template) ctx.throwBiz(NOTIF_ERR.TEMPLATE_NOT_FOUND, `no active template for ${input.typeKey}/${input.channel}/${input.lang}`);

    const { title, body } = renderTemplate(
      { titleTpl: template.titleTpl, bodyTpl: template.bodyTpl, channel: input.channel },
      input.params,
    );
    return { title, body, templateId: template.id, templateVersion: template.version };
  }

  async createDraft(input: {
    typeId: number;
    lang: string;
    channel: 'inApp' | 'email' | 'sms';
    titleTpl: string;
    bodyTpl: string;
    operatorId: number;
  }) {
    const { ctx } = this;
    const last = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: input.typeId, lang: input.lang, channel: input.channel },
      order: [['version', 'DESC']],
    });
    const version = (last?.version ?? 0) + 1;
    return ctx.model.NotificationTemplate.create({
      typeId: input.typeId, lang: input.lang, channel: input.channel,
      titleTpl: input.titleTpl, bodyTpl: input.bodyTpl,
      version, isActive: 0, createdBy: input.operatorId, updatedBy: input.operatorId,
    });
  }

  async publishVersion(input: { templateId: number; operatorId: number }) {
    const { ctx } = this;
    const tpl = await ctx.model.NotificationTemplate.findByPk(input.templateId);
    if (!tpl) ctx.throwBiz(NOTIF_ERR.TEMPLATE_NOT_FOUND);
    const transaction = await ctx.model.transaction();
    try {
      // 1. 旧 active 写入版本快照表
      const oldActive = await ctx.model.NotificationTemplate.findOne({
        where: { typeId: tpl.typeId, lang: tpl.lang, channel: tpl.channel, isActive: 1 },
        transaction,
      });
      if (oldActive && oldActive.id !== tpl.id) {
        await ctx.model.NotificationTemplateVersion.create({
          templateId: oldActive.id,
          version: oldActive.version,
          titleTpl: oldActive.titleTpl,
          bodyTpl: oldActive.bodyTpl,
          publishedBy: input.operatorId,
        }, { transaction });
        await oldActive.update({ isActive: 0 }, { transaction });
      }
      // 2. 新版本置 active
      await tpl.update({ isActive: 1, updatedBy: input.operatorId }, { transaction });
      // 3. 写当前快照
      await ctx.model.NotificationTemplateVersion.create({
        templateId: tpl.id,
        version: tpl.version,
        titleTpl: tpl.titleTpl,
        bodyTpl: tpl.bodyTpl,
        publishedBy: input.operatorId,
      }, { transaction });
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
    return tpl.reload();
  }
}
```

### 6.3 验证

- [ ] `npm test -- --testPathPattern=notification-template` 全绿（6 用例）
- [ ] 在 `ctx.service.notificationTemplate` 上能看到 3 个方法

### 6.4 Commit

```
feat(notification): add notification-template service with render/draft/publish

- renderByType with lang fallback to zh-CN
- createDraft auto-bump version
- publishVersion with snapshot to template_version table

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.4)
```

---

## Task 7：notification-preference service + 测试

**目标**：用户级偏好的读、写、合并默认值。P1 仅实现读写，不解析静默时段（P2 做）。

### 7.1 测试：`test/notification/service/notification-preference.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification-preference.ts', () => {
  let ctx: any;
  const userId = 9001;
  beforeEach(async () => {
    ctx = app.mockContext();
    await ctx.model.NotificationUserPreference.destroy({ where: { userId }, force: true });
  });

  it('未设置偏好 → 返回默认（按 type defaultChannels）', async () => {
    const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
    if (!type) return; // 预置数据需先就绪
    const pref = await ctx.service.notificationPreference.getEffective({
      userId, typeId: type.id,
    });
    assert.deepEqual(pref.channels, type.defaultChannels);
    assert.equal(pref.enabled, 1);
  });

  it('设置 disabled 后 enabled=0', async () => {
    const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
    if (!type) return;
    await ctx.service.notificationPreference.upsert({
      userId, typeId: type.id, channels: ['inApp'], enabled: 0,
    });
    const pref = await ctx.service.notificationPreference.getEffective({ userId, typeId: type.id });
    assert.equal(pref.enabled, 0);
  });

  it('listForUser 返回所有 type 合并后的偏好', async () => {
    const list = await ctx.service.notificationPreference.listForUser({ userId });
    assert.equal(Array.isArray(list), true);
    assert.equal(list.length >= 1, true);
    list.forEach((row: any) => {
      assert.ok(row.typeKey);
      assert.ok(Array.isArray(row.channels));
    });
  });
});
```

### 7.2 实现：`app/service/notification-preference.ts`

```typescript
import { Service } from 'egg';

export default class NotificationPreferenceService extends Service {

  async getEffective(input: { userId: number; typeId: number }) {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findByPk(input.typeId);
    if (!type) return { channels: [], enabled: 0 };
    const pref = await ctx.model.NotificationUserPreference.findOne({
      where: { userId: input.userId, typeId: input.typeId },
    });
    return {
      channels: pref?.channels ?? type.defaultChannels,
      enabled: pref ? pref.enabled : 1,
    };
  }

  async upsert(input: {
    userId: number;
    typeId: number;
    channels: string[];
    enabled: 0 | 1;
  }) {
    const { ctx } = this;
    const [row] = await ctx.model.NotificationUserPreference.upsert({
      userId: input.userId,
      typeId: input.typeId,
      channels: input.channels,
      enabled: input.enabled,
    });
    return row;
  }

  async listForUser(input: { userId: number }) {
    const { ctx } = this;
    const types = await ctx.model.NotificationType.findAll({ where: { enabled: 1 } });
    const prefs = await ctx.model.NotificationUserPreference.findAll({
      where: { userId: input.userId },
    });
    const prefMap = new Map(prefs.map((p: any) => [p.typeId, p]));
    return types.map((t: any) => {
      const p = prefMap.get(t.id) as any;
      return {
        typeId: t.id,
        typeKey: t.typeKey,
        typeName: t.name,
        channels: p?.channels ?? t.defaultChannels,
        enabled: p ? p.enabled : 1,
      };
    });
  }
}
```

### 7.3 验证 & Commit

- [ ] 单测全绿
- [ ] commit message: `feat(notification): add notification-preference service`

---

## Task 8：notification-audience service（仅 all/static）+ 测试

**目标**：把"任务受众规则 → userId 列表"封装为 service。P1 仅支持 `all` 和 `static`，不实现 dynamic 解析（P2 做）。

### 8.1 测试：`test/notification/service/notification-audience.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification-audience.ts', () => {
  let ctx: any;
  beforeEach(() => { ctx = app.mockContext(); });

  it('resolveAll 返回所有 isActive=1 用户', async () => {
    const ids = await ctx.service.notificationAudience.resolveAll();
    assert.equal(Array.isArray(ids), true);
    ids.forEach((x: any) => assert.equal(typeof x, 'number'));
  });

  it('resolveStatic 直接返回入参 userIds', async () => {
    const ids = await ctx.service.notificationAudience.resolveStatic([1, 2, 3]);
    assert.deepEqual(ids, [1, 2, 3]);
  });

  it('resolve dispatch by audienceType', async () => {
    const ids = await ctx.service.notificationAudience.resolve({
      audienceType: 'static',
      audienceRule: { userIds: [10, 20] },
    });
    assert.deepEqual(ids, [10, 20]);
  });

  it('audienceType=dynamic 在 P1 抛 NotImplemented', async () => {
    await assert.rejects(
      ctx.service.notificationAudience.resolve({
        audienceType: 'dynamic',
        audienceRule: { conditions: [] },
      }),
      /108201/,
    );
  });
});
```

### 8.2 实现：`app/service/notification-audience.ts`

```typescript
import { Service } from 'egg';
import { NOTIF_ERR } from '../constants/errorCodes';

export default class NotificationAudienceService extends Service {

  async resolveAll(): Promise<number[]> {
    const rows = await this.ctx.model.User.findAll({
      where: { status: 1 },
      attributes: ['id'],
    });
    return rows.map((r: any) => r.id);
  }

  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds;
  }

  async resolve(input: {
    audienceType: 'all' | 'static' | 'dynamic';
    audienceRule: any;
  }): Promise<number[]> {
    switch (input.audienceType) {
      case 'all':
        return this.resolveAll();
      case 'static':
        return this.resolveStatic(input.audienceRule?.userIds ?? []);
      case 'dynamic':
        this.ctx.throwBiz(NOTIF_ERR.AUDIENCE_DYNAMIC_NOT_IMPL, 'dynamic audience is P2');
        return [];
      default:
        this.ctx.throwBiz(NOTIF_ERR.AUDIENCE_TYPE_INVALID);
        return [];
    }
  }
}
```

### 8.3 验证 & Commit

- [ ] 单测全绿
- [ ] commit: `feat(notification): add notification-audience service (all/static only, dynamic deferred to P2)`

---

## 完成检查

- [ ] 三个 service 文件存在
- [ ] `ctx.service.notificationTemplate` / `notificationPreference` / `notificationAudience` 可访问
- [ ] 全部单测通过（≥ 13 用例）
- [ ] 无 lint 错误

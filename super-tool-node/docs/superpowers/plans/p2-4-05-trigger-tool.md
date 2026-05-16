# P2.4-05：触发点 - 工具上线 / 下架（Task 5）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 1（type seed）+ P2.3（动态受众已就绪，本任务用 `favorite.tool_id` 字段）

---

## Step 1: 修改 `app/service/tool.ts`，触发上线

> 假设 P1 已有 `publishTool(toolId)` 方法。在状态切换为 published 后追加：

```typescript
// === P2.4 触发点：工具上线 → 通知所有收藏者 ===
try {
  // 用 sendByAudience + dynamic 受众：favorite.tool_id eq toolId
  const r = await this.ctx.service.notification.sendByAudience({
    typeKey: 'tool_published',
    audienceType: 'dynamic',
    audienceRule: {
      operator: 'and',
      conditions: [
        { field: 'favorite.tool_id', op: 'eq', value: toolId },
      ],
    },
    params: {
      toolName: tool.name,
      toolUrl: this._buildToolUrl(tool),
    },
    channels: ['inApp'],
  });
  this.ctx.logger.info(`[tool.published] tool=${toolId} notified ${r.totalUsers} favorites`);
} catch (e: any) {
  this.ctx.logger.warn(`[tool.published] notify failed: ${e.message}`);
}
```

`_buildToolUrl` 辅助：

```typescript
private _buildToolUrl(tool: any): string {
  const base = this.ctx.app.config.notification.frontend?.h5BaseUrl || '';
  return `${base}/tools/${tool.code || tool.id}`;
}
```

---

## Step 2: 同文件，触发下架

> 在状态切换为 unpublished/archived 后追加：

```typescript
// === P2.4 触发点：工具下架 → 通知收藏者 ===
try {
  const altUrl = await this._findAlternativeToolUrl(tool); // 同分类其他工具，找不到返回主页
  await this.ctx.service.notification.sendByAudience({
    typeKey: 'tool_unpublished',
    audienceType: 'dynamic',
    audienceRule: {
      operator: 'and',
      conditions: [
        { field: 'favorite.tool_id', op: 'eq', value: toolId },
      ],
    },
    params: {
      toolName: tool.name,
      reason: reason || '业务调整',
      alternativeUrl: altUrl,
    },
    channels: ['inApp'],
  });
} catch (e: any) {
  this.ctx.logger.warn(`[tool.unpublished] notify failed: ${e.message}`);
}
```

`_findAlternativeToolUrl` 辅助（简版）：

```typescript
private async _findAlternativeToolUrl(tool: any): Promise<string> {
  const base = this.ctx.app.config.notification.frontend?.h5BaseUrl || '';
  if (!tool.categoryId) return `${base}/tools`;
  const alt = await this.ctx.model.Tool.findOne({
    where: {
      categoryId: tool.categoryId,
      status: 1,
      id: { [this.ctx.app.Sequelize.Op.ne]: tool.id },
    },
  });
  return alt ? `${base}/tools/${alt.code || alt.id}` : `${base}/tools`;
}
```

---

## Step 3: 测试 `test/notification/trigger/tool-published.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/tool.published → notification.sendByAudience', () => {
  it('上线时调 sendByAudience 且受众规则含 favorite.tool_id', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'sendByAudience', async (input: any) => {
      captured = input;
      return { totalUsers: 5, totalMessages: 5 };
    });
    const tool = await ctx.model.Tool.create({
      code: 'gold-price', name: '黄金价格', status: 0, // 0=draft
    });
    await ctx.service.tool.publishTool(tool.id);
    assert.ok(captured);
    assert.equal(captured.typeKey, 'tool_published');
    assert.equal(captured.audienceType, 'dynamic');
    const cond = captured.audienceRule.conditions[0];
    assert.equal(cond.field, 'favorite.tool_id');
    assert.equal(cond.op, 'eq');
    assert.equal(cond.value, tool.id);
    assert.equal(captured.params.toolName, '黄金价格');
    assert.ok(captured.params.toolUrl.includes('gold-price'));
  });

  it('notify 失败不影响业务（工具状态仍切到 published）', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    mock(app.serviceClasses.notification.prototype, 'sendByAudience', async () => {
      throw new Error('notify down');
    });
    const tool = await ctx.model.Tool.create({
      code: 'tool-x', name: 'tx', status: 0,
    });
    await ctx.service.tool.publishTool(tool.id);
    await tool.reload();
    assert.equal(tool.status, 1); // 假设 1=published
  });
});
```

---

## Step 4: 测试 `test/notification/trigger/tool-unpublished.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/tool.unpublished → notification.sendByAudience', () => {
  it('下架时调 sendByAudience 且 params 含 reason / alternativeUrl', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'sendByAudience', async (input: any) => {
      captured = input;
      return { totalUsers: 3, totalMessages: 3 };
    });
    const tool = await ctx.model.Tool.create({
      code: 'tool-down', name: '即将下架', status: 1,
    });
    await ctx.service.tool.unpublishTool(tool.id, '版权方要求');
    assert.equal(captured.typeKey, 'tool_unpublished');
    assert.equal(captured.params.reason, '版权方要求');
    assert.ok(captured.params.alternativeUrl);
  });

  it('找不到同类工具时 alternativeUrl 为 /tools', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'sendByAudience', async (input: any) => {
      captured = input;
      return { totalUsers: 0, totalMessages: 0 };
    });
    const tool = await ctx.model.Tool.create({
      code: 'tool-only', name: '唯一', status: 1, categoryId: 999999,
    });
    await ctx.service.tool.unpublishTool(tool.id, '');
    assert.ok(captured.params.alternativeUrl.endsWith('/tools'));
  });
});
```

---

## Step 5: 验证 & Commit

```bash
npm test -- --testPathPattern='trigger/tool-(published|unpublished)'
```

预期：4/4 PASS。

```bash
git add super-tool-node/app/service/tool.ts super-tool-node/test/notification/trigger/tool-published.test.ts super-tool-node/test/notification/trigger/tool-unpublished.test.ts
git commit -m "feat(notification): hook tool.publish/unpublish to sendByAudience (favorite.tool_id)

- publishTool → sendByAudience with audienceRule field=favorite.tool_id eq toolId
- unpublishTool → same + reason + alternativeUrl (same category fallback to /tools)
- Reuses P2.3 dynamic audience compiler (no new code)
- 4 tests covering happy paths and failure isolation

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11.2.5)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 5)"
```

---

## Verification Checklist

- [ ] `tool.ts` 含 publish/unpublish 触发代码
- [ ] 4 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-4-06-admin-version-ui.md`](./p2-4-06-admin-version-ui.md)（如未做）。

# P2.3-05：notification-audience service 改造（Task 5）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 4（compiler）

---

## Step 1: 修改 `app/service/notification-audience.ts`

替换 P1 的 `dynamic` 抛错分支为真实解析；新增 `previewAudience(rule)` 与 `resolveAudienceById(id)` 两个方法。

```typescript
import { Service } from 'egg';
import { compileAudienceRule, Group } from '../lib/audienceRuleCompiler';
import { NOTIF_ERR } from '../constants/errorCodes';

const PREVIEW_LIMIT = 100;
const PREVIEW_TIMEOUT_MS = 5000;

export default class NotificationAudienceService extends Service {

  // ============ P1 已有 ============

  async resolveAll(): Promise<number[]> {
    const rows = await this.ctx.model.User.findAll({
      where: { status: 1 }, attributes: ['id'],
    });
    return rows.map((r: any) => r.id);
  }

  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds;
  }

  // ============ P2.3 新增/改造 ============

  async resolve(input: {
    audienceType: 'all' | 'static' | 'dynamic';
    audienceRule: any;
  }): Promise<number[]> {
    switch (input.audienceType) {
      case 'all':     return this.resolveAll();
      case 'static':  return this.resolveStatic(input.audienceRule?.userIds ?? []);
      case 'dynamic': return this.resolveDynamic(input.audienceRule as Group);
      default:        this.ctx.throwBiz(NOTIF_ERR.AUDIENCE_TYPE_INVALID); return [];
    }
  }

  /** P2.3 真实实现：编译规则为 SQL，执行返回 user.id 列表 */
  async resolveDynamic(rule: Group, opts?: { limit?: number; offset?: number }): Promise<number[]> {
    const compiled = compileAudienceRule(rule);
    const sql = compiled.buildFullSql({
      select: 'u.id',
      limit: opts?.limit,
      offset: opts?.offset,
    });
    const rows = await this._safeQuery(sql, compiled.params);
    return rows.map((r: any) => Number(r.id));
  }

  /** 试算：返回前 N 个用户 ID 与总数 */
  async previewAudience(rule: Group): Promise<{
    sampleIds: number[];
    total: number;
    timedOut: boolean;
  }> {
    const compiled = compileAudienceRule(rule);

    // 1. 取前 100 样本
    const sampleSql = compiled.buildFullSql({ select: 'u.id', limit: PREVIEW_LIMIT });
    const samples = await this._safeQuery(sampleSql, compiled.params);

    // 2. 总数 COUNT(*) —— 复用同一 WHERE / JOIN
    const countSql = compiled.buildFullSql({ select: 'COUNT(*) AS cnt' })
      .replace(/SELECT COUNT\(\*\) AS cnt/, 'SELECT COUNT(*) AS cnt'); // 保持
    let total = 0; let timedOut = false;
    try {
      const countRows = await this._safeQuery(countSql, compiled.params);
      total = Number(countRows[0]?.cnt ?? 0);
    } catch (e: any) {
      if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message)) {
        timedOut = true;
      } else {
        throw e;
      }
    }

    return {
      sampleIds: samples.map((r: any) => Number(r.id)),
      total,
      timedOut,
    };
  }

  /** 通过 audience_id 加载并解析 */
  async resolveAudienceById(audienceId: number): Promise<number[]> {
    const aud = await this.ctx.model.NotificationAudience.findByPk(audienceId);
    if (!aud) this.ctx.throwBiz(NOTIF_ERR.AUDIENCE_NOT_FOUND);
    return this.resolve({
      audienceType: aud.audienceType,
      audienceRule: aud.audienceRule,
    });
  }

  // -------- 内部 --------

  private async _safeQuery(sql: string, params: any[]): Promise<any[]> {
    const sequelize = this.ctx.model;
    try {
      const [rows] = await Promise.race([
        sequelize.query(sql, { replacements: params }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(Object.assign(new Error('preview timeout'), { code: 'ECONNABORTED' })), PREVIEW_TIMEOUT_MS),
        ),
      ]) as any;
      return rows as any[];
    } catch (e: any) {
      if (e.biz) throw e;
      if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message)) {
        this.ctx.throwBiz(NOTIF_ERR.AUDIENCE_PREVIEW_TIMEOUT);
      }
      throw e;
    }
  }
}
```

> **注意**：`Promise.race` 超时不能真正打断 MySQL 查询；P3 应改为在 SQL 层加 `MAX_EXECUTION_TIME(5000)` 提示。本计划接受"超时仅停止等待，DB 仍跑完"的折中。

---

## Step 2: 测试 `test/notification/service/notification-audience-dynamic.test.ts`（8 用例）

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification-audience (dynamic)', () => {
  let ctx: any;
  beforeEach(() => {
    ctx = app.mockContext();
  });

  it('resolveDynamic 简单 user.status=1 返回 user.id 数组', async () => {
    mock(ctx.model, 'query', async (sql: string, opts: any) => {
      assert.ok(sql.includes('u.status = ?'));
      return [[{ id: 1 }, { id: 2 }, { id: 3 }]];
    });
    const ids = await ctx.service.notificationAudience.resolveDynamic({
      operator: 'and',
      conditions: [{ field: 'user.status', op: 'eq', value: 1 }],
    });
    assert.deepEqual(ids, [1, 2, 3]);
  });

  it('resolve dispatch dynamic → 调用 resolveDynamic', async () => {
    let called = false;
    mock(app.serviceClasses.notificationAudience.prototype, 'resolveDynamic',
      async () => { called = true; return [10, 20]; });
    const r = await ctx.service.notificationAudience.resolve({
      audienceType: 'dynamic',
      audienceRule: { operator: 'and', conditions: [
        { field: 'user.status', op: 'eq', value: 1 },
      ]},
    });
    assert.equal(called, true);
    assert.deepEqual(r, [10, 20]);
  });

  it('resolve all → resolveAll', async () => {
    mock(app.serviceClasses.notificationAudience.prototype, 'resolveAll',
      async () => [1, 2, 3]);
    const r = await ctx.service.notificationAudience.resolve({
      audienceType: 'all', audienceRule: {},
    });
    assert.deepEqual(r, [1, 2, 3]);
  });

  it('resolve static', async () => {
    const r = await ctx.service.notificationAudience.resolve({
      audienceType: 'static',
      audienceRule: { userIds: [99, 100] },
    });
    assert.deepEqual(r, [99, 100]);
  });

  it('previewAudience 返回 sampleIds + total', async () => {
    let calls = 0;
    mock(ctx.model, 'query', async (sql: string) => {
      calls++;
      if (sql.includes('COUNT(*)')) return [[{ cnt: 250 }]];
      return [[...Array(100)].map((_, i) => ({ id: i + 1 }))];
    });
    const r = await ctx.service.notificationAudience.previewAudience({
      operator: 'and',
      conditions: [{ field: 'user.status', op: 'eq', value: 1 }],
    });
    assert.equal(r.sampleIds.length, 100);
    assert.equal(r.total, 250);
    assert.equal(r.timedOut, false);
    assert.equal(calls, 2);
  });

  it('previewAudience 超时 → timedOut=true', async () => {
    mock(ctx.model, 'query', async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        await new Promise((res) => setTimeout(res, 6000));
      }
      return [[{ id: 1 }]];
    });
    const r = await ctx.service.notificationAudience.previewAudience({
      operator: 'and',
      conditions: [{ field: 'user.status', op: 'eq', value: 1 }],
    });
    assert.equal(r.timedOut, true);
    assert.equal(r.total, 0);
  }).timeout(8000);

  it('resolveAudienceById 加载分组并解析', async () => {
    const aud = await ctx.model.NotificationAudience.create({
      name: 'TEST_DYN', audienceType: 'dynamic',
      audienceRule: { operator: 'and', conditions: [
        { field: 'user.status', op: 'eq', value: 1 },
      ]},
    });
    mock(ctx.model, 'query', async () => [[{ id: 7 }]]);
    const ids = await ctx.service.notificationAudience.resolveAudienceById(aud.id);
    assert.deepEqual(ids, [7]);
    await aud.destroy({ force: true });
  });

  it('resolveAudienceById id 不存在 → 抛 108210', async () => {
    await assert.rejects(
      ctx.service.notificationAudience.resolveAudienceById(99999999),
      /108210/,
    );
  });
});
```

---

## Step 3: 验证

```bash
npm test -- --testPathPattern=notification-audience-dynamic
```

预期：8/8 PASS。

---

## Step 4: Commit

```bash
git add super-tool-node/app/service/notification-audience.ts super-tool-node/test/notification/service/notification-audience-dynamic.test.ts
git commit -m "feat(notification): wire dynamic audience resolver (compiler + sql exec + preview)

- resolveDynamic: compile json → safe parameterized sql → return user ids
- previewAudience: returns first 100 sample ids + total count + timedOut flag
- resolveAudienceById: load reusable audience group from DB
- 5s preview timeout via Promise.race (MySQL still completes; just stop waiting)
- Removes P1 'NotImplemented' branch
- 8 unit tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §5.3)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 5)"
```

---

## Verification Checklist

- [ ] service 5 个 public 方法（resolve / resolveAll / resolveStatic / resolveDynamic / previewAudience / resolveAudienceById）
- [ ] 8 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-3-06-admin-api.md`](./p2-3-06-admin-api.md)。

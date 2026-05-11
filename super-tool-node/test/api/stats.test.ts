import { app } from 'egg-mock/bootstrap';
import * as assert from 'assert';

describe('Stats Service contract', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = app.mockContext();
  });

  afterEach(() => app.mockRestore());

  it('1. overview 返回 8 字段全为 number', async () => {
    const data = await ctx.service.stats.overview();
    const keys = [
      'userCount', 'activeUserCount', 'todayLoginCount', 'activeSessionCount',
      'toolCount', 'feedbackCount', 'pendingFeedbackCount', 'todayNewUserCount',
    ];
    for (const k of keys) {
      assert.strictEqual(typeof (data as any)[k], 'number',
        `key ${k} must be number, got ${typeof (data as any)[k]}`);
    }
  });

  it('2. getToolUsage 返回数组 + count 降序', async () => {
    const data = await ctx.service.stats.getToolUsage({ limit: 10 });
    assert.ok(Array.isArray(data));
    // 验证 count 降序（如果返回多条）
    for (let i = 1; i < data.length; i++) {
      assert.ok(data[i - 1].count >= data[i].count,
        `counts should be DESC: ${data[i - 1].count} >= ${data[i].count}`);
    }
    // 验证每项结构
    for (const item of data) {
      assert.ok('toolCode' in item);
      assert.ok('toolName' in item);
      assert.strictEqual(typeof item.count, 'number');
    }
  });

  it('3. getUserActive 返回 dau/wau/mau + newUserTrend 数组', async () => {
    const data = await ctx.service.stats.getUserActive({});
    assert.strictEqual(typeof data.dau, 'number');
    assert.strictEqual(typeof data.wau, 'number');
    assert.strictEqual(typeof data.mau, 'number');
    assert.ok(Array.isArray(data.newUserTrend));
    // 时间窗口单调：mau >= wau >= dau（数据为 0 时全相等）
    assert.ok(data.wau >= data.dau, `wau(${data.wau}) >= dau(${data.dau})`);
    assert.ok(data.mau >= data.wau, `mau(${data.mau}) >= wau(${data.wau})`);
  });

  it('4. getTrend metric=user-register granularity=day 返回 points 数组', async () => {
    const data = await ctx.service.stats.getTrend({
      metric: 'user-register', granularity: 'day',
    });
    assert.strictEqual(data.metric, 'user-register');
    assert.strictEqual(data.granularity, 'day');
    assert.ok(Array.isArray(data.points));
    for (const p of data.points) {
      assert.ok('date' in p);
      assert.strictEqual(typeof p.count, 'number');
    }
  });

  it('5. getTrend 不支持的 metric → 422', async () => {
    let err: any;
    try {
      await ctx.service.stats.getTrend({ metric: 'invalid-metric' as any });
    } catch (e) { err = e; }
    assert.ok(err, 'should throw');
    assert.strictEqual(err.status, 422);
  });
});

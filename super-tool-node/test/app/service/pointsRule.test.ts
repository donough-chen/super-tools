export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('PointsRuleService', () => {
  it('普通会员 free（id=1）倍率 1.0、抵扣上限 5%', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(1);
    assert.strictEqual(rule.pointsMultiplier, 1.0);
    assert.strictEqual(rule.deductLimit, 0.05);
    // 100 元订单最多抵 5 元
    assert.strictEqual(ctx.service.pointsRule.calcDeductLimit(100, rule), 5);
  });

  it('黄金会员 gold（id=3）倍率 1.3 — applyMultiplier 选项控制是否生效', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(3);
    assert.strictEqual(rule.pointsMultiplier, 1.3);
    // 不传 applyMultiplier 默认不叠加
    assert.strictEqual(ctx.service.pointsRule.applyMultiplier(100, rule), 100);
    // 显式传 applyMultiplier:true 才叠加
    assert.strictEqual(
      ctx.service.pointsRule.applyMultiplier(100, rule, { applyMultiplier: true }),
      130,
    );
  });

  it('钻石会员 diamond（id=4）抵扣上限 30%', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(4);
    assert.strictEqual(rule.deductLimit, 0.30);
    assert.strictEqual(ctx.service.pointsRule.calcDeductLimit(100, rule), 30);
  });

  it('黑金会员 black（id=5）任务加成 50%、签到底分 10', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(5);
    assert.strictEqual(rule.taskBonusRate, 0.50);
    assert.strictEqual(ctx.service.pointsRule.applyTaskBonus(100, rule), 150);
    assert.strictEqual(ctx.service.pointsRule.calcSignBasePoints(rule), 10);
  });

  it('calcExpireAt 按等级有效期天数计算到期时间（黄金 456 天）', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(3);
    assert.strictEqual(rule.pointsExpireDays, 456);
    const from = new Date('2026-05-27T00:00:00Z');
    const expireAt = ctx.service.pointsRule.calcExpireAt(rule, from);
    const expected = new Date(from.getTime() + 456 * 86400000);
    assert.strictEqual(expireAt.getTime(), expected.getTime());
  });

  it('黑金 升级礼包 5000 积分（成长值 0）', async () => {
    const ctx = app.mockContext();
    const rule = await ctx.service.pointsRule.getLevelRule(5);
    assert.strictEqual(rule.upgradeGiftPoints, 5000);
    assert.strictEqual(rule.upgradeGiftGrowth, 0);
  });

  it('Level not found 抛错', async () => {
    const ctx = app.mockContext();
    let err: any;
    try { await ctx.service.pointsRule.getLevelRule(99999); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/Level not found/.test(err.message));
  });

  it('invalidateCache(levelId) 后能重新读取最新值', async () => {
    const ctx = app.mockContext();
    // 先读一次（写入 Redis）
    const rule1 = await ctx.service.pointsRule.getLevelRule(2);
    assert.ok(rule1);
    // 清缓存
    await ctx.service.pointsRule.invalidateCache(2);
    // 再读应当不报错（重新落库 + 重新缓存）
    const rule2 = await ctx.service.pointsRule.getLevelRule(2);
    assert.deepStrictEqual(rule1, rule2);
  });
});

export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('MemberService - points lifecycle (v2)', () => {
  let userId: number;

  // 每个 case 用唯一用户名，避免冲突
  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `pv2_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = u.id;
    await app.model.UserMember.create({
      userId,
      levelId: 1,
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 0,
    });
  });

  afterEach(async () => {
    // 清理：先删流水再删会员再删用户
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  it('addPoints applyMultiplier=true 应用等级倍率（gold 1.3×）', async () => {
    const ctx = app.mockContext();
    // 先把用户调到 gold（id=3）
    await app.model.UserMember.update(
      { levelId: 3, levelCode: 'gold', growthValue: 2000 },
      { where: { userId } },
    );

    const r = await ctx.service.member.addPoints({
      userId,
      points: 100,
      growthDelta: 0,
      source: 'order_paid',
      event: 'order_paid',
      applyMultiplier: true,
    });

    assert.strictEqual(r.realPoints, 130, '100 × 1.3 应得 130 积分');
    assert.strictEqual(r.currentPoints, 130);

    // 流水有 FIFO 字段
    const log: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'order_paid' },
    });
    assert.ok(log);
    assert.strictEqual(log.pointsRemaining, 130);
    assert.strictEqual(log.status, 1);
    assert.strictEqual(log.sourceLevelId, 3);
    assert.strictEqual(log.sourceEvent, 'order_paid');
    assert.strictEqual(Number(log.growthMultiplier), 1.3);
    assert.ok(log.expireAt, 'expireAt 应被设置');
  });

  it('addPoints applyMultiplier=false 不应用倍率', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update(
      { levelId: 3, levelCode: 'gold' },
      { where: { userId } },
    );
    const r = await ctx.service.member.addPoints({
      userId,
      points: 50,
      growthDelta: 0,
      source: 'task_claim',
      event: 'task_claim',
    });
    // 没传 applyMultiplier → 不叠加
    assert.strictEqual(r.realPoints, 50);
  });

  it('consumePoints FIFO 优先扣最早过期的批次', async () => {
    const ctx = app.mockContext();
    // 第一笔流水：到期晚（365 天后）
    await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'a',
      points: 50,
      balance: 50,
      pointsRemaining: 50,
      status: 1,
      sourceLevelId: 1,
      sourceEvent: 'a',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 365 * 86_400_000),
    });
    // 第二笔流水：到期早（30 天后）
    await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'b',
      points: 50,
      balance: 100,
      pointsRemaining: 50,
      status: 1,
      sourceLevelId: 1,
      sourceEvent: 'b',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 30 * 86_400_000),
    });
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });

    // 消耗 60：先扣完早过期的 b（50），再扣 a 的 10
    await ctx.service.member.consumePoints(
      userId, 60, 'mall_exchange', 'mall', '1', '兑换商品',
      { event: 'mall_exchange' },
    );

    const logA: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'a' },
    });
    const logB: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'b' },
    });
    assert.strictEqual(logB.pointsRemaining, 0);
    assert.strictEqual(logB.status, 2);
    assert.strictEqual(logA.pointsRemaining, 40);
    assert.strictEqual(logA.status, 1);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 40);

    // 应该有一条消耗流水
    const consumeLog: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'mall_exchange' },
    });
    assert.ok(consumeLog);
    assert.strictEqual(consumeLog.points, -60);
    assert.strictEqual(consumeLog.type, 2);
    assert.strictEqual(consumeLog.status, 2);
  });

  it('consumePoints 余额不足且 allowNegative=false 时报错', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update({ points: 5 }, { where: { userId } });
    let err: any;
    try {
      await ctx.service.member.consumePoints(userId, 10, 'mall_exchange');
    } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/余额不足/.test(err.message));
  });

  it('checkAndUpgrade 升级到 silver 触发礼包（+200 积分）且不连锁升级', async () => {
    const ctx = app.mockContext();
    // 把成长值调到 500 = silver 升级线
    await app.model.UserMember.update(
      { growthValue: 500 },
      { where: { userId } },
    );

    const r = await ctx.service.member.checkAndUpgrade(userId, 500);
    assert.strictEqual(r.upgraded, true);
    assert.strictEqual(r.newLevel.code, 'silver');
    assert.strictEqual(r.giftPoints, 200);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.levelCode, 'silver');
    assert.strictEqual(m.points, 200);   // 礼包积分到账
    // skipGrowth=true 防止礼包成长值再次触发升级
    assert.strictEqual(m.growthValue, 500);

    // 礼包流水存在且 FIFO 字段正确
    const giftLog: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'level_upgrade_gift' },
    });
    assert.ok(giftLog);
    assert.strictEqual(giftLog.pointsRemaining, 200);
    assert.strictEqual(giftLog.sourceLevelId, 2);  // silver
    assert.strictEqual(giftLog.sourceEvent, 'level_upgrade_gift');
    assert.strictEqual(giftLog.growthDelta, 0);    // 礼包不计成长值
  });

  // 注：refundPoints 6 case 账本契约已迁移到独立文件 member.refund.test.ts
  //     旧测试断言（status=4 / UNSIGNED 钳零 / remark 模板）已被 B1 改造取代：
  //       - status=4 → 仅旧分支保留；新逻辑用 status=1/2/3 + metadata
  //       - UNSIGNED 钳零 → 026 已 ALTER 为 SIGNED，model 同步
  //       - remark 模板 → 改为结构化 metadata.{scenario,originalLogId,refundAmount,recoverHere,overflow}
});

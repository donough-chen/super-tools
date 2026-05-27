/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('PointsExpireService - FIFO expire + upgrade extend + reminders', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `exp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
    await app.model.PointsExpiryLog.destroy({ where: { userId } });
    await app.model.PointsExpiryNotice.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  it('processExpiredBatches 清零已过期批次：状态置 3 + 写过期流水 + 写 PointsExpiryLog', async () => {
    const ctx = app.mockContext();
    // 模拟一笔已过期 + 一笔未过期
    const expired: any = await app.model.PointsLog.create({
      userId, type: 1, source: 'order_paid',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'order_paid',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() - 86400000),  // 1 天前已过期
    });
    const fresh: any = await app.model.PointsLog.create({
      userId, type: 1, source: 'order_paid',
      points: 50, balance: 150,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'order_paid',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 30 * 86400000),
    });
    await app.model.UserMember.update({ points: 150 }, { where: { userId } });

    const r = await ctx.service.pointsExpire.processExpiredBatches();
    assert.strictEqual(r.processedUsers, 1);
    assert.strictEqual(r.totalExpired, 100);

    // 已过期批次：状态 3、remaining=0
    const refreshedExpired: any = await app.model.PointsLog.findByPk(expired.id);
    assert.strictEqual(refreshedExpired.status, 3);
    assert.strictEqual(refreshedExpired.pointsRemaining, 0);

    // 未过期批次：状态保持 1、remaining 不变
    const refreshedFresh: any = await app.model.PointsLog.findByPk(fresh.id);
    assert.strictEqual(refreshedFresh.status, 1);
    assert.strictEqual(refreshedFresh.pointsRemaining, 50);

    // 写了一条 type=3 的过期流水
    const expireLog: any = await app.model.PointsLog.findOne({
      where: { userId, type: 3, source: 'points_expire' },
    });
    assert.ok(expireLog);
    assert.strictEqual(expireLog.points, -100);
    assert.strictEqual(expireLog.bizId, String(expired.id));

    // 写了 PointsExpiryLog 执行记录
    const exLog: any = await app.model.PointsExpiryLog.findOne({
      where: { userId, sourceLogId: expired.id },
    });
    assert.ok(exLog);
    assert.strictEqual(exLog.expiredPoints, 100);

    // 会员余额扣减
    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 50);
  });

  it('processExpiredBatches 幂等：第二次执行不会重复扣分', async () => {
    const ctx = app.mockContext();
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
      expireAt: new Date(Date.now() - 86400000),
    });
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });

    const r1 = await ctx.service.pointsExpire.processExpiredBatches();
    assert.strictEqual(r1.totalExpired, 100);

    // 第二次：批次已置 status=3，无可处理
    const r2 = await ctx.service.pointsExpire.processExpiredBatches();
    assert.strictEqual(r2.processedUsers, 0);
    assert.strictEqual(r2.totalExpired, 0);

    // 会员余额仍是 0（未被重复扣）
    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 0);
  });

  it('extendExpireOnUpgrade GREATEST 逻辑：原值更大时不缩短', async () => {
    const ctx = app.mockContext();
    const farFuture = new Date(Date.now() + 1000 * 86400000);  // 1000 天后
    const log: any = await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
      expireAt: farFuture,
    });

    // 升级到 silver（365 天）— 365 < 1000，应保持原值
    await ctx.service.pointsExpire.extendExpireOnUpgrade(userId, { pointsExpireDays: 365 });
    const refreshed: any = await app.model.PointsLog.findByPk(log.id);
    // MySQL DATETIME 默认秒级精度，比较时译到秒
    const refreshedSec = Math.floor(refreshed.expireAt.getTime() / 1000);
    const farFutureSec = Math.floor(farFuture.getTime() / 1000);
    assert.strictEqual(refreshedSec, farFutureSec, '原值更大 GREATEST 应保持原值');
  });

  it('extendExpireOnUpgrade GREATEST 逻辑：原值更小时延长', async () => {
    const ctx = app.mockContext();
    const nearFuture = new Date(Date.now() + 30 * 86400000);  // 30 天后
    const log: any = await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
      expireAt: nearFuture,
    });

    // 升级到 diamond（730 天）— 应延长
    await ctx.service.pointsExpire.extendExpireOnUpgrade(userId, { pointsExpireDays: 730 });
    const refreshed: any = await app.model.PointsLog.findByPk(log.id);
    // 原值 30 天后、新值应 ≈730 天后；GREATEST 取后者；
    // 两者差应在 600 天以上（足够大避免毫秒精度问题）
    const deltaDays = (refreshed.expireAt.getTime() - nearFuture.getTime()) / 86_400_000;
    assert.ok(
      deltaDays >= 600,
      `延长后应至少多 600 天，实际仅 ${deltaDays.toFixed(2)} 天 (expireAt=${refreshed.expireAt.toISOString()})`,
    );
  });

  it('sendExpireReminders T-30 阶段：写 PointsExpiryNotice 幂等记录', async () => {
    const ctx = app.mockContext();
    // 模拟一笔 30 天后到期的批次
    const expireTarget = new Date();
    expireTarget.setHours(0, 0, 0, 0);
    expireTarget.setDate(expireTarget.getDate() + 30);
    expireTarget.setHours(12, 0, 0, 0);  // 当天中午

    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
      expireAt: expireTarget,
    });

    const r = await ctx.service.pointsExpire.sendExpireReminders();
    // 至少写入了 1 条 stage=1 提醒
    assert.ok(r.sent >= 1);

    const notice: any = await app.model.PointsExpiryNotice.findOne({
      where: { userId, noticeStage: 1 },
    });
    assert.ok(notice);
    assert.strictEqual(notice.pointsAmount, 100);
    assert.deepStrictEqual(notice.channels, ['in_app']);

    // 第二次执行：唯一索引保护，不重复
    await ctx.service.pointsExpire.sendExpireReminders();
    const count = await app.model.PointsExpiryNotice.count({
      where: { userId, noticeStage: 1 },
    });
    assert.strictEqual(count, 1);
  });

  it('getStats 返回即将过期 + 本月已过期', async () => {
    const ctx = app.mockContext();
    // 即将过期：15 天后到期 200 积分
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 200, balance: 200,
      pointsRemaining: 200, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
      expireAt: new Date(Date.now() + 15 * 86400000),
    });
    // 本月已过期：type=3 流水
    await app.model.PointsLog.create({
      userId, type: 3, source: 'points_expire',
      points: -50, balance: 0,
      pointsRemaining: 0, status: 3,
      sourceLevelId: 1, sourceEvent: 'points_expire',
    });

    const stats = await ctx.service.pointsExpire.getStats();
    assert.ok(stats.soonExpirePoints >= 200);
    assert.ok(stats.expiredThisMonth >= 50);
  });
});

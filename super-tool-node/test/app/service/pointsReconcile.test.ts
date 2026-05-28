export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('PointsReconcileService - daily snapshot + hourly check', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `rec_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
    await app.model.PointsDailySnapshot.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  function localToday(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  it('takeDailySnapshot 写入快照：实际余额 vs 理论余额一致 → is_anomaly=0', async () => {
    const ctx = app.mockContext();
    // 模拟一致状态：会员余额 100，流水累计 +100
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });

    const r = await ctx.service.pointsReconcile.takeDailySnapshot();
    assert.ok(r.users >= 1);

    const snap: any = await app.model.PointsDailySnapshot.findOne({
      where: { userId, snapshotDate: localToday() },
    });
    assert.ok(snap);
    assert.strictEqual(snap.pointsBalance, 100);
    assert.strictEqual(snap.theoreticalBalance, 100);
    assert.strictEqual(snap.diff, 0);
    assert.strictEqual(snap.isAnomaly, 0);
  });

  it('takeDailySnapshot 不一致 → is_anomaly=1，记录 diff', async () => {
    const ctx = app.mockContext();
    // 故意制造不一致：会员余额 100，流水却是 +50
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 50, balance: 50,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });

    const r = await ctx.service.pointsReconcile.takeDailySnapshot();
    assert.ok(r.anomalies >= 1);

    const snap: any = await app.model.PointsDailySnapshot.findOne({
      where: { userId, snapshotDate: localToday() },
    });
    assert.ok(snap);
    assert.strictEqual(snap.pointsBalance, 100);
    assert.strictEqual(snap.theoreticalBalance, 50);
    assert.strictEqual(snap.diff, 50);
    assert.strictEqual(snap.isAnomaly, 1);
  });

  it('takeDailySnapshot upsert：同一天重复执行不会插重复，diff 更新', async () => {
    const ctx = app.mockContext();
    // 第一次：余额 100
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });
    await ctx.service.pointsReconcile.takeDailySnapshot();

    // 模拟期间发生消耗：余额 -30 = 70
    await app.model.UserMember.update({ points: 70 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 2, source: 'mall_exchange',
      points: -30, balance: 70,
      pointsRemaining: 0, status: 2,
      sourceLevelId: 1, sourceEvent: 'mall_exchange',
    });
    await ctx.service.pointsReconcile.takeDailySnapshot();

    // 同日只有 1 条快照（upsert 唯一索引保护）
    const snaps: any[] = await app.model.PointsDailySnapshot.findAll({
      where: { userId, snapshotDate: localToday() },
    });
    assert.strictEqual(snaps.length, 1);
    assert.strictEqual(snaps[0].pointsBalance, 70);
    assert.strictEqual(snaps[0].theoreticalBalance, 70);
    assert.strictEqual(snaps[0].diff, 0);
  });

  it('hourlyBalanceCheck 找最近 1 小时变动用户、理论值与实际值核算', async () => {
    const ctx = app.mockContext();
    // 有最近 1 小时的流水
    await app.model.UserMember.update({ points: 50 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 50, balance: 50,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });

    const r = await ctx.service.pointsReconcile.hourlyBalanceCheck();
    assert.ok(r.checked >= 1);
    // 一致 → 无异常
    const myAnom = r.anomalies.find((a: any) => a.userId === userId);
    assert.strictEqual(myAnom, undefined);
  });

  it('hourlyBalanceCheck 检测到不一致：返回 anomalies', async () => {
    const ctx = app.mockContext();
    // 会员余额 200，流水仅 +50（人为不一致）
    await app.model.UserMember.update({ points: 200 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 50, balance: 50,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });

    const r = await ctx.service.pointsReconcile.hourlyBalanceCheck();
    const myAnom = r.anomalies.find((a: any) => a.userId === userId);
    assert.ok(myAnom);
    assert.strictEqual(myAnom.actual, 200);
    assert.strictEqual(myAnom.theoretical, 50);
    assert.strictEqual(myAnom.diff, 150);
  });

  it('listSnapshots 按 onlyAnomaly 过滤', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'a',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'a',
    });
    await ctx.service.pointsReconcile.takeDailySnapshot();

    const all: any = await ctx.service.pointsReconcile.listSnapshots({});
    assert.ok(all.count >= 1);

    const onlyAnom: any = await ctx.service.pointsReconcile.listSnapshots({ onlyAnomaly: true });
    // 我这条用户是一致的，不应出现在 onlyAnomaly 结果里
    const found = onlyAnom.rows.find((r: any) => r.userId === userId);
    assert.strictEqual(found, undefined);
  });
});

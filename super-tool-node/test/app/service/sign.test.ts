export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('SignService - daily sign + streak', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `sign_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
      signStreak: 0,
      totalSignDays: 0,
    });
  });

  afterEach(async () => {
    await app.model.UserSign.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  function localToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  function shiftDate(dateStr: string, deltaDays: number) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  it('首次签到：streak=1，按 free 等级发 1 积分', async () => {
    const ctx = app.mockContext();
    const r = await ctx.service.sign.dailySign(userId);
    assert.strictEqual(r.streak, 1);
    assert.strictEqual(r.points, 1);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.signStreak, 1);
    assert.strictEqual(m.totalSignDays, 1);
    assert.strictEqual(m.points, 1);

    const sign: any = await app.model.UserSign.findOne({ where: { userId } });
    assert.ok(sign);
    assert.strictEqual(sign.streak, 1);
    assert.strictEqual(sign.pointsEarned, 1);
  });

  it('连续签到：昨天签过 → streak+1', async () => {
    const ctx = app.mockContext();
    const today = localToday();
    const yesterday = shiftDate(today, -1);
    // 模拟"昨天已签到"的状态
    await app.model.UserMember.update(
      { signStreak: 5, lastSignDate: yesterday, totalSignDays: 5 },
      { where: { userId } },
    );
    await app.model.UserSign.create({
      userId, signDate: yesterday, streak: 5, pointsEarned: 1, growthEarned: 0, levelId: 1,
    });

    const r = await ctx.service.sign.dailySign(userId);
    assert.strictEqual(r.streak, 6);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.signStreak, 6);
    assert.strictEqual(m.totalSignDays, 6);
  });

  it('断签归零：前天签过、昨天没签、今天签 → streak=1', async () => {
    const ctx = app.mockContext();
    const today = localToday();
    const dayBeforeYesterday = shiftDate(today, -2);
    // 模拟"前天已签到，昨天断签"
    await app.model.UserMember.update(
      { signStreak: 3, lastSignDate: dayBeforeYesterday, totalSignDays: 3 },
      { where: { userId } },
    );

    const r = await ctx.service.sign.dailySign(userId);
    assert.strictEqual(r.streak, 1, '断签后 streak 应归零再 +1');

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.signStreak, 1);
    assert.strictEqual(m.totalSignDays, 4);
  });

  it('今日重复签到 → 报错', async () => {
    const ctx = app.mockContext();
    await ctx.service.sign.dailySign(userId);
    let err: any;
    try {
      await ctx.service.sign.dailySign(userId);
    } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/已签到/.test(err.message));
  });

  it('黑金会员等级签到 → 10 积分（按等级签到底分）', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update(
      { levelId: 5, levelCode: 'black' },
      { where: { userId } },
    );
    const r = await ctx.service.sign.dailySign(userId);
    assert.strictEqual(r.points, 10, '黑金 sign_base_points=10');
  });

  it('member.dailySign 代理到 sign.dailySign', async () => {
    const ctx = app.mockContext();
    const r = await ctx.service.member.dailySign(userId);
    assert.ok(r);
    assert.strictEqual(r.pointsEarned, 1);
    assert.strictEqual(r.streak, 1);
  });

  it('getSignStatus 返回当月签到日期 + 今日是否已签', async () => {
    const ctx = app.mockContext();
    await ctx.service.sign.dailySign(userId);
    const status: any = await ctx.service.sign.getSignStatus(userId);
    assert.strictEqual(status.currentStreak, 1);
    assert.strictEqual(status.totalSignDays, 1);
    assert.strictEqual(status.todaySigned, true);
    assert.ok(Array.isArray(status.signedDates));
    assert.strictEqual(status.signedDates.length, 1);
  });
});

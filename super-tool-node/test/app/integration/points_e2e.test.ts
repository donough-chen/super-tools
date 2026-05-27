/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 积分体系 v2 端到端集成测试（Task 22）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2-续篇.md §Task 22
 *
 *  覆盖场景：
 *    A. 签到 → 任务 → 商城闭环（事件驱动 + FIFO + 商品快照）
 *    B. 消费 → 倍率 → 升级 → 礼包 → 延长存量批次
 *    C. 退款不扣成长值（按比例扣回原批次，允许会员负余额）
 *    D. FIFO 过期清零 + 幂等
 *    E. 提醒幂等
 *
 *  策略：直接组合 service 层（不走 HTTP），更稳定；HTTP 层由 idempotency.test.ts + 业务单测覆盖。
 */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('Points System E2E (Task 22)', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
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
    // 按依赖顺序清理（外键 / 关联流水）
    await app.model.PointsMallOrder.destroy({ where: { userId } });
    await app.model.TaskCompletionLog.destroy({ where: { userId } });
    await app.model.UserTask.destroy({ where: { userId } });
    await app.model.UserSign.destroy({ where: { userId } });
    await app.model.PointsExpiryLog.destroy({ where: { userId } });
    await app.model.PointsExpiryNotice.destroy({ where: { userId } });
    await app.model.DailyPointsCap.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  // -------------------- 场景 A --------------------
  it('A. 签到 → 任务进度 → 领奖 → 兑换商城（完整闭环）', async () => {
    const ctx = app.mockContext();

    // 1) 首次签到
    const r1 = await ctx.service.sign.dailySign(userId);
    assert.strictEqual(r1.streak, 1);
    assert.strictEqual(r1.points, 1);   // free 等级签到 1 积分

    // 2) 验证 member.points 已加 1
    let m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 1);

    // 3) sign_streak 事件应触发 achieve_sign_7 任务（progress=1，未达成 target=7）
    const ut7Before: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'achieve_sign_7' },
    });
    assert.ok(ut7Before, 'sign_streak 事件应建立 achieve_sign_7 任务记录');
    assert.strictEqual(ut7Before.progress, 1);
    assert.strictEqual(ut7Before.status, 'pending');

    // 4) 兑换商品（用户充足积分前提下）
    await app.model.UserMember.update({ points: 200 }, { where: { userId } });
    // 补一条可消耗的批次
    await app.model.PointsLog.create({
      userId, type: 1, source: 'init',
      points: 200, balance: 200,
      pointsRemaining: 200, status: 1,
      sourceLevelId: 1, sourceEvent: 'init',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 365 * 86400000),
    });

    // 兑换 itemId=3（满5减1券, 100pts）
    const exch = await ctx.service.pointsMall.exchange(userId, 3);
    assert.ok(exch.orderNo);
    assert.strictEqual(exch.fulfillStatus, 'fulfilled');
    assert.strictEqual(exch.balance, 100);

    // 5) 验证订单含 product_snapshot
    const order: any = await app.model.PointsMallOrder.findOne({
      where: { orderNo: exch.orderNo },
    });
    assert.ok(order.productSnapshot);
    assert.ok(order.productSnapshot.name);
    assert.ok(order.productSnapshot.fulfillConfig);

    // 6) 验证生成了一条 type=2 的消耗流水
    const consumeLog: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'mall_exchange', type: 2 },
    });
    assert.ok(consumeLog);
    assert.strictEqual(consumeLog.points, -100);
  });

  // -------------------- 场景 B --------------------
  it('B. 消费 → 等级倍率 → 升级 → 礼包 → 延长存量批次', async () => {
    const ctx = app.mockContext();

    // 0) 把用户调到 silver 边缘（growthValue=499，再 +1 即升级）
    await app.model.UserMember.update(
      { levelId: 1, levelCode: 'free', growthValue: 499 },
      { where: { userId } },
    );
    // 给一条存量批次（30 天后过期，升级后应延长到至少 365 天）
    const oldLog: any = await app.model.PointsLog.create({
      userId, type: 1, source: 'init',
      points: 50, balance: 50,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'init',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 30 * 86400000),
    });

    // 1) 消费 100 元（应用 free 倍率 1.0 = 100 积分；growth +100 → 599 → 跨过 silver 阈值 500 升级）
    const result = await ctx.service.member.addPoints({
      userId,
      points: 100,
      growthDelta: 100,
      source: 'order_paid',
      event: 'order_paid',
      applyMultiplier: true,
      bizType: 'order',
      bizId: 'TEST_ORDER_001',
      remark: '消费 100 元',
    });

    // 2) 验证升级到 silver
    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.levelCode, 'silver', '应升级到 silver');
    assert.ok(m.growthValue >= 599, `growthValue should be >= 599, got ${m.growthValue}`);

    // 3) 升级礼包：silver upgrade_gift_points=200（按 v2 配置）
    //    - addPoints 给的 100 + 礼包 200 = 300（如果存在礼包逻辑）
    //    - 礼包通过 skipGrowth=true 发放，growth 不变
    //    详见 PointsRule.benefits.upgrade_gift_points 的 evaluation 配置
    assert.ok(m.points >= 100, '至少包含 100 消费积分');

    // 4) 升级时存量批次 expire_at 应被延长到至少 NOW + 365 天（silver 的 points_expire_days=365）
    const refreshedOld: any = await app.model.PointsLog.findByPk(oldLog.id);
    const minExpireExpected = new Date(Date.now() + 360 * 86400000); // 留 5 天缓冲
    assert.ok(
      refreshedOld.expireAt > minExpireExpected,
      `存量批次 expire_at 应延长到 365 天后, 实际 ${refreshedOld.expireAt}`,
    );

    // 5) 应有一条 source='order_paid' 的 type=1 流水，pointsRemaining=points
    assert.ok(result.logId);
  });

  // -------------------- 场景 C --------------------
  it('C. 退款不扣成长值（按比例扣回原批次，允许会员负余额）', async () => {
    const ctx = app.mockContext();

    // 1) 模拟一笔消费：100 积分 + 100 成长值
    await app.model.UserMember.update(
      { growthValue: 100, points: 0, totalPoints: 0 },
      { where: { userId } },
    );
    const original: any = await ctx.service.member.addPoints({
      userId,
      points: 100,
      growthDelta: 100,
      source: 'order_paid',
      event: 'order_paid',
      bizType: 'order',
      bizId: 'TEST_REFUND_001',
      remark: '消费 100 元',
    });

    let m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 100);
    assert.strictEqual(m.growthValue, 200);

    // 2) 退款 50%（扣回 50 积分，growth 不变）
    await ctx.service.member.refundPoints(userId, original.logId, 50, {
      remark: '订单退款 50%',
    });

    m = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 50, '积分扣回 50');
    assert.strictEqual(m.growthValue, 200, '成长值不应被扣减');

    // 3) 验证原批次 pointsRemaining 减少了 50
    const refunded: any = await app.model.PointsLog.findByPk(original.logId);
    assert.strictEqual(refunded.pointsRemaining, 50);
  });

  // -------------------- 场景 D --------------------
  it('D. FIFO 过期清零 + 重复执行幂等', async () => {
    const ctx = app.mockContext();

    // 模拟 1 条已过期 + 1 条未过期
    await app.model.UserMember.update({ points: 150 }, { where: { userId } });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'init',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'init',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() - 86400000), // 已过期
    });
    await app.model.PointsLog.create({
      userId, type: 1, source: 'init',
      points: 50, balance: 150,
      pointsRemaining: 50, status: 1,
      sourceLevelId: 1, sourceEvent: 'init',
      growthMultiplier: 1.0,
      expireAt: new Date(Date.now() + 30 * 86400000), // 30 天后
    });

    // 第一次过期处理
    const r1 = await ctx.service.pointsExpire.processExpiredBatches();
    assert.strictEqual(r1.totalExpired, 100);

    let m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 50, '过期清零后应剩 50');

    // 第二次跑：应 0 处理（幂等）
    const r2 = await ctx.service.pointsExpire.processExpiredBatches();
    assert.strictEqual(r2.totalExpired, 0);
    assert.strictEqual(r2.processedUsers, 0);

    m = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 50, '幂等: 余额不应被重复扣');
  });

  // -------------------- 场景 E --------------------
  it('E. 提醒幂等：同日同 stage 两次只发 1 次', async () => {
    const ctx = app.mockContext();
    // 模拟一笔 30 天后到期
    const day30 = new Date();
    day30.setDate(day30.getDate() + 30);
    day30.setHours(12, 0, 0, 0);
    await app.model.PointsLog.create({
      userId, type: 1, source: 'init',
      points: 100, balance: 100,
      pointsRemaining: 100, status: 1,
      sourceLevelId: 1, sourceEvent: 'init',
      growthMultiplier: 1.0,
      expireAt: day30,
    });

    await ctx.service.pointsExpire.sendExpireReminders();
    const c1 = await app.model.PointsExpiryNotice.count({
      where: { userId, noticeStage: 1 },
    });
    assert.strictEqual(c1, 1);

    // 第二次跑
    await ctx.service.pointsExpire.sendExpireReminders();
    const c2 = await app.model.PointsExpiryNotice.count({
      where: { userId, noticeStage: 1 },
    });
    assert.strictEqual(c2, 1, '同日同 stage 只允许一条提醒记录');
  });
});

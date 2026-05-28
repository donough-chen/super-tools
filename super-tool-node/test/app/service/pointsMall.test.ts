export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('PointsMallService - exchange + fulfill + refund', () => {
  let userId: number;
  // 商品 ID 由 025 种子提供（按种子顺序）：
  //   1=7天会员体验(member_days,200pts), 2=30天会员(member_days,800pts,silver+),
  //   3=满5减1券(coupon,100pts), 4=满20减5券(coupon,400pts),
  //   5=9折券(coupon,300pts,silver+), 6=积分达人徽章(badge,500pts,total_limit=1),
  //   7=JSON Pro 7天解锁(tool_unlock,150pts)

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `mall_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = u.id;
    await app.model.UserMember.create({
      userId,
      levelId: 1,
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 1000,         // 初始 1000 积分够大多数兑换
    });
  });

  afterEach(async () => {
    await app.model.PointsMallOrder.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  it('listItems 过滤 status=1 + 时间窗，按 sort 排序', async () => {
    const ctx = app.mockContext();
    const items: any[] = await ctx.service.pointsMall.listItems();
    assert.ok(items.length >= 7);  // 种子 7 件
    // 按 sort 排序
    for (let i = 1; i < items.length; i++) {
      assert.ok(items[i - 1].sort <= items[i].sort);
    }
  });

  it('listItems 按 category 过滤', async () => {
    const ctx = app.mockContext();
    const coupons: any[] = await ctx.service.pointsMall.listItems({ category: 'coupon' });
    coupons.forEach(c => assert.strictEqual(c.category, 'coupon'));
    assert.ok(coupons.length >= 3);
  });

  it('exchange 虚拟商品立即履约：member_days +7 天', async () => {
    const ctx = app.mockContext();
    const r = await ctx.service.pointsMall.exchange(userId, 1);  // 7 天会员体验, 200pts
    assert.ok(r.orderNo);
    assert.strictEqual(r.fulfillStatus, 'fulfilled');
    assert.strictEqual(r.balance, 800);

    // 用户被开成付费会员
    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 800);
    assert.strictEqual(m.isPaid, 1);
    assert.strictEqual(m.paidPlanCode, 'monthly');
    assert.ok(m.paidExpireAt);

    // 订单含 productSnapshot
    const order: any = await app.model.PointsMallOrder.findOne({ where: { orderNo: r.orderNo } });
    assert.ok(order.productSnapshot);
    assert.strictEqual(order.productSnapshot.name, '7天会员体验');
    assert.strictEqual(order.fulfillStatus, 'fulfilled');
    assert.ok(order.fulfilledAt);
  });

  it('exchange 优惠券立即履约 + 返回 couponCode', async () => {
    const ctx = app.mockContext();
    const r = await ctx.service.pointsMall.exchange(userId, 3); // 满5减1券, 100pts
    assert.strictEqual(r.fulfillStatus, 'fulfilled');
    const order: any = await app.model.PointsMallOrder.findOne({ where: { orderNo: r.orderNo } });
    assert.strictEqual(order.fulfillResult.type, 'coupon');
    assert.ok(/^CP/.test(order.fulfillResult.couponCode));
  });

  it('exchange 积分不足报错 + 不扣分不创建订单', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update({ points: 50 }, { where: { userId } });
    let err: any;
    try { await ctx.service.pointsMall.exchange(userId, 1); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/积分不足/.test(err.message));

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 50);  // 没扣
    const order = await app.model.PointsMallOrder.findOne({ where: { userId } });
    assert.strictEqual(order, null);   // 没创建
  });

  it('exchange 等级不足报错（9 折券要 silver+）', async () => {
    const ctx = app.mockContext();
    let err: any;
    try { await ctx.service.pointsMall.exchange(userId, 5); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/silver|等级/.test(err.message));
  });

  it('exchange silver 用户能兑 9 折券', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update(
      { levelId: 2, levelCode: 'silver' },
      { where: { userId } },
    );
    const r = await ctx.service.pointsMall.exchange(userId, 5);
    assert.strictEqual(r.fulfillStatus, 'fulfilled');
  });

  it('exchange total_limit 限制：徽章只能兑 1 次', async () => {
    const ctx = app.mockContext();
    await app.model.UserMember.update({ points: 1500 }, { where: { userId } });
    await ctx.service.pointsMall.exchange(userId, 6);
    let err: any;
    try { await ctx.service.pointsMall.exchange(userId, 6); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/限兑/.test(err.message));
  });

  it('refund 退款：积分回扣 + 订单状态置 refunded', async () => {
    const ctx = app.mockContext();
    // 先兑换一个尚未履约（在我们的 MVP 里虚拟商品都立即履约了，此 case 演示实物退款规则）
    // 改为：模拟管理员主动退一个 coupon 类（已履约但允许退？plan §"虚拟已履约不可退"）
    // 因此用 fulfillStatus='shipping' 模拟"实物未发货"作为可退场景
    const r = await ctx.service.pointsMall.exchange(userId, 1); // 200pts
    const order: any = await app.model.PointsMallOrder.findOne({ where: { orderNo: r.orderNo } });
    // 直接绕过：把订单改成 shipping 模拟可退场景
    await order.update({ fulfillStatus: 'shipping', productSnapshot: { ...order.productSnapshot, isVirtual: 0 } });

    const refundResult = await ctx.service.pointsMall.refund(order.id, '测试退款');
    assert.strictEqual(refundResult.refundedPoints, 200);

    const refreshed: any = await app.model.PointsMallOrder.findByPk(order.id);
    assert.strictEqual(refreshed.refundStatus, 'refunded');
    assert.strictEqual(refreshed.fulfillStatus, 'refunded');

    // 退款流水存在
    const refundLog: any = await app.model.PointsLog.findOne({
      where: { userId, source: 'refund' },
    });
    assert.ok(refundLog);
    assert.strictEqual(refundLog.points, -200);
  });

  it('refund 虚拟商品已履约不可退', async () => {
    const ctx = app.mockContext();
    const r = await ctx.service.pointsMall.exchange(userId, 3);  // coupon 立即履约
    const order: any = await app.model.PointsMallOrder.findOne({ where: { orderNo: r.orderNo } });
    let err: any;
    try { await ctx.service.pointsMall.refund(order.id, '尝试退'); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/虚拟商品已履约不可退/.test(err.message));
  });

  it('listMyOrders 分页', async () => {
    const ctx = app.mockContext();
    await ctx.service.pointsMall.exchange(userId, 3);  // 100
    await ctx.service.pointsMall.exchange(userId, 7);  // 150
    const r: any = await ctx.service.pointsMall.listMyOrders(userId, { page: 1, pageSize: 10 });
    assert.strictEqual(r.count, 2);
    assert.strictEqual(r.rows.length, 2);
  });
});

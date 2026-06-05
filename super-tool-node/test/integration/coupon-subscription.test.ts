import { app, mock, assert } from 'egg-mock/bootstrap';
import { Application, Context } from 'egg';

describe('优惠券订阅场景集成测试', () => {
  let appInstance: Application;
  let ctx: Context;
  let userId: number;
  let testUser: any;

  beforeAll(async () => {
    appInstance = app();
  });

  afterAll(async () => {
    await appInstance.close();
  });

  beforeEach(async () => {
    // 创建测试用户
    testUser = await appInstance.model.User.create({
      username: `coupon_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = testUser.id;

    // 创建用户会员记录
    await appInstance.model.UserMember.create({
      userId,
      levelId: 1,
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 0,
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await appInstance.model.MemberPayment.destroy({ where: { userId } });
    await appInstance.model.MemberOrder.destroy({ where: { userId } });
    await appInstance.model.UserCoupon.destroy({ where: { userId } });
    await appInstance.model.UserMember.destroy({ where: { userId } });
    await appInstance.model.User.destroy({ where: { id: userId } });
  });

  describe('场景1: 获取可用优惠券列表', () => {
    it('应该返回可用优惠券列表，并自动选择最佳优惠券', async () => {
      // 1. 创建两张优惠券（一张满减券，一张折扣券）
      const coupon1 = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}A`,
        couponType: 'fixed',
        discount: 20,
        threshold: 100,
        applicableScenes: JSON.stringify(['points_mall', 'member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const coupon2 = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}B`,
        couponType: 'percent',
        discount: 0.9, // 9折
        threshold: 0,
        applicableScenes: JSON.stringify(['points_mall', 'member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 调用 service 方法获取可用优惠券
      const ctx = appInstance.mockContext();
      ctx.state = { user: { id: userId } };
      const result = await ctx.service.coupon.getAvailableCouponsForSubscription(100);

      // 3. 验证返回 list 和 bestCoupon
      assert.ok(result.list);
      assert.ok(result.bestCoupon);
      assert.strictEqual(result.list.length, 2);

      // 4. 验证 bestCoupon 是抵扣金额最大的（满减券减20 > 折扣券减10）
      assert.strictEqual(result.bestCoupon.id, coupon1.id);
    });
  });

  describe('场景2: 使用满减券，订阅金额满足门槛', () => {
    it('满减券抵扣金额正确', async () => {
      // 1. 创建满减券（threshold=100, discount=20）
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'fixed',
        discount: 20,
        threshold: 100,
        applicableScenes: JSON.stringify(['member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 验证优惠券可用于订阅
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        150, // 订单金额 150，满足 100 门槛
      );

      // 3. 验证验证通过
      assert.ok(validation.valid);
      assert.strictEqual(validation.discountAmount, 20);
      assert.strictEqual(validation.finalAmount, 130);
    });
  });

  describe('场景3: 使用折扣券，折扣计算正确', () => {
    it('折扣券抵扣金额正确', async () => {
      // 1. 创建折扣券（discount=0.9，9折）
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'percent',
        discount: 0.9,
        threshold: 0,
        applicableScenes: JSON.stringify(['member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 验证折扣计算
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        100, // 订单金额 100
      );

      // 3. 验证折扣计算正确（100 * 0.9 = 90，抵扣 10）
      assert.ok(validation.valid);
      assert.strictEqual(validation.discountAmount, 10);
      assert.strictEqual(validation.finalAmount, 90);
    });
  });

  describe('场景4: 无门槛券可用于任意金额订阅', () => {
    it('无门槛券可以抵扣', async () => {
      // 1. 创建无门槛券（threshold=0, discount=10）
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'fixed',
        discount: 10,
        threshold: 0,
        applicableScenes: JSON.stringify(['member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 验证无门槛券可用于小额订单
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        50, // 订单金额 50，低于满减券常见门槛
      );

      // 3. 验证可以抵扣
      assert.ok(validation.valid);
      assert.strictEqual(validation.discountAmount, 10);
      assert.strictEqual(validation.finalAmount, 40);
    });
  });

  describe('场景5: 满减券订阅金额不满足门槛', () => {
    it('应该返回错误', async () => {
      // 1. 创建满减券（threshold=100, discount=20）
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'fixed',
        discount: 20,
        threshold: 100,
        applicableScenes: JSON.stringify(['member_subscription']),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 验证金额不满足门槛
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        80, // 订单金额 80，不满足 100 门槛
      );

      // 3. 验证返回错误
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.error.includes('需要满足'));
    });
  });

  describe('场景6: 优惠券不可用场景', () => {
    it('场景不匹配的优惠券不能使用', async () => {
      // 1. 创建优惠券（applicableScenes=['points_mall']）
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'fixed',
        discount: 10,
        threshold: 0,
        applicableScenes: JSON.stringify(['points_mall']), // 只能用于积分商城
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 2. 尝试用于会员订阅
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        100,
      );

      // 3. 验证返回错误
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.error.includes('不可用于'));
    });

    it('已过期的优惠券不能使用', async () => {
      // 1. 创建已过期的优惠券
      const coupon = await appInstance.model.UserCoupon.create({
        userId,
        orderId: 0,
        couponCode: `TEST${Date.now()}`,
        couponType: 'fixed',
        discount: 10,
        threshold: 0,
        applicableScenes: JSON.stringify(['member_subscription']),
        expireAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天过期
      });

      // 2. 尝试使用
      const validation = await appInstance.mockContext().service.coupon.validateCouponForSubscription(
        coupon.id,
        userId,
        100,
      );

      // 3. 验证返回错误
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.error.includes('已过期'));
    });
  });
});

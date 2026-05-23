/**
 * OrderService 单测
 *
 * 用 mock ctx + mock model 的纯单元测试模式（不依赖真实 DB）
 */
import OrderService from '../../../app/service/order';

function createMockCtx(overrides: any = {}) {
  const throwFn = (status: number, msg: string) => {
    const e: any = new Error(msg);
    e.status = status;
    throw e;
  };
  const baseCtx: any = {
    throw: jest.fn(throwFn),
    model: {
      PaidPlan: { findOne: jest.fn() },
      UserMember: { findOne: jest.fn() },
      MemberOrder: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        findAndCountAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        sum: jest.fn(),
      },
      MemberPayment: { findOne: jest.fn() },
      MemberRefund: { findOne: jest.fn() },
      User: {},
      SystemConfig: { findOne: jest.fn().mockResolvedValue(null) },
      ...overrides.model,
    },
    service: {
      member: {
        activatePaidPlan: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.service,
    },
    state: { user: { id: 5 } },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  };
  return baseCtx;
}

function createService(ctx: any) {
  // 绕过 BaseService 构造，直接挂上 ctx 与 paginate stub
  const svc: any = Object.create(OrderService.prototype);
  svc.ctx = ctx;
  svc.app = { config: {} };
  // OrderService.create 用 this.service.member.activatePaidPlan，让其指向 ctx.service
  svc.service = ctx.service;
  svc.paginate = jest.fn().mockResolvedValue({
    list: [], total: 0, page: 1, pageSize: 20, totalPages: 0,
  });
  return svc;
}

describe('OrderService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('正常下单 → 返回 orderId/orderNo + scene=1', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.PaidPlan.findOne.mockResolvedValue({
        toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
      });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 0, paidPlanCode: null, paidExpireAt: null }),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue(null);
      ctx.model.MemberOrder.create.mockResolvedValue({ id: 100 });

      const res = await svc.create({ userId: 5, planCode: 'monthly' });
      expect(res.orderId).toBe(100);
      expect(res.orderNo).toMatch(/^MO\d{14}\d{4}$/);
      expect(res.scene).toBe(1);
      expect(res.amount).toBe('6.80');
      expect(res.planName).toBe('月度');
      expect(res.needPayment).toBe(true);
    });

    it('套餐不存在 → throw 404', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.PaidPlan.findOne.mockResolvedValue(null);
      await expect(svc.create({ userId: 5, planCode: 'unknown' }))
        .rejects.toThrow('套餐不存在或已下架');
    });

    it('已付费同套餐 → scene=2 续费', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date(Date.now() + 5 * 86400000);
      ctx.model.PaidPlan.findOne.mockResolvedValue({
        toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
      });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'monthly', paidExpireAt: future }),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue(null);
      ctx.model.MemberOrder.create.mockResolvedValue({ id: 101 });

      const res = await svc.create({ userId: 5, planCode: 'monthly' });
      expect(res.scene).toBe(2);
      expect(res.needPayment).toBe(true);
    });

    it('Phase2: 已付费跨套餐 monthly→yearly → scene=3 升级（差价订单）', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date(Date.now() + 25 * 86400000); // 还剩 25 天
      // 第一次 findOne：newPlan = yearly
      ctx.model.PaidPlan.findOne
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 2, code: 'yearly', name: '年度', price: '68.00', durationDays: 365 }),
        })
        // 第二次 findOne：currentPlan = monthly（升降级路径）
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 1, code: 'monthly', price: '6.80', durationDays: 30 }),
        });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'monthly', paidExpireAt: future }),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue(null);
      ctx.model.MemberOrder.create.mockResolvedValue({ id: 102 });

      const res = await svc.create({ userId: 5, planCode: 'yearly' });
      expect(res.scene).toBe(3);
      expect(res.needPayment).toBe(true);
      // 差价 = 68 - 6.8*25/30 ≈ 62.33
      expect(Number(res.amount)).toBeCloseTo(62.33, 1);
      expect(res.remainingValue).toBeCloseTo(5.67, 1);
    });

    it('Phase2: 已付费跨套餐 yearly→monthly → scene=4 降级（amount=0 + 立即开通）', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date(Date.now() + 200 * 86400000); // 还剩 200 天
      ctx.model.PaidPlan.findOne
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
        })
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 2, code: 'yearly', price: '68.00', durationDays: 365 }),
        });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'yearly', paidExpireAt: future }),
      });
      ctx.model.MemberOrder.create.mockResolvedValue({ id: 103 });

      const res = await svc.create({ userId: 5, planCode: 'monthly' });
      expect(res.scene).toBe(4);
      expect(res.amount).toBe('0.00');
      expect(res.needPayment).toBe(false);
      // 关键：scene=4 立即调 activatePaidPlan(mode='downgrade')
      expect(ctx.service.member.activatePaidPlan).toHaveBeenCalledWith(
        5, 'monthly',
        expect.objectContaining({
          orderId: 103,
          mode: 'downgrade',
        }),
      );
      // scene=4 不查 pending（因为 amount=0）
      expect(ctx.model.MemberOrder.findOne).not.toHaveBeenCalled();
    });

    it('Phase2: 永久会员降级 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date('2099-12-31');
      ctx.model.PaidPlan.findOne
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
        })
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 3, code: 'lifetime', price: '999', durationDays: 0 }),
        });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'lifetime', paidExpireAt: future }),
      });

      await expect(svc.create({ userId: 5, planCode: 'monthly' }))
        .rejects.toThrow(/永久/);
    });

    it('Phase2: scene=3 升级时仍校验 pending 订单（amount > 0）', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date(Date.now() + 25 * 86400000);
      ctx.model.PaidPlan.findOne
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 2, code: 'yearly', name: '年度', price: '68.00', durationDays: 365 }),
        })
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 1, code: 'monthly', price: '6.80', durationDays: 30 }),
        });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'monthly', paidExpireAt: future }),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue({ orderNo: 'MO_PEND_2' });

      await expect(svc.create({ userId: 5, planCode: 'yearly' }))
        .rejects.toThrow('您有未完成订单 MO_PEND_2');
    });

    it('存在未支付订单 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.PaidPlan.findOne.mockResolvedValue({
        toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
      });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 0 }),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue({ orderNo: 'MO_PEND_1' });

      await expect(svc.create({ userId: 5, planCode: 'monthly' }))
        .rejects.toThrow('您有未完成订单 MO_PEND_1');
    });
  });

  describe('preview (Phase2)', () => {
    it('preview 不创建订单，仅返回计算结果', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const future = new Date(Date.now() + 25 * 86400000);
      ctx.model.PaidPlan.findOne
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 2, code: 'yearly', name: '年度', price: '68.00', durationDays: 365 }),
        })
        .mockResolvedValueOnce({
          toJSON: () => ({ id: 1, code: 'monthly', name: '月度', price: '6.80', durationDays: 30 }),
        });
      ctx.model.UserMember.findOne.mockResolvedValue({
        toJSON: () => ({ isPaid: 1, paidPlanCode: 'monthly', paidExpireAt: future }),
      });

      const res = await svc.preview({ userId: 5, planCode: 'yearly' });
      expect(res.scene).toBe(3);
      expect(Number(res.amount)).toBeCloseTo(62.33, 1);
      expect(res.currentPlanName).toBe('月度');
      expect(res.newPlanName).toBe('年度');
      expect(res.needPayment).toBe(true);
      // 关键：未调用 create
      expect(ctx.model.MemberOrder.create).not.toHaveBeenCalled();
    });

    it('preview 套餐不存在 → throw 404', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.PaidPlan.findOne.mockResolvedValue(null);
      await expect(svc.preview({ userId: 5, planCode: 'unknown' }))
        .rejects.toThrow('套餐不存在或已下架');
    });
  });

  describe('cancel', () => {
    it('正常取消 → 返回 status=2', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const updateMock = jest.fn();
      ctx.model.MemberOrder.findOne.mockResolvedValue({ status: 0, update: updateMock });

      const res = await svc.cancel(100, 5);
      expect(res.status).toBe(2);
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 2 }));
    });

    it('已支付订单不可取消 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberOrder.findOne.mockResolvedValue({ status: 1 });
      await expect(svc.cancel(100, 5))
        .rejects.toThrow('订单状态不允许取消');
    });
  });

  describe('cleanExpired', () => {
    it('返回受影响行数', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberOrder.update.mockResolvedValue([3]);
      const affected = await svc.cleanExpired();
      expect(affected).toBe(3);
    });
  });
});

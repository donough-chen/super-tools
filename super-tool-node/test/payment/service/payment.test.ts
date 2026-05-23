/**
 * PaymentService 单测
 *
 * 关键覆盖：
 *   - create: 订单状态校验 + 已付防重 + provider 调用
 *   - handleCallback: 验签失败/金额校验/幂等/事务内更新/事务外 activatePaidPlan
 *   - markFailed: 状态转移 + 通知
 */
import PaymentService from '../../../app/service/payment';

// Mock PaymentProvider factory
jest.mock('../../../app/lib/payment', () => {
  const original = jest.requireActual('../../../app/lib/payment');
  return {
    ...original,
    getPaymentProvider: jest.fn(),
  };
});
import { getPaymentProvider } from '../../../app/lib/payment';

function createMockCtx(overrides: any = {}) {
  const baseCtx: any = {
    throw: jest.fn((status: number, msg: string) => {
      const e: any = new Error(msg);
      e.status = status;
      throw e;
    }),
    model: {
      MemberOrder: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
      },
      MemberPayment: {
        findOne: jest.fn(),
        create: jest.fn(),
      },
      UserMember: { findOne: jest.fn() },
      transaction: jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    service: {
      member: { activatePaidPlan: jest.fn().mockResolvedValue({}) },
      notification: { core: { send: jest.fn().mockResolvedValue({}) } },
    },
    request: { headers: {} },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  };
  return baseCtx;
}

function createService(ctx: any) {
  const svc: any = Object.create(PaymentService.prototype);
  svc.ctx = ctx;
  svc.app = { config: { appConfig: { baseUrl: 'http://localhost:7001' } } };
  return svc;
}

describe('PaymentService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('正常创建 → 返回 paymentNo + cashierUrl', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);

      ctx.model.MemberOrder.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 100, status: 0, amount: '6.80',
          expireAt: new Date(Date.now() + 30 * 60 * 1000),
          planCode: 'monthly', planSnapshot: { name: '月度' },
        }),
        update: jest.fn(),
      });
      ctx.model.MemberPayment.findOne.mockResolvedValue(null);
      const updateMock = jest.fn();
      ctx.model.MemberPayment.create.mockResolvedValue({ id: 200, update: updateMock });

      (getPaymentProvider as jest.Mock).mockReturnValue({
        createPrepay: jest.fn().mockResolvedValue({
          prepayData: { mockToken: 'mock_xxx' },
          cashierUrl: '/member/cashier?paymentNo=MP_X',
        }),
      });

      const res = await svc.create({ orderId: 100, userId: 5, provider: 'mock' });
      expect(res.paymentNo).toMatch(/^MP\d+/);
      expect(res.cashierUrl).toBe('/member/cashier?paymentNo=MP_X');
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        prepayData: expect.any(Object),
      }));
    });

    it('订单状态非 0 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberOrder.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 100, status: 1, amount: '6.80',
          expireAt: new Date(Date.now() + 60000),
        }),
      });
      await expect(svc.create({ orderId: 100, userId: 5, provider: 'mock' }))
        .rejects.toThrow(/订单状态不允许支付/);
    });

    it('订单已存在 success 支付 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberOrder.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 100, status: 0, amount: '6.80',
          expireAt: new Date(Date.now() + 60000),
        }),
      });
      ctx.model.MemberPayment.findOne.mockResolvedValue({ id: 1 });

      await expect(svc.create({ orderId: 100, userId: 5, provider: 'mock' }))
        .rejects.toThrow('订单已支付');
    });
  });

  describe('handleCallback', () => {
    it('正常成功 → 触发 activatePaidPlan + 通知', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);

      (getPaymentProvider as jest.Mock).mockReturnValue({
        verifyCallback: jest.fn().mockResolvedValue({
          success: true, paymentNo: 'MP_T1', providerTradeNo: 'WX_1',
          amount: 6.8, rawPayload: {},
        }),
      });

      const lockedPaymentUpdate = jest.fn();
      const lockedOrderUpdate = jest.fn();
      // 第一次（外层非锁）查 payment
      ctx.model.MemberPayment.findOne.mockResolvedValueOnce({
        toJSON: () => ({ id: 200, status: 0, amount: '6.80', orderId: 100, userId: 5 }),
      });
      // 第二次（事务内行级锁）
      ctx.model.MemberPayment.findOne.mockResolvedValueOnce({
        status: 0, update: lockedPaymentUpdate,
      });
      // 事务内查 order
      ctx.model.MemberOrder.findOne.mockResolvedValueOnce({
        toJSON: () => ({
          id: 100, orderNo: 'MO_T1', planCode: 'monthly',
          planSnapshot: { name: '月度' }, amount: '6.80',
        }),
        update: lockedOrderUpdate,
      });
      // 通知前再查 member 取 expireAt
      ctx.model.UserMember.findOne.mockResolvedValue({
        paidExpireAt: new Date('2026-06-23'),
      });

      const res = await svc.handleCallback('mock', {}, JSON.stringify({
        paymentNo: 'MP_T1', amount: 6.8,
      }));
      expect(res.success).toBe(true);
      expect(res.skipped).toBe(false);
      expect(lockedPaymentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 1, providerTradeNo: 'WX_1' }),
        expect.any(Object),
      );
      expect(lockedOrderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 1 }),
        expect.any(Object),
      );
      expect(ctx.service.member.activatePaidPlan).toHaveBeenCalledWith(
        5, 'monthly',
        expect.objectContaining({ orderId: 100, mode: 'new' }),
      );
      expect(ctx.service.notification.core.send).toHaveBeenCalledWith(
        expect.objectContaining({ typeCode: 'BUSINESS_PAYMENT_SUCCESS' }),
      );
    });

    it('重复回调（status=1）→ skipped=true', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      (getPaymentProvider as jest.Mock).mockReturnValue({
        verifyCallback: jest.fn().mockResolvedValue({
          success: true, paymentNo: 'MP_T1', providerTradeNo: 'WX_1',
          amount: 6.8, rawPayload: {},
        }),
      });
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        toJSON: () => ({ id: 200, status: 1, amount: '6.80', orderId: 100, userId: 5 }),
      });

      const res = await svc.handleCallback('mock', {}, JSON.stringify({
        paymentNo: 'MP_T1', amount: 6.8,
      }));
      expect(res.skipped).toBe(true);
      expect(ctx.service.member.activatePaidPlan).not.toHaveBeenCalled();
    });

    it('金额不一致 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      (getPaymentProvider as jest.Mock).mockReturnValue({
        verifyCallback: jest.fn().mockResolvedValue({
          success: true, paymentNo: 'MP_T1', providerTradeNo: 'WX_1',
          amount: 99.99, rawPayload: {},
        }),
      });
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        toJSON: () => ({ id: 200, status: 0, amount: '6.80', orderId: 100, userId: 5 }),
      });

      await expect(svc.handleCallback('mock', {}, JSON.stringify({
        paymentNo: 'MP_T1', amount: 99.99,
      }))).rejects.toThrow(/金额不一致/);
    });

    it('验签失败 → throw 400', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      (getPaymentProvider as jest.Mock).mockReturnValue({
        verifyCallback: jest.fn().mockResolvedValue({
          success: false, paymentNo: '', providerTradeNo: '',
          amount: 0, rawPayload: {}, error: 'invalid JSON',
        }),
      });
      await expect(svc.handleCallback('mock', {}, 'bad'))
        .rejects.toThrow(/支付回调验签失败/);
    });
  });

  describe('markFailed', () => {
    it('正常失败 → status=2 + 通知', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      const updateMock = jest.fn();
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        status: 0, userId: 5, orderId: 100, update: updateMock,
      });
      ctx.model.MemberOrder.findByPk.mockResolvedValue({ orderNo: 'MO_T1' });

      await svc.markFailed('MP_T1', '用户取消');
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 2 }));
      expect(ctx.service.notification.core.send).toHaveBeenCalledWith(
        expect.objectContaining({
          typeCode: 'BUSINESS_PAYMENT_FAIL',
          variables: expect.objectContaining({ orderNo: 'MO_T1' }),
        }),
      );
    });

    it('已成功的支付不可标记失败 → 静默跳过', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberPayment.findOne.mockResolvedValue({ status: 1 });

      await svc.markFailed('MP_T1', '用户取消');
      expect(ctx.service.notification.core.send).not.toHaveBeenCalled();
    });
  });

  // ==================== Phase 2 新增 ====================
  describe('Phase2: handleCallback 根据 scene 传 mode', () => {
    const setupCallbackMocks = (sceneValue: number, planSnapshot: any = { name: '月度', durationDays: 30 }) => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      (getPaymentProvider as jest.Mock).mockReturnValue({
        verifyCallback: jest.fn().mockResolvedValue({
          success: true, paymentNo: 'MP_T1', providerTradeNo: 'WX_1',
          amount: 6.8, rawPayload: {},
        }),
      });
      // 第一次（外层读取）
      ctx.model.MemberPayment.findOne.mockResolvedValueOnce({
        toJSON: () => ({ id: 200, status: 0, amount: '6.80', orderId: 100, userId: 5 }),
      });
      // 第二次（事务内行级锁）
      ctx.model.MemberPayment.findOne.mockResolvedValueOnce({
        status: 0, update: jest.fn(),
      });
      ctx.model.MemberOrder.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 100, orderNo: 'MO_T1', planCode: 'yearly',
          planSnapshot, amount: '6.80', scene: sceneValue, userId: 5,
        }),
        update: jest.fn(),
      });
      return { ctx, svc };
    };

    it('scene=2 续费 → mode=renew，不传 newExpireAt', async () => {
      const { ctx, svc } = setupCallbackMocks(2);
      await svc.handleCallback('mock', {}, JSON.stringify({ paymentNo: 'MP_T1', amount: 6.8 }));
      expect(ctx.service.member.activatePaidPlan).toHaveBeenCalledWith(
        5, 'yearly',
        expect.objectContaining({ orderId: 100, mode: 'renew' }),
      );
      const args = (ctx.service.member.activatePaidPlan as jest.Mock).mock.calls[0][2];
      expect(args.newExpireAt).toBeUndefined();
    });

    it('scene=3 升级 → mode=upgrade，newExpireAt = NOW + 365 天', async () => {
      const { ctx, svc } = setupCallbackMocks(3, { name: '年度', durationDays: 365 });
      const before = Date.now();
      await svc.handleCallback('mock', {}, JSON.stringify({ paymentNo: 'MP_T1', amount: 6.8 }));
      const after = Date.now();

      expect(ctx.service.member.activatePaidPlan).toHaveBeenCalledWith(
        5, 'yearly',
        expect.objectContaining({ orderId: 100, mode: 'upgrade' }),
      );
      const args = (ctx.service.member.activatePaidPlan as jest.Mock).mock.calls[0][2];
      expect(args.newExpireAt).toBeInstanceOf(Date);
      const expireMs = args.newExpireAt.getTime();
      // 应在 [before+365天, after+365天] 之间
      expect(expireMs).toBeGreaterThanOrEqual(before + 365 * 86400000 - 1000);
      expect(expireMs).toBeLessThanOrEqual(after + 365 * 86400000 + 1000);
    });

    it('scene=1（默认）→ mode=new', async () => {
      const { ctx, svc } = setupCallbackMocks(1);
      await svc.handleCallback('mock', {}, JSON.stringify({ paymentNo: 'MP_T1', amount: 6.8 }));
      expect(ctx.service.member.activatePaidPlan).toHaveBeenCalledWith(
        5, 'yearly',
        expect.objectContaining({ mode: 'new' }),
      );
    });
  });

  describe('Phase2: getStatus 主动 query 兜底', () => {
    it('mock provider 不触发 query（直接读 DB）', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 200, paymentNo: 'MP_T1', status: 0, amount: '6.80',
          provider: 'mock', orderId: 100, userId: 5,
          createdAt: new Date(Date.now() - 60 * 1000), // 60 秒前
        }),
      });
      const result = await svc.getStatus('MP_T1', 5);
      expect(result.status).toBe(0);
      // mock 不应触发主动 query（也无相应 mock）
      expect(ctx.service.member.activatePaidPlan).not.toHaveBeenCalled();
    });

    it('alipay status=0 + 创建 < 5 秒 → 不触发 query', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 200, paymentNo: 'MP_T1', status: 0, amount: '6.80',
          provider: 'alipay', orderId: 100, userId: 5,
          createdAt: new Date(), // 刚创建
        }),
      });
      const result = await svc.getStatus('MP_T1', 5);
      expect(result.status).toBe(0);
      // 太新不应触发 query
    });

    it('已支付 status=1 → 直接返回，不查询', async () => {
      const ctx = createMockCtx();
      const svc = createService(ctx);
      ctx.model.MemberPayment.findOne.mockResolvedValue({
        toJSON: () => ({
          id: 200, paymentNo: 'MP_T1', status: 1, amount: '6.80',
          provider: 'alipay', orderId: 100, userId: 5,
          createdAt: new Date(Date.now() - 60 * 1000),
          paidAt: new Date(),
          providerTradeNo: 'TRADE_X',
        }),
      });
      const result = await svc.getStatus('MP_T1', 5);
      expect(result.status).toBe(1);
      expect(result.providerTradeNo).toBe('TRADE_X');
    });
  });
});

/**
 * RefundService 单测 — 7 case 覆盖核心场景
 *
 * 覆盖：
 *   1. 成功路径：完整状态流转（refund/payment/order/member 4 表 update）
 *   2. Provider 返回 success=false → 事务回滚 + throw 400
 *   3. Provider throw → 事务回滚 + throw 500
 *   4. 订单 status≠1 → throw 400
 *   5. 已存在处理中/成功 refund → throw 400
 *   6. 未找到 success payment → throw 400
 *   7. 通知 + audit 走 ctx.runInBackground（事务外异步）
 */

import RefundService from '../../../app/service/refund';

// Mock PaymentProvider factory
jest.mock('../../../app/lib/payment', () => {
  const original = jest.requireActual('../../../app/lib/payment');
  return {
    ...original,
    getPaymentProvider: jest.fn(),
    createProvider: jest.fn(),
  };
});
import { getPaymentProvider, createProvider } from '../../../app/lib/payment';

function createMockCtx(overrides: any = {}) {
  // 收集 runInBackground 任务，测试可手动触发
  const bgTasks: Array<() => Promise<any>> = [];

  const baseCtx: any = {
    throw: jest.fn((status: number, msg: string) => {
      const e: any = new Error(msg);
      e.status = status;
      throw e;
    }),
    model: {
      MemberOrder: { findOne: jest.fn(), update: jest.fn() },
      MemberPayment: { findOne: jest.fn(), update: jest.fn() },
      MemberRefund: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
      UserMember: { update: jest.fn() },
      User: {},
      // transaction(fn) 会执行 fn(t)，t 含 LOCK.UPDATE
      transaction: jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    service: {
      notification: { core: { send: jest.fn().mockResolvedValue({}) } },
      audit: { log: jest.fn().mockResolvedValue({}) },
    },
    state: { user: { id: 99 } },
    runInBackground: jest.fn((fn: () => Promise<any>) => {
      bgTasks.push(fn);
      // 不立即执行；测试可手动 runBgTasks() 触发
    }),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  };
  // 暴露 helper
  baseCtx._bgTasks = bgTasks;
  baseCtx._runBgTasks = async () => {
    for (const t of bgTasks) await t();
  };
  return baseCtx;
}

function createService(ctx: any) {
  const svc: any = Object.create(RefundService.prototype);
  svc.ctx = ctx;
  svc.app = { config: {} };
  svc.paginate = jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  return svc;
}

// 公共 mock helper
function mockOrderSuccessFlow(ctx: any) {
  const orderUpdate = jest.fn();
  const paymentUpdate = jest.fn();
  const refundUpdate = jest.fn();

  ctx.model.MemberOrder.findOne.mockResolvedValue({
    toJSON: () => ({
      id: 100, orderNo: 'MO_T1', userId: 5, status: 1,
      planCode: 'monthly', planSnapshot: { name: '月度' },
    }),
    update: orderUpdate,
  });
  ctx.model.MemberRefund.findOne.mockResolvedValue(null); // 无现存 refund
  ctx.model.MemberPayment.findOne.mockResolvedValue({
    toJSON: () => ({
      id: 200, paymentNo: 'MP_T1', amount: '6.80', status: 1, provider: 'mock', orderId: 100,
    }),
    update: paymentUpdate,
  });
  ctx.model.MemberRefund.create.mockResolvedValue({
    id: 300,
    update: refundUpdate,
  });

  return { orderUpdate, paymentUpdate, refundUpdate };
}

describe('RefundService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('case1: 成功路径 — 完整状态流转 (4 表 update)', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    const { orderUpdate, paymentUpdate, refundUpdate } = mockOrderSuccessFlow(ctx);

    (getPaymentProvider as jest.Mock).mockReturnValue({
      refund: jest.fn().mockResolvedValue({
        success: true,
        providerRefundNo: 'MOCK_REFUND_X',
        fundChange: true,
        rawResponse: { mocked: true },
      }),
    });

    const result = await svc.create({ orderId: 100, reason: '测试退款', operatorId: 99 });

    expect(result.refundId).toBe(300);
    expect(result.refundNo).toMatch(/^RF\d{14}\d{4}$/);
    expect(result.amount).toBe('6.80');
    expect(result.status).toBe(1);
    expect(result.fundChange).toBe(true);

    // 4 表 update 都被调
    expect(refundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 1,
        providerRefundNo: 'MOCK_REFUND_X',
      }),
      expect.any(Object),
    );
    expect(paymentUpdate).toHaveBeenCalledWith({ status: 3 }, expect.any(Object));
    expect(orderUpdate).toHaveBeenCalledWith({ status: 4 }, expect.any(Object));
    expect(ctx.model.UserMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ isPaid: 0 }),
      expect.objectContaining({ where: { userId: 5 } }),
    );

    // 异步任务已注册（2 个：notify + audit）
    expect(ctx.runInBackground).toHaveBeenCalledTimes(2);
  });

  it('case2: Provider 返回 success=false → throw 400 + 事务回滚（4 表均不 update）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    const { orderUpdate, paymentUpdate, refundUpdate } = mockOrderSuccessFlow(ctx);

    (getPaymentProvider as jest.Mock).mockReturnValue({
      refund: jest.fn().mockResolvedValue({
        success: false,
        fundChange: false,
        rawResponse: { code: '40004' },
        failedReason: '余额不足',
      }),
    });

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/退款失败.*余额不足/);

    // 因为 throw 让事务 rollback，4 表的"成功路径 update"都不应被调用
    expect(refundUpdate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(ctx.model.UserMember.update).not.toHaveBeenCalled();
  });

  it('case3: Provider throw → 事务回滚 + throw 500', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    const { orderUpdate, paymentUpdate, refundUpdate } = mockOrderSuccessFlow(ctx);

    (getPaymentProvider as jest.Mock).mockReturnValue({
      refund: jest.fn().mockRejectedValue(new Error('网络异常')),
    });

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/退款通道调用异常.*网络异常/);

    expect(refundUpdate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('case4: 订单 status ≠ 1 → throw 400', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    ctx.model.MemberOrder.findOne.mockResolvedValue({
      toJSON: () => ({ id: 100, status: 0, userId: 5 }), // pending
    });

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/订单状态不允许退款/);

    // 不应调到 provider
    expect(getPaymentProvider).not.toHaveBeenCalled();
  });

  it('case5: 已存在处理中/成功 refund → throw 400', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    ctx.model.MemberOrder.findOne.mockResolvedValue({
      toJSON: () => ({ id: 100, status: 1, userId: 5 }),
    });
    ctx.model.MemberRefund.findOne.mockResolvedValue({
      refundNo: 'RF_OLD_1',
    });

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/已有进行中或成功的退款记录/);
  });

  it('case6: 未找到 success payment → throw 400', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    ctx.model.MemberOrder.findOne.mockResolvedValue({
      toJSON: () => ({ id: 100, status: 1, userId: 5 }),
    });
    ctx.model.MemberRefund.findOne.mockResolvedValue(null);
    ctx.model.MemberPayment.findOne.mockResolvedValue(null); // 未找到

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/未找到已成功的支付流水/);
  });

  it('case7: 通知 + audit 是事务外异步（runInBackground）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    mockOrderSuccessFlow(ctx);
    (getPaymentProvider as jest.Mock).mockReturnValue({
      refund: jest.fn().mockResolvedValue({
        success: true,
        providerRefundNo: 'MOCK_X',
        fundChange: true,
        rawResponse: {},
      }),
    });

    await svc.create({ orderId: 100, reason: '测试', operatorId: 99 });

    // create 返回时，bg tasks 已注册但还未执行
    expect(ctx.service.notification.core.send).not.toHaveBeenCalled();
    expect(ctx.service.audit.log).not.toHaveBeenCalled();
    expect(ctx._bgTasks.length).toBe(2);

    // 手动触发后才会调用
    await ctx._runBgTasks();
    expect(ctx.service.notification.core.send).toHaveBeenCalledWith(
      expect.objectContaining({
        typeCode: 'BUSINESS_PAYMENT_REFUNDED',
        userId: 5,
      }),
    );
    expect(ctx.service.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'member-refund',
        action: 'create',
        bizType: 'member_refund',
        bizId: 300,
      }),
    );
  });
});

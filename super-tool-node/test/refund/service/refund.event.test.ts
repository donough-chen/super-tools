/**
 * RefundService 业务事件埋点单测（B9 / spec §2.12-#34）
 *
 * 覆盖：
 *   1. 退款成功 → 在事务外 runInBackground 中调用 event.emit('refund_completed', ...)
 *   2. emit 失败不影响主流程（warn 日志 + result 仍正常返回）
 *   3. emit 在 refundPoints runInBackground 之后注册（独立 bg 块）
 *
 * 测试约束：
 *   - 不依赖真实 DB / 真实 EventService；用 jest mock 验证 emit 调用
 *   - emit 在 runInBackground 内 → 必须 _runBgTasks() 后才会触发 mock
 */

import RefundService from '../../../app/service/refund';
import { EVENT_CODES } from '../../../app/lib/eventCodes';

jest.mock('../../../app/lib/payment', () => {
  const original = jest.requireActual('../../../app/lib/payment');
  return {
    ...original,
    getPaymentProvider: jest.fn(),
    createProvider: jest.fn(),
  };
});
import { getPaymentProvider } from '../../../app/lib/payment';

function createMockCtx() {
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
      PointsLog: { findOne: jest.fn().mockResolvedValue(null) }, // 让 refundPoints bg 块走 null 分支（不调 member.refundPoints）
      User: {},
      transaction: jest.fn(async (fn: any) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    service: {
      notification: { core: { send: jest.fn().mockResolvedValue({}) } },
      audit: { log: jest.fn().mockResolvedValue({}) },
      event: { emit: jest.fn().mockResolvedValue(undefined) },
      member: { refundPoints: jest.fn().mockResolvedValue(undefined) },
    },
    state: { user: { id: 99 } },
    runInBackground: jest.fn((fn: () => Promise<any>) => { bgTasks.push(fn); }),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
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
  svc.paginate = jest.fn();
  return svc;
}

function mockSuccessFlow(ctx: any, opts: { amount?: string; orderAmount?: string } = {}) {
  const amount = opts.amount || '6.80';
  const orderAmount = opts.orderAmount || '6.80';

  ctx.model.MemberOrder.findOne.mockResolvedValue({
    toJSON: () => ({
      id: 100,
      orderNo: 'MO_E1',
      userId: 5,
      status: 1,
      amount: orderAmount,
      planCode: 'monthly',
      planSnapshot: { name: '月度' },
    }),
    update: jest.fn(),
  });
  ctx.model.MemberRefund.findOne.mockResolvedValue(null);
  ctx.model.MemberPayment.findOne.mockResolvedValue({
    toJSON: () => ({ id: 200, paymentNo: 'MP_E1', amount, status: 1, provider: 'mock', orderId: 100 }),
    update: jest.fn(),
  });
  ctx.model.MemberRefund.create.mockResolvedValue({
    id: 300,
    update: jest.fn(),
  });
  (getPaymentProvider as jest.Mock).mockReturnValue({
    refund: jest.fn().mockResolvedValue({
      success: true,
      providerRefundNo: 'MOCK_E_X',
      fundChange: true,
      rawResponse: { ok: true },
    }),
  });
}

describe('RefundService — refund_completed 事件埋点', () => {
  beforeEach(() => jest.clearAllMocks());

  it('case1: 退款成功后注册 4 个 bg 任务（notify + audit + refundPoints + emit）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    mockSuccessFlow(ctx);

    await svc.create({ orderId: 100, reason: '测试退款', operatorId: 99 });

    // 4 个 bg 任务已注册但尚未执行
    expect(ctx._bgTasks.length).toBe(4);
    expect(ctx.service.event.emit).not.toHaveBeenCalled();
  });

  it('case2: 触发 bg 后 event.emit 被以 refund_completed + 完整 payload 调用', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    mockSuccessFlow(ctx, { amount: '6.80', orderAmount: '6.80' });

    await svc.create({ orderId: 100, reason: '测试退款', operatorId: 99 });
    await ctx._runBgTasks();

    expect(ctx.service.event.emit).toHaveBeenCalledTimes(1);
    expect(ctx.service.event.emit).toHaveBeenCalledWith(
      EVENT_CODES.REFUND_COMPLETED,
      expect.objectContaining({
        userId: 5,
        orderId: 100,
        orderNo: 'MO_E1',
        refundId: 300,
        refundAmount: 6.80,
        refundNo: expect.stringMatching(/^RF\d{14}\d{4}$/),
      }),
    );
  });

  it('case3: emit 抛错不影响主流程（warn 日志 + 主结果仍正常）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    mockSuccessFlow(ctx);

    ctx.service.event.emit.mockRejectedValue(new Error('event svc down'));

    const result = await svc.create({ orderId: 100, reason: '测试', operatorId: 99 });
    await ctx._runBgTasks();

    // 主流程结果未受影响
    expect(result.refundId).toBe(300);
    expect(result.status).toBe(1);
    // event.emit 失败被 catch 转 warn
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/event emit refund_completed failed.*event svc down/),
    );
  });

  it('case4: 退款失败路径（provider success=false） → 不应 emit refund_completed', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    mockSuccessFlow(ctx);
    (getPaymentProvider as jest.Mock).mockReturnValue({
      refund: jest.fn().mockResolvedValue({
        success: false,
        fundChange: false,
        rawResponse: { code: 'ERR' },
        failedReason: '余额不足',
      }),
    });

    await expect(svc.create({ orderId: 100, reason: '测试', operatorId: 99 }))
      .rejects.toThrow(/退款失败/);

    // 失败路径下 bg 任务都不应注册
    expect(ctx._bgTasks.length).toBe(0);
    expect(ctx.service.event.emit).not.toHaveBeenCalled();
  });
});

import BaseService from './base';
import { ProviderCode, createProvider, getPaymentProvider } from '../lib/payment';

interface CreatePaymentInput {
  orderId: number;
  userId: number;
  provider: ProviderCode;
}

export default class PaymentService extends BaseService {
  /** 创建支付（用户在 H5 选完支付方式后调用） */
  async create(input: CreatePaymentInput) {
    const { orderId, userId, provider } = input;

    const order = await this.ctx.model.MemberOrder.findOne({
      where: { id: orderId, userId },
    });
    if (!order) this.ctx.throw(404, '订单不存在');
    const orderData = (order as any).toJSON();
    if (orderData.status !== 0) this.ctx.throw(400, `订单状态不允许支付（当前 ${orderData.status}）`);
    if (new Date(orderData.expireAt) < new Date()) {
      await (order as any).update({ status: 3 });
      this.ctx.throw(400, '订单已过期，请重新下单');
    }

    const existedSuccess = await this.ctx.model.MemberPayment.findOne({
      where: { orderId, status: 1 },
    });
    if (existedSuccess) this.ctx.throw(400, '订单已支付');

    const paymentNo = this._genPaymentNo();
    const payment = await this.ctx.model.MemberPayment.create({
      paymentNo,
      orderId,
      userId,
      provider,
      amount: orderData.amount,
      status: 0,
    });

    // Phase 2：alipay 等真实通道走 createProvider(name, ctx)；mock/wechat 占位继续走 getPaymentProvider
    const providerImpl = provider === 'mock'
      ? getPaymentProvider(provider)
      : createProvider(provider, this.ctx);
    const baseUrl = (this.app.config as any).appConfig?.baseUrl || 'http://localhost:7001';
    const notifyUrl = `${baseUrl}/api/payments/${provider}/notify`;
    const prepayResult = await providerImpl.createPrepay({
      paymentNo,
      amount: Number(orderData.amount),
      subject: `${orderData.planSnapshot?.name || orderData.planCode} 会员订阅`,
      planName: orderData.planSnapshot?.name,
      userId,
      notifyUrl,
    });

    await (payment as any).update({ prepayData: prepayResult.prepayData });

    return {
      paymentNo,
      paymentId: (payment as any).id,
      provider,
      prepayData: prepayResult.prepayData,
      cashierUrl: prepayResult.cashierUrl,
    };
  }

  /**
   * 处理支付成功回调（统一入口）— Phase 2 适配新 mode
   * 关键：行级锁 + 状态机校验 + 事务，确保多次回调幂等
   */
  async handleCallback(provider: ProviderCode, headers: Record<string, string>, rawBody: string) {
    const providerImpl = provider === 'mock'
      ? getPaymentProvider(provider)
      : createProvider(provider, this.ctx);
    const verify = await providerImpl.verifyCallback(headers, rawBody);
    if (!verify.success) {
      this.ctx.logger.warn(`[payment.handleCallback] verify failed: ${verify.error}`);
      this.ctx.throw(400, `支付回调验签失败: ${verify.error}`);
    }

    const payment = await this.ctx.model.MemberPayment.findOne({
      where: { paymentNo: verify.paymentNo },
    });
    if (!payment) this.ctx.throw(404, '支付流水不存在');
    const paymentData = (payment as any).toJSON();

    // 幂等
    if (paymentData.status === 1) {
      return { success: true, skipped: true };
    }

    // 金额校验
    if (Math.abs(Number(paymentData.amount) - verify.amount) > 0.001) {
      this.ctx.throw(400, `金额不一致：期望 ${paymentData.amount}，回调 ${verify.amount}`);
    }

    await this._applyPaymentSuccess(payment, verify.providerTradeNo, verify.rawPayload);

    return { success: true, skipped: false };
  }

  /**
   * 私有方法：应用支付成功（事务 + 状态机 + 激活会员 + 通知）
   * 由 handleCallback 与 getStatus 主动 query 兜底共用
   */
  private async _applyPaymentSuccess(
    payment: any,
    providerTradeNo: string,
    callbackPayload?: any,
  ) {
    const paymentData = payment.toJSON ? payment.toJSON() : payment;

    // 事务：行级锁 + 状态机更新
    let orderForActivation: any = null;
    await this.ctx.model.transaction(async (t: any) => {
      const lockedPayment = await this.ctx.model.MemberPayment.findOne({
        where: { id: paymentData.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if ((lockedPayment as any).status === 1) return;

      const lockedOrder = await this.ctx.model.MemberOrder.findOne({
        where: { id: paymentData.orderId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      await (lockedPayment as any).update({
        status: 1,
        providerTradeNo,
        callbackPayload: callbackPayload || { source: 'query' },
        paidAt: new Date(),
      }, { transaction: t });

      await (lockedOrder as any).update({
        status: 1,
        paidAt: new Date(),
      }, { transaction: t });

      orderForActivation = (lockedOrder as any).toJSON();
    });

    if (!orderForActivation) return;

    // Phase 2：根据 order.scene 决定 mode
    // scene=1 新购→'new' / scene=2 续费→'renew' / scene=3 升级→'upgrade'
    // (scene=4 降级 amount=0，在 order.create 时已激活，不会走到此)
    const mode: 'new' | 'renew' | 'upgrade' =
      orderForActivation.scene === 3 ? 'upgrade'
        : orderForActivation.scene === 2 ? 'renew'
          : 'new';

    // scene=3 升级时：以"支付成功时刻"为新 expireAt 起点（spec § 4.7 NOW 基准）
    let newExpireAt: Date | undefined;
    if (mode === 'upgrade') {
      const planSnap = orderForActivation.planSnapshot;
      const durationDays = Number(planSnap?.durationDays) || 0;
      if (durationDays > 0) {
        newExpireAt = new Date(Date.now() + durationDays * 86400000);
      }
    }

    // 在事务外调 activatePaidPlan（其内部含独立通知）
    await this.ctx.service.member.activatePaidPlan(
      paymentData.userId,
      orderForActivation.planCode,
      {
        orderId: orderForActivation.id,
        mode,
        newExpireAt,
      },
    );

    // 触发支付成功通知
    try {
      const updatedMember = await this.ctx.model.UserMember.findOne({
        where: { userId: paymentData.userId },
      });
      const expireAt = (updatedMember as any)?.paidExpireAt
        ? new Date((updatedMember as any).paidExpireAt).toISOString().slice(0, 10)
        : '永久';
      await (this.ctx.service.notification as any).core.send({
        typeCode: 'BUSINESS_PAYMENT_SUCCESS',
        userId: paymentData.userId,
        variables: {
          orderNo: orderForActivation.orderNo,
          planName: orderForActivation.planSnapshot?.name || orderForActivation.planCode,
          amount: Number(orderForActivation.amount).toFixed(2),
          expireAt,
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[payment._applyPaymentSuccess] payment_success notification failed: ${e.message}`);
    }
  }

  /** 处理支付失败 */
  async markFailed(paymentNo: string, reason: string) {
    const payment = await this.ctx.model.MemberPayment.findOne({ where: { paymentNo } });
    if (!payment) this.ctx.throw(404, '支付流水不存在');
    if ((payment as any).status === 1) return;

    await (payment as any).update({ status: 2, failedReason: reason });

    const order = await this.ctx.model.MemberOrder.findByPk((payment as any).orderId);
    try {
      await (this.ctx.service.notification as any).core.send({
        typeCode: 'BUSINESS_PAYMENT_FAIL',
        userId: (payment as any).userId,
        variables: {
          orderNo: (order as any)?.orderNo || '',
          reason,
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[payment.markFailed] notification failed: ${e.message}`);
    }
  }

  /**
   * 查支付状态（前端轮询用）— Phase 2 加主动 query 兜底
   *
   * 双轨制：
   *   1. 优先读 DB（webhook 已写入 → 直接返回）
   *   2. status=0 + 非 mock + 创建后 ≥5 秒 → 调 provider.queryStatus 主动查
   *      - 'success' → 走 _applyPaymentSuccess（与 webhook 同路径）
   *      - 'failed' → markFailed
   *      - 'pending' / 'unknown' → 维持 status=0
   */
  async getStatus(paymentNo: string, userId: number) {
    let payment = await this.ctx.model.MemberPayment.findOne({
      where: { paymentNo, userId },
    });
    if (!payment) this.ctx.throw(404, '支付流水不存在');
    let data = (payment as any).toJSON();

    // 主动 query 兜底
    const ageSeconds = data.createdAt
      ? (Date.now() - new Date(data.createdAt).getTime()) / 1000
      : 0;
    if (data.status === 0 && data.provider !== 'mock' && ageSeconds >= 5) {
      try {
        const providerImpl = createProvider(data.provider as ProviderCode, this.ctx);
        const q = await providerImpl.queryStatus(data.paymentNo);
        if (q.status === 'success' && q.providerTradeNo) {
          await this._applyPaymentSuccess(payment, q.providerTradeNo, { source: 'query', raw: q.raw });
          payment = await this.ctx.model.MemberPayment.findOne({ where: { paymentNo, userId } });
          data = (payment as any).toJSON();
        } else if (q.status === 'failed') {
          await this.markFailed(paymentNo, '通道返回 TRADE_CLOSED');
          payment = await this.ctx.model.MemberPayment.findOne({ where: { paymentNo, userId } });
          data = (payment as any).toJSON();
        }
        // pending / unknown：维持 status=0，前端继续轮询
      } catch (e: any) {
        this.ctx.logger.warn(`[payment.getStatus] active query failed: ${e.message}`);
        // query 失败不影响 DB 读取结果
      }
    }

    return {
      id: data.id,
      paymentNo: data.paymentNo,
      orderId: data.orderId,
      provider: data.provider,
      providerTradeNo: data.providerTradeNo,
      amount: data.amount,
      status: data.status,
      paidAt: data.paidAt,
      failedReason: data.failedReason,
      createdAt: data.createdAt,
    };
  }

  private _genPaymentNo(): string {
    const now = new Date();
    const ymd = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');
    return `MP${ymd}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }
}

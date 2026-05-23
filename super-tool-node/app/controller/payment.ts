import BaseController from './base';

/**
 * C 端支付 Controller
 * 路由前缀: /api/payments
 */
export default class PaymentController extends BaseController {
  /** POST /api/payments — 创建支付 */
  async create() {
    this.validate({
      orderId: { type: 'number', required: true },
      provider: { type: 'string', required: true },
    });
    const userId = (this.ctx.state.user as any).id;
    const { orderId, provider } = this.ctx.request.body;
    const data = await this.service.payment.create({ orderId, userId, provider });
    this.success(data, '已生成支付订单');
  }

  /** GET /api/payments/:paymentNo/status — 查询支付状态（前端轮询） */
  async status() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.payment.getStatus(this.ctx.params.paymentNo, userId);
    this.success(data);
  }

  /**
   * POST /api/payments/mock/notify — Mock 内部回调（不挂 auth）
   * Body: { paymentNo, amount, providerTradeNo?, status?: 'success'|'failed', failReason? }
   *
   * 默认 status='success'：调 PaymentService.handleCallback('mock', ...)
   * status='failed'：调 markFailed
   */
  async mockNotify() {
    const body = this.ctx.request.body as any;
    if (!body.paymentNo) this.ctx.throw(400, 'paymentNo required');

    if (body.status === 'failed') {
      await this.service.payment.markFailed(body.paymentNo, body.failReason || '用户取消支付');
      this.success({ accepted: true });
      return;
    }

    const rawBody = JSON.stringify({
      paymentNo: body.paymentNo,
      amount: body.amount,
      providerTradeNo: body.providerTradeNo,
    });
    const result = await this.service.payment.handleCallback(
      'mock',
      this.ctx.request.headers as any,
      rawBody,
    );
    this.success(result);
  }

  /**
   * POST /api/payments/wechat/notify — 真实微信回调（占位，本 MVP 不实装）
   * 接入时移除 throw 501 并改为：
   *   const rawBody = ...; (Egg 默认会解析 body，需读 raw body)
   *   const result = await this.service.payment.handleCallback('wechat_jsapi', this.ctx.request.headers, rawBody);
   *   this.ctx.body = { code: 'SUCCESS', message: 'OK' };  // 微信约定的 ACK 格式
   */
  async wechatNotify() {
    this.ctx.throw(501, '微信支付未接入');
  }

  /**
   * POST /api/payments/alipay/notify — Alipay 异步通知（公开，无需 auth）
   *
   * Alipay 要求：
   *   - 收到通知后必须返回纯文本 'success'，否则会重试 8 次（间隔逐次拉长）
   *   - 验签失败也要 catch 内返回 'fail'，让 alipay 后续重试或停止重试
   *   - rawBody 是 application/x-www-form-urlencoded
   */
  async alipayNotify() {
    const rawBody = (this.ctx.request as any).rawBody || '';
    try {
      await this.service.payment.handleCallback(
        'alipay',
        this.ctx.request.headers as any,
        rawBody,
      );
      // 重要：alipay 必须收到纯文本 'success'，不能是 JSON
      this.ctx.body = 'success';
    } catch (e: any) {
      this.ctx.logger.error('[alipayNotify] handle callback failed:', e);
      this.ctx.body = 'fail';
    }
  }

  /**
   * GET /api/payments/alipay/return — Alipay 同步跳转（用户支付后浏览器跳回）
   *
   * Alipay 把 out_trade_no 等字段附在 query 上。本端做的事：
   *   1. 根据 out_trade_no（即 paymentNo）找到 payment 记录
   *   2. 重定向到 H5 订单详情页（让前端轮询 status，看到最新状态）
   *
   * 不做验签 / 不调 handleCallback —— 这些都靠异步通知 / 主动 query 兜底完成。
   */
  async alipayReturn() {
    const { out_trade_no } = this.ctx.query;
    const h5Base = (this.ctx.app.config as any).h5BaseUrl || '';

    if (out_trade_no) {
      const payment = await this.ctx.model.MemberPayment.findOne({
        where: { paymentNo: out_trade_no as string },
      });
      if (payment) {
        this.ctx.redirect(`${h5Base}/member/orders/${(payment as any).orderId}`);
        return;
      }
    }
    // fallback：跳到 H5 首页
    this.ctx.redirect(h5Base || '/');
  }

  /**
   * GET /api/payments/providers — 启用的支付通道列表（公开，无需 auth）
   *
   * 来源：system_configs.payment.enabled_providers（JSON 字符串）
   * H5 收银台会按此返回值渲染单选按钮（mock=开发期 / alipay=真实通道）
   */
  async listProviders() {
    const config = await (this.ctx.model as any).SystemConfig.findOne({
      where: { group: 'payment', key: 'enabled_providers' },
    });
    let providers: string[] = ['mock'];
    if (config) {
      try {
        const parsed = JSON.parse((config as any).value);
        if (Array.isArray(parsed)) providers = parsed;
      } catch (e: any) {
        this.ctx.logger.warn(`[listProviders] parse enabled_providers failed: ${e.message}`);
      }
    }
    this.success({ providers });
  }
}

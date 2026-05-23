import { AlipaySdk } from 'alipay-sdk';
import {
  PaymentProvider,
  PrepayInput, PrepayResult,
  VerifyResult,
  QueryStatusOutput,
  RefundInput, RefundResult,
} from './provider';

/**
 * AlipayProvider 配置
 *
 * 公开字段（appId/gateway/signType/notifyUrl/returnUrl）来自 system_configs.payment.alipay_*；
 * 密钥（privateKey/alipayPublicKey）必须来自 .env.local（不上 git，不入库）。
 */
export interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  signType?: 'RSA2' | 'RSA';
  notifyUrl?: string;
  returnUrl?: string;
}

/**
 * AlipayProvider — 支付宝沙箱实装（Q1=A wap.pay）
 *
 * 4 个方法：
 *   - createPrepay: alipay.trade.wap.pay 拿跳转 URL（H5 收银台）
 *   - verifyCallback: 异步通知验签 + trade_status 校验
 *   - queryStatus: alipay.trade.query 主动查询（双轨制兜底）
 *   - refund: alipay.trade.refund 退款
 */
export class AlipayProvider implements PaymentProvider {
  readonly code = 'alipay' as const;
  private sdk: AlipaySdk;
  private cfg: AlipayConfig;

  constructor(cfg: AlipayConfig) {
    if (!cfg.appId || !cfg.privateKey || !cfg.alipayPublicKey) {
      throw new Error('AlipayProvider 缺少必要配置（appId/privateKey/alipayPublicKey）');
    }
    this.cfg = cfg;
    this.sdk = new AlipaySdk({
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      alipayPublicKey: cfg.alipayPublicKey,
      gateway: cfg.gateway,
      signType: cfg.signType || 'RSA2',
      timeout: 10000,
      camelcase: true,
    });
  }

  /**
   * 创建支付：调 alipay.trade.wap.pay 拿跳转 URL
   * 用户在 H5 收银台点击"去支付"后跳转到此 URL，沙箱会模拟支付页面
   */
  async createPrepay(input: PrepayInput): Promise<PrepayResult> {
    const bizContent = {
      out_trade_no: input.paymentNo,
      total_amount: Number(input.amount).toFixed(2),
      subject: input.subject || `${input.planName || '会员'} 订阅`,
      product_code: 'QUICK_WAP_WAY',
      timeout_express: '30m',
    };
    const url = this.sdk.pageExec('alipay.trade.wap.pay', {
      bizContent,
      method: 'GET',
      notifyUrl: this.cfg.notifyUrl || input.notifyUrl,
      returnUrl: this.cfg.returnUrl,
    } as any);
    return {
      provider: 'alipay',
      prepayData: { url, bizContent },
      cashierUrl: url,
    };
  }

  /**
   * 异步通知验签：rawBody 为 application/x-www-form-urlencoded
   * - 验签失败 / trade_status 非 SUCCESS 都返回 success=false
   */
  async verifyCallback(_headers: Record<string, string>, rawBody: string): Promise<VerifyResult> {
    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });

    const signOk = this.sdk.checkNotifySignV2(params);
    if (!signOk) {
      return {
        success: false,
        paymentNo: params.out_trade_no || '',
        providerTradeNo: params.trade_no || '',
        amount: 0,
        rawPayload: params,
        error: 'signature mismatch',
      };
    }
    if (params.trade_status !== 'TRADE_SUCCESS' && params.trade_status !== 'TRADE_FINISHED') {
      return {
        success: false,
        paymentNo: params.out_trade_no || '',
        providerTradeNo: params.trade_no || '',
        amount: Number(params.total_amount) || 0,
        rawPayload: params,
        error: `bad trade_status: ${params.trade_status}`,
      };
    }
    return {
      success: true,
      paymentNo: params.out_trade_no,
      providerTradeNo: params.trade_no,
      amount: Number(params.total_amount),
      rawPayload: params,
    };
  }

  /**
   * 主动查询：alipay.trade.query
   * 4 状态映射：TRADE_SUCCESS/FINISHED→success / WAIT_BUYER_PAY→pending / TRADE_CLOSED→failed / 其他→unknown
   */
  async queryStatus(paymentNo: string): Promise<QueryStatusOutput> {
    const res: any = await this.sdk.exec('alipay.trade.query', {
      bizContent: { out_trade_no: paymentNo },
    });
    if (!res || res.code !== '10000') {
      return { status: 'unknown', raw: res };
    }
    let status: 'success' | 'pending' | 'failed' | 'unknown' = 'unknown';
    if (res.tradeStatus === 'TRADE_SUCCESS' || res.tradeStatus === 'TRADE_FINISHED') {
      status = 'success';
    } else if (res.tradeStatus === 'WAIT_BUYER_PAY') {
      status = 'pending';
    } else if (res.tradeStatus === 'TRADE_CLOSED') {
      status = 'failed';
    }
    return {
      status,
      providerTradeNo: res.tradeNo,
      amount: res.totalAmount ? Number(res.totalAmount) : undefined,
      raw: res,
    };
  }

  /**
   * 退款：alipay.trade.refund
   * - code !== 10000 视为失败
   * - fundChange = 'Y' 视为资金已退；'N' 视为请求受理但未实际退
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    const res: any = await this.sdk.exec('alipay.trade.refund', {
      bizContent: {
        out_trade_no: input.paymentNo,
        refund_amount: input.amount.toFixed(2),
        out_request_no: input.refundNo,
        refund_reason: input.reason || '用户申请退款',
      },
    });
    if (!res || res.code !== '10000') {
      return {
        success: false,
        fundChange: false,
        rawResponse: res,
        failedReason: res?.subMsg || res?.msg || 'alipay refund failed',
      };
    }
    return {
      success: true,
      providerRefundNo: res.tradeNo,
      fundChange: res.fundChange === 'Y',
      rawResponse: res,
    };
  }
}

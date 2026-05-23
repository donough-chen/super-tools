import {
  PaymentProvider, PrepayInput, PrepayResult, VerifyResult,
  QueryStatusOutput, RefundResult,
} from './provider';

/**
 * WechatNativeProvider — 微信 Native（扫码）支付（占位，本 MVP 不实装）
 *
 * 接入 TODO：
 *   1. 同 wechat-jsapi 商户号要求
 *   2. createPrepay: POST /v3/pay/transactions/native 拿 code_url（二维码 URL）
 *   3. 前端把 code_url 渲染成二维码（如 qrcode.react）让用户扫
 *   4. verifyCallback / queryStatus 实现同 wechat-jsapi
 */
export class WechatNativeProvider implements PaymentProvider {
  readonly code = 'wechat_native' as const;

  async createPrepay(_input: PrepayInput): Promise<PrepayResult> {
    throw new Error(
      'NotImplemented: 微信 Native 扫码支付待接入。' +
      '需要：商户号 + AppID + APIv3 密钥 + 平台证书 + IP 白名单 + 内网穿透回调。',
    );
  }

  async verifyCallback(): Promise<VerifyResult> {
    throw new Error('NotImplemented: WechatNativeProvider.verifyCallback');
  }

  async queryStatus(): Promise<QueryStatusOutput> {
    throw new Error('NotImplemented: WechatNativeProvider.queryStatus');
  }

  async refund(): Promise<RefundResult> {
    throw new Error('NotImplemented: WechatNativeProvider.refund');
  }
}

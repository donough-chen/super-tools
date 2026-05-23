import {
  PaymentProvider, PrepayInput, PrepayResult, VerifyResult,
  QueryStatusOutput, RefundResult,
} from './provider';

/**
 * WechatJsapiProvider — 微信 JSAPI 支付（占位，本 MVP 不实装）
 *
 * 接入 TODO：
 *   1. 商户号 + AppID + APIv3 密钥 + 平台证书 + IP 白名单 + 内网穿透回调
 *   2. createPrepay: POST /v3/pay/transactions/jsapi 拿 prepay_id
 *   3. verifyCallback: 用 Wechatpay-Signature 验签 + AEAD-AES-256-GCM 解密
 *   4. queryStatus: GET /v3/pay/transactions/out-trade-no/{paymentNo}
 *   5. 前端 H5 收银台改用 WeixinJSBridge.invoke('getBrandWCPayRequest', prepayData)
 */
export class WechatJsapiProvider implements PaymentProvider {
  readonly code = 'wechat_jsapi' as const;

  async createPrepay(_input: PrepayInput): Promise<PrepayResult> {
    throw new Error(
      'NotImplemented: 微信 JSAPI 支付待接入。' +
      '需要：商户号 + AppID + APIv3 密钥 + 平台证书 + IP 白名单 + 内网穿透回调。',
    );
  }

  async verifyCallback(): Promise<VerifyResult> {
    throw new Error('NotImplemented: WechatJsapiProvider.verifyCallback');
  }

  async queryStatus(): Promise<QueryStatusOutput> {
    throw new Error('NotImplemented: WechatJsapiProvider.queryStatus');
  }

  async refund(): Promise<RefundResult> {
    throw new Error('NotImplemented: WechatJsapiProvider.refund');
  }
}

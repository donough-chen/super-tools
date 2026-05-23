import { PaymentProvider, ProviderCode } from './provider';
import { MockProvider } from './mock';
import { WechatJsapiProvider } from './wechat-jsapi';
import { WechatNativeProvider } from './wechat-native';
import { AlipayProvider } from './alipay';

/**
 * PaymentProvider 工厂
 *
 * 业务代码用法（无 ctx 时）：
 *   const provider = getPaymentProvider('mock');
 *
 * 需要 ctx 时（alipay 等真实 provider）：
 *   const provider = createProvider('alipay', ctx);
 */

const stateless: Record<ProviderCode, () => PaymentProvider> = {
  mock: () => new MockProvider(),
  wechat_jsapi: () => new WechatJsapiProvider(),
  wechat_native: () => new WechatNativeProvider(),
  // alipay 需要 ctx，这里抛错引导走 createProvider(ctx)
  alipay: () => {
    throw new Error('Alipay 需要通过 createProvider(name, ctx) 构造（依赖 ctx.app.config.alipay）');
  },
};

/**
 * 无 ctx 创建（仅适用 mock / wechat 占位）
 * @deprecated 推荐用 createProvider(name, ctx)
 */
export function getPaymentProvider(code: ProviderCode): PaymentProvider {
  const factory = stateless[code];
  if (!factory) throw new Error(`Unknown payment provider: ${code}`);
  return factory();
}

/**
 * 标准入口：根据 ctx 创建 provider
 *
 * 配置来源（Q3=C 混合）：
 *   - 公开字段：ctx.app.config.alipay.{appId,gateway,signType,notifyUrl,returnUrl}
 *     由 config.default.ts 从 system_configs 加载
 *   - 密钥字段：ctx.app.config.alipay.{merchantPrivateKey,publicKey}
 *     由 .env.local 注入（不上 git）
 */
export function createProvider(name: ProviderCode, ctx: any): PaymentProvider {
  if (name === 'mock') return new MockProvider();
  if (name === 'alipay') {
    const cfg = (ctx?.app?.config?.alipay) || {};
    return new AlipayProvider({
      appId: cfg.appId,
      privateKey: cfg.merchantPrivateKey || cfg.privateKey,
      alipayPublicKey: cfg.publicKey || cfg.alipayPublicKey,
      gateway: cfg.gateway,
      signType: cfg.signType,
      notifyUrl: cfg.notifyUrl,
      returnUrl: cfg.returnUrl,
    });
  }
  if (name === 'wechat_jsapi') throw new Error('wechat_jsapi 暂未接入');
  if (name === 'wechat_native') throw new Error('wechat_native 暂未接入');
  throw new Error(`Unknown payment provider: ${name}`);
}

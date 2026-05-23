/**
 * PaymentProvider 适配器接口
 *
 * 设计目标：业务代码（OrderService/PaymentService）零改动地支持多种支付渠道。
 * 当前实装：MockProvider（开发期）+ AlipayProvider（沙箱实装）+ Wechat 占位
 *
 * Phase 2 扩展：
 *   - PaymentProvider.refund() 退款方法
 *   - QueryStatusOutput 改为详细对象（替代之前的字符串字面量）
 */

export type ProviderCode = 'mock' | 'wechat_jsapi' | 'wechat_native' | 'alipay';

/** 创建预支付订单的入参 */
export interface PrepayInput {
  paymentNo: string;        // 内部支付流水号
  amount: number;           // 金额（元，DECIMAL）
  subject: string;          // 订单标题（例如 "月度会员"）
  userId: number;
  notifyUrl: string;        // 完整回调 URL
  /** 套餐名（可选，用于 alipay subject 美化等） */
  planName?: string;
  extra?: Record<string, any>;
}

/** 创建预支付订单的返回 */
export interface PrepayResult {
  prepayData: Record<string, any>;  // provider 特定的预支付参数
  cashierUrl?: string;              // 可选：跳转收银台 URL
  /** 实际生效的 provider code（透传，便于审计） */
  provider?: ProviderCode;
}

/** 验签 + 解密回调的返回 */
export interface VerifyResult {
  /** 主结果：true = 验签 + 状态都 OK */
  success: boolean;
  paymentNo: string;                  // 从回调中解出的内部 paymentNo
  providerTradeNo: string;            // provider 的交易号
  amount: number;
  rawPayload: Record<string, any>;    // 原始回调体
  error?: string;                     // 失败原因
}

/** 主动查询单笔交易状态 */
export interface QueryStatusOutput {
  /**
   * pending  = 用户尚未支付（或正在等待）
   * success  = 已支付成功
   * failed   = 已关闭/失败
   * unknown  = 接口异常 / 状态无法识别
   */
  status: 'pending' | 'success' | 'failed' | 'unknown';
  providerTradeNo?: string;
  amount?: number;
  raw?: any;
}

/** 退款入参 */
export interface RefundInput {
  paymentNo: string;        // 内部支付流水号（对应 alipay 的 out_trade_no）
  refundNo: string;         // 内部退款单号（对应 alipay 的 out_request_no）
  amount: number;           // 退款金额（元）
  totalAmount: number;      // 该笔交易总金额（元，部分 provider 校验用）
  reason?: string;          // 退款原因
}

/** 退款返回 */
export interface RefundResult {
  /** 接口调用是否成功 */
  success: boolean;
  /** 通道退款单号（成功时） */
  providerRefundNo?: string;
  /**
   * 资金是否已到账：
   *   true  = 资金已退（fundChange=Y）
   *   false = 请求受理但未实际退（fundChange=N）或失败
   */
  fundChange: boolean;
  /** 通道原始响应 */
  rawResponse: any;
  /** 失败原因（success=false 时） */
  failedReason?: string;
}

/** 支付适配器接口 */
export interface PaymentProvider {
  readonly code: ProviderCode;
  createPrepay(input: PrepayInput): Promise<PrepayResult>;
  verifyCallback(headers: Record<string, string>, rawBody: string): Promise<VerifyResult>;
  queryStatus(paymentNo: string): Promise<QueryStatusOutput>;
  /** Phase 2 新增：退款 */
  refund(input: RefundInput): Promise<RefundResult>;
}

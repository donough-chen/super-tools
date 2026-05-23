/**
 * 订单 / 支付 / 套餐 类型定义（前端）
 * 与后端 member_orders / member_payments / paid_plans 保持字段对齐。
 *
 * Phase 2 扩展：
 *   - OrderScene 由 1|2 扩展为 1|2|3|4
 *   - OrderListItem 加 sourcePlanCode / sourceRemainingValue
 *   - Order 详情含 refunds[]
 *   - 新增 PaymentProvider / CreateOrderResult / OrderPreviewResult / Refund
 */

/** 付费套餐 */
export interface PaidPlan {
  id: number;
  name: string;
  code: string;
  durationDays: number;
  price: string;
  originalPrice: string;
  benefits?: Record<string, any>;
  giftPoints: number;
  giftGrowth: number;
  description?: string;
  sort: number;
  status: 0 | 1;
}

/** 订单状态：0=待支付 1=已支付 2=已取消 3=已超时 4=已退款 */
export type OrderStatus = 0 | 1 | 2 | 3 | 4;

/** 支付状态：0=待支付 1=成功 2=失败 3=已退款 */
export type PaymentStatus = 0 | 1 | 2 | 3;

/** 支付通道（Phase 2） */
export type PaymentProvider = 'mock' | 'alipay';

/** 订单场景（Phase 2 扩展为 4 个） */
export type OrderScene = 1 | 2 | 3 | 4;

/** 退款记录（Phase 2） */
export interface Refund {
  id: number;
  refundNo: string;
  paymentId: number;
  orderId: number;
  provider: string;
  providerRefundNo?: string;
  amount: string;
  status: 0 | 1 | 2; // 0=处理中 1=成功 2=失败
  reason?: string;
  failedReason?: string;
  refundedAt?: string;
  createdAt: string;
}

/** 订单列表项（精简） */
export interface OrderListItem {
  id: number;
  orderNo: string;
  planCode: string;
  /** 后端 paginate 直接返回 model 全字段，含套餐快照；列表展示优先用 name */
  planSnapshot?: PaidPlan;
  amount: string;
  status: OrderStatus;
  scene: OrderScene;
  /** Phase 2：升降级前 plan code（scene 3/4 才有） */
  sourcePlanCode?: string;
  /** Phase 2：升降级前剩余价值（scene 3/4 才有） */
  sourceRemainingValue?: string;
  paidAt?: string;
  expireAt: string;
  createdAt: string;
}

/** 订单详情（含快照 + 支付流水 + 退款记录） */
export interface Order extends OrderListItem {
  planSnapshot: PaidPlan;
  cancelledAt?: string;
  remark?: string;
  payments?: Payment[];
  /** Phase 2：退款记录列表 */
  refunds?: Refund[];
}

/** 支付流水 */
export interface Payment {
  id: number;
  paymentNo: string;
  orderId: number;
  provider: string;
  providerTradeNo?: string;
  amount: string;
  status: PaymentStatus;
  paidAt?: string;
  failedReason?: string;
  createdAt: string;
}

/** createOrder 返回类型（Phase 2 扩展）*/
export interface CreateOrderResult {
  orderId: number;
  orderNo: string;
  amount: string;
  planName: string;
  expireAt: string;
  scene: OrderScene;
  /** "新购" / "续费（叠加剩余天数）" / "升级（差价 = ...）" / "降级（折算 N 天）" */
  reason: string;
  /** false = scene=4 0 元订单，无需进收银台 */
  needPayment: boolean;
  /** 升降级时的剩余价值（仅 scene 3/4） */
  remainingValue?: number;
}

/** preview（dryRun）返回类型 */
export interface OrderPreviewResult {
  scene: OrderScene;
  amount: string;
  remainingDays: number;
  remainingValue: string;
  newExpireAt: string;
  reason: string;
  needPayment: boolean;
  currentPlanName?: string;
  newPlanName: string;
}

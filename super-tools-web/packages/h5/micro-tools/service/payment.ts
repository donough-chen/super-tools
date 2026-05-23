/**
 * 订单 / 支付 接口（H5 端）
 *
 * 注：此包用 umi-request；POST 必须把 body 放到 options.data，
 *     且显式声明 Content-Type: application/json，
 *     与 service/auth.ts 的 postJson 写法保持一致。
 *
 * Phase 2 扩展：previewOrder（dryRun）+ getEnabledPaymentProviders
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type {
  Order, Payment, OrderListItem,
  CreateOrderResult, OrderPreviewResult, PaymentProvider,
} from '../types/order';

const API_BASE = '/api';

const postJson = <T = any>(url: string, data: any): Promise<ApiResult<T>> =>
  request.post(url, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });

// ==================== 订单 ====================

export const createOrder = (
  planCode: string,
  remark?: string,
): Promise<ApiResult<CreateOrderResult>> =>
  postJson(`${API_BASE}/orders`, { planCode, remark });

/**
 * Phase 2：预览订单（dryRun）— 不创建订单
 * 用于点击非当前套餐时弹 modal 展示"差价 / 折算天数 / 升降级"信息
 */
export const previewOrder = (
  planCode: string,
): Promise<ApiResult<OrderPreviewResult>> =>
  postJson(`${API_BASE}/orders/preview`, { planCode });

export const getOrder = (id: number): Promise<ApiResult<Order>> =>
  request.get(`${API_BASE}/orders/${id}`);

export const listMyOrders = (params: {
  page?: number;
  pageSize?: number;
  status?: number;
}): Promise<
  ApiResult<{
    list: OrderListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>
> => request.get(`${API_BASE}/orders`, { params });

export const cancelOrder = (
  id: number,
): Promise<ApiResult<{ orderId: number; status: number }>> =>
  postJson(`${API_BASE}/orders/${id}/cancel`, {});

// ==================== 支付 ====================

export const createPayment = (
  orderId: number,
  provider: PaymentProvider,
): Promise<
  ApiResult<{
    paymentNo: string;
    paymentId: number;
    provider: string;
    prepayData: any;
    cashierUrl?: string;
  }>
> => postJson(`${API_BASE}/payments`, { orderId, provider });

export const getPaymentStatus = (
  paymentNo: string,
): Promise<ApiResult<Payment>> =>
  request.get(`${API_BASE}/payments/${paymentNo}/status`);

/**
 * Phase 2：获取启用的支付通道列表（system_configs.payment.enabled_providers）
 * H5 收银台用此渲染 provider 单选按钮
 */
export const getEnabledPaymentProviders = (): Promise<
  ApiResult<{ providers: PaymentProvider[] }>
> => request.get(`${API_BASE}/payments/providers`);

// ==================== Mock 内部（仅本地联调） ====================

export const mockNotify = (body: {
  paymentNo: string;
  amount: number;
  status?: 'success' | 'failed';
  failReason?: string;
}): Promise<ApiResult<any>> =>
  postJson(`${API_BASE}/payments/mock/notify`, body);

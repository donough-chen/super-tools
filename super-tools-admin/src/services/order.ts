/**
 * 管理端订单 service（只读）
 * 对应路由：
 *   - GET /api/admin/member/orders         — 列表（paginate helper）
 *   - GET /api/admin/member/orders/:id     — 详情（含套餐快照 + 支付流水）
 *   - GET /api/admin/member/orders/stats   — 统计（总订单/已支付/付费率/营收）
 */
import request from '@/utils/request';

export interface AdminOrder {
  id: number;
  orderNo: string;
  userId: number;
  planId: number;
  planCode: string;
  planSnapshot: any;
  amount: string;
  actualAmount?: string | null;
  status: 0 | 1 | 2 | 3 | 4;
  scene: 1 | 2 | 3 | 4;
  /** Phase 2：升降级前 plan code（scene 3/4 才有） */
  sourcePlanCode?: string;
  /** Phase 2：升降级前剩余价值（scene 3/4 才有） */
  sourceRemainingValue?: string;
  paidAt?: string;
  cancelledAt?: string;
  expireAt: string;
  remark?: string;
  createdAt: string;
  user?: {
    id: number;
    username?: string;
    nickname?: string;
    phone?: string;
    email?: string;
  };
  payments?: Array<{
    id: number;
    paymentNo: string;
    provider: string;
    amount: string;
    status: 0 | 1 | 2 | 3;
    paidAt?: string;
    failedReason?: string;
    createdAt: string;
  }>;
  /** Phase 2：退款记录列表（订单详情 include 'refunds'） */
  refunds?: Array<{
    id: number;
    refundNo: string;
    provider: string;
    amount: string;
    status: 0 | 1 | 2;
    reason?: string;
    failedReason?: string;
    refundedAt?: string;
    createdAt: string;
  }>;
}

export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
}

export interface OrderStats {
  totalOrders: number;
  paidOrders: number;
  payRate: number;
  totalRevenue: number;
}

export async function listOrders(params?: OrderListQuery) {
  return request('/api/admin/member/orders', { params });
}

export async function getOrder(id: number) {
  return request(`/api/admin/member/orders/${id}`);
}

export async function getOrderStats(params?: { startDate?: string; endDate?: string }) {
  return request('/api/admin/member/orders/stats', { params });
}

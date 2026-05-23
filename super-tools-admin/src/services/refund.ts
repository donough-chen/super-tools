/**
 * 管理端退款 service（Phase 2）
 *
 * 对应路由：
 *   - POST /api/admin/member/orders/:id/refund — 发起退款（perm: member:refund:create）
 *   - GET  /api/admin/member/refunds            — 退款列表（perm: member:order:list）
 *   - GET  /api/admin/member/refunds/:id        — 退款详情（perm: member:order:detail）
 */
import request from '@/utils/request';

export interface AdminRefund {
  id: number;
  refundNo: string;
  paymentId: number;
  orderId: number;
  userId: number;
  provider: string;
  providerRefundNo?: string;
  amount: string;
  status: 0 | 1 | 2;          // 0=处理中 1=成功 2=失败
  reason?: string;
  failedReason?: string;
  operatorId: number;
  refundedAt?: string;
  createdAt: string;
  order?: {
    id: number;
    orderNo: string;
    planCode: string;
    amount: string;
    scene: number;
  };
  user?: {
    id: number;
    username?: string;
    nickname?: string;
    phone?: string;
    email?: string;
  };
  operator?: {
    id: number;
    username?: string;
    nickname?: string;
  };
}

export interface RefundListQuery {
  page?: number;
  pageSize?: number;
  orderId?: number;
  userId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
}

/** 发起退款（管理端，单笔订单全额退款） */
export async function createRefund(orderId: number, reason: string) {
  return request(`/api/admin/member/orders/${orderId}/refund`, {
    method: 'POST',
    data: { reason },
  });
}

export async function listRefunds(params?: RefundListQuery) {
  return request('/api/admin/member/refunds', { params });
}

export async function getRefund(id: number) {
  return request(`/api/admin/member/refunds/${id}`);
}

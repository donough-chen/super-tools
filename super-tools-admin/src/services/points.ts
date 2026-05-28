import request from '@/utils/request';

// ==================== 类型定义 ====================

export interface PointsTask {
  id: number;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  category: 'newbie' | 'daily' | 'achievement' | 'invite' | string;
  triggerEvent: string;
  condition?: any;
  progressType: number;
  progressTarget: number;
  rewardPoints: number;
  rewardGrowth: number;
  resetCycle?: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  dailyCapGroup?: string | null;
  requiredLevel?: number;
  expireDays?: number;
  sort: number;
  status: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

export interface PointsTaskListQuery {
  category?: string;
  status?: 0 | 1;
  page?: number;
  pageSize?: number;
}

export interface PointsMallItem {
  id: number;
  name: string;
  icon?: string;
  description?: string;
  category: string;
  costPoints: number;
  requiredLevel?: number;
  isVirtual: 0 | 1;
  fulfillConfig: any;
  stock?: number;
  dailyLimit?: number;
  totalLimit?: number;
  validFrom?: string;
  validTo?: string;
  sort: number;
  status: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

export interface PointsMallOrder {
  id: number;
  userId: number;
  itemId: number;
  costPoints: number;
  fulfillStatus: 'pending' | 'success' | 'failed';
  refundStatus?: 'none' | 'refunded';
  createdAt: string;
}

export interface ExpireStats {
  total: number;
  expiringIn7d: number;
  expiringIn30d: number;
  expiredToday: number;
}

export interface ReconcileSnapshot {
  id: number;
  userId: number;
  date: string;
  theoryBalance: number;
  actualBalance: number;
  diff: number;
  isAnomaly: 0 | 1;
}

// ==================== 任务管理 ====================
export async function listTasks(params?: PointsTaskListQuery) {
  return request('/api/admin/points/tasks', { params });
}
export async function createTask(data: Partial<PointsTask>) {
  return request('/api/admin/points/tasks', { method: 'POST', data });
}
export async function updateTask(id: number, data: Partial<PointsTask>) {
  return request(`/api/admin/points/tasks/${id}`, { method: 'PUT', data });
}
export async function deleteTask(id: number) {
  return request(`/api/admin/points/tasks/${id}`, { method: 'DELETE' });
}

// ==================== 商城商品 ====================
export async function listMallItems(params?: {
  category?: string;
  status?: 0 | 1;
  page?: number;
  pageSize?: number;
}) {
  return request('/api/admin/points/mall/items', { params });
}
export async function createMallItem(data: Partial<PointsMallItem>) {
  return request('/api/admin/points/mall/items', { method: 'POST', data });
}
export async function updateMallItem(id: number, data: Partial<PointsMallItem>) {
  return request(`/api/admin/points/mall/items/${id}`, { method: 'PUT', data });
}

// ==================== 商城订单 ====================
export async function listMallOrders(params?: {
  fulfillStatus?: string;
  refundStatus?: string;
  userId?: number;
  page?: number;
  pageSize?: number;
}) {
  return request('/api/admin/points/mall/orders', { params });
}
export async function refundMallOrder(id: number, reason: string) {
  return request(`/api/admin/points/mall/orders/${id}/refund`, {
    method: 'POST',
    data: { reason },
  });
}

// ==================== 运维 ====================
export async function getExpireStats() {
  return request('/api/admin/points/expire/stats');
}
export async function listReconcileSnapshots(params?: {
  date?: string;
  onlyAnomaly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  return request('/api/admin/points/reconcile', { params });
}
export async function triggerOpsTask(task: 'expire' | 'remind' | 'snapshot' | 'check') {
  return request('/api/admin/points/ops/trigger', {
    method: 'POST',
    data: { task },
  });
}
export async function clearRuleCache(levelId?: number) {
  return request('/api/admin/points/cache/clear', {
    method: 'POST',
    params: levelId ? { levelId } : undefined,
  });
}

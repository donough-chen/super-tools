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
  applicableScenes?: string[];
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

// 领域事件追溯（Plan §Task 12）
export type DomainEventStatus = 'emitted' | 'dispatched' | 'failed';
export interface DomainEvent {
  id: number;
  eventCode: string;
  userId: number;
  payload: any | null;
  status: DomainEventStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt?: string;
}
export interface DomainEventListQuery {
  eventCode?: string;
  userId?: number;
  status?: DomainEventStatus;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

// 退款账本（Plan §Task 13 / B1 灰度）
export interface RefundLedgerEntry {
  id: number;
  userId: number;
  type: number;
  source: string;
  points: number;
  balance: number;
  bizType?: string | null;
  bizId?: string | null;
  remark?: string | null;
  metadata?: {
    scenario?: 'B1_REFUND';
    originalLogId?: number;
    refundAmount?: number;
    recoverHere?: number;
    overflow?: number;
    fallbackBatchIds?: number[];
    [k: string]: any;
  } | null;
  createdAt: string;
}
export interface RefundLedgerFlag {
  enabled: boolean;
  raw: string;
  exists: boolean;
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

// ==================== 领域事件追溯（Plan §Task 12）====================
export async function listDomainEvents(params?: DomainEventListQuery) {
  return request('/api/admin/points/events', { params });
}
export async function retryDomainEvent(id: number) {
  return request(`/api/admin/points/events/${id}/retry`, { method: 'POST' });
}

// ==================== 退款账本（Plan §Task 13 / B1 灰度）====================
export async function listRefundLedger(params?: {
  userId?: number;
  originalLogId?: number;
  page?: number;
  pageSize?: number;
}) {
  return request('/api/admin/points/refund-ledger', { params });
}
export async function getRefundLedgerFlag() {
  return request('/api/admin/points/refund-ledger/flag');
}

import request from '@/utils/request';

// ====== 概览 ======
export async function getStatsOverview() {
  return request('/api/admin/stats/overview');
}

export async function getSystemStatus() {
  return request('/api/admin/dashboard/system-status');
}

export async function getStatsTrend(params: {
  metric: 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';
  granularity?: 'day' | 'week' | 'month';
  startTime?: string;
  endTime?: string;
}) {
  return request('/api/admin/stats/trend', { params });
}

// ====== 业务分析 ======
export async function getUserRetention(params: { startDate: string; endDate: string }) {
  return request('/api/admin/stats/user-retention', { params });
}

export async function getActiveHours(params: { days?: number }) {
  return request('/api/admin/stats/active-hours', { params });
}

export async function getToolUsage(params?: { startTime?: string; endTime?: string; limit?: number }) {
  return request('/api/admin/stats/tool-usage', { params });
}

export async function getToolCategory(params?: { startDate?: string; endDate?: string }) {
  return request('/api/admin/stats/tool-category', { params });
}

export async function getOperationEfficiency(params?: { startDate?: string; endDate?: string }) {
  return request('/api/admin/stats/operation-efficiency', { params });
}

export async function getUserGrowth(params?: {
  startDate?: string; endDate?: string; granularity?: 'day' | 'week' | 'month';
}) {
  return request('/api/admin/stats/user-growth', { params });
}

export async function getUserActive(params?: { startTime?: string; endTime?: string }) {
  return request('/api/admin/stats/user-active', { params });
}

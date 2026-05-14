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

// ====== 部门视图 (Phase 2) ======
export async function getDepartmentOverview(params?: { role_ids?: string }) {
  return request('/api/admin/stats/department/overview', { params });
}

export async function getDepartmentCompare(params: {
  role_ids: string; metric?: string; startDate?: string; endDate?: string;
}) {
  return request('/api/admin/stats/department/compare', { params });
}

export async function getDepartmentCollaboration(params?: { role_ids?: string }) {
  return request('/api/admin/stats/department/collaboration', { params });
}

// ====== 智能预警 (Phase 3) ======
export async function getAlertRules(params?: any) {
  return request('/api/admin/alerts/rules', { params });
}

export async function createAlertRule(data: any) {
  return request('/api/admin/alerts/rules', { method: 'POST', data });
}

export async function updateAlertRule(id: number, data: any) {
  return request(`/api/admin/alerts/rules/${id}`, { method: 'PUT', data });
}

export async function deleteAlertRule(id: number) {
  return request(`/api/admin/alerts/rules/${id}`, { method: 'DELETE' });
}

export async function toggleAlertRule(id: number) {
  return request(`/api/admin/alerts/rules/${id}/toggle`, { method: 'PUT' });
}

export async function getAlertLogs(params?: any) {
  return request('/api/admin/alerts/logs', { params });
}

export async function acknowledgeAlertLog(id: number) {
  return request(`/api/admin/alerts/logs/${id}/acknowledge`, { method: 'PUT' });
}

export async function resolveAlertLog(id: number, resolve_note?: string) {
  return request(`/api/admin/alerts/logs/${id}/resolve`, { method: 'PUT', data: { resolve_note } });
}

export async function getAlertSummary() {
  return request('/api/admin/alerts/summary');
}

// ====== 可视化配置 (Phase 4) ======
export async function getLayouts() {
  return request('/api/admin/dashboard/layouts');
}

export async function getLayout(id: number) {
  return request(`/api/admin/dashboard/layouts/${id}`);
}

export async function createLayout(data: any) {
  return request('/api/admin/dashboard/layouts', { method: 'POST', data });
}

export async function updateLayout(id: number, data: any) {
  return request(`/api/admin/dashboard/layouts/${id}`, { method: 'PUT', data });
}

export async function deleteLayout(id: number) {
  return request(`/api/admin/dashboard/layouts/${id}`, { method: 'DELETE' });
}

export async function setLayoutDefault(id: number) {
  return request(`/api/admin/dashboard/layouts/${id}/default`, { method: 'PUT' });
}

export async function shareLayout(id: number) {
  return request(`/api/admin/dashboard/layouts/${id}/share`, { method: 'POST' });
}

export async function getSharedLayout(token: string) {
  return request(`/api/admin/dashboard/shared/${token}`);
}

// ====== 移动端适配 (Phase 5) ======
export async function getMobileSummary() {
  return request('/api/admin/dashboard/mobile-summary');
}

export async function getPushSettings() {
  return request('/api/admin/dashboard/push-settings');
}

export async function savePushSettings(data: any) {
  return request('/api/admin/dashboard/push-settings', { method: 'POST', data });
}

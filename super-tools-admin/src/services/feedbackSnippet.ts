import request from '@/utils/request';

// ==================== 类型定义 ====================

export type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';

/** 0=草稿 / 1=已发布 / 2=已停用 */
export type SnippetStatus = 0 | 1 | 2;

/** 0=禁用 / 1=启用 */
export type CategoryStatus = 0 | 1;

// -------- 分类 --------

export interface SnippetCategory {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  description?: string | null;
  feedbackType?: FeedbackType | null;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  status: CategoryStatus;
  isSystem: number;
  children?: SnippetCategory[];
}

export interface CategoryCreatePayload {
  code: string;
  name: string;
  parentId?: number | null;
  description?: string | null;
  feedbackType?: FeedbackType | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  status?: CategoryStatus;
}

export type CategoryUpdatePayload = Partial<Omit<CategoryCreatePayload, 'code'>>;

// -------- 话术 --------

export interface Snippet {
  id: number;
  categoryId: number;
  code: string;
  title: string;
  content: string;
  tags?: string | null;
  sampleVariables?: Record<string, any> | null;
  currentVersion: number;
  status: SnippetStatus;
  usageCount: number;
  lastUsedAt?: string | null;
  description?: string | null;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnippetListQuery {
  page?: number;
  pageSize?: number;
  categoryId?: number;
  status?: SnippetStatus;
  tag?: string;
  keyword?: string;
}

export interface SnippetCreatePayload {
  categoryId: number;
  code: string;
  title: string;
  content: string;
  tags?: string | null;
  sampleVariables?: Record<string, any> | null;
  description?: string | null;
}

export type SnippetUpdatePayload = Partial<Omit<SnippetCreatePayload, 'code'>>;

// -------- 版本 --------

export interface SnippetVersion {
  id: number;
  snippetId: number;
  version: number;
  title: string;
  content: string;
  tags?: string | null;
  sampleVariables?: Record<string, any> | null;
  changeNote?: string | null;
  publishedBy: number;
  publishedAt: string;
}

// -------- Picker / Recommend / Render --------

export interface PickerData {
  categories: SnippetCategory[];
  snippets: Array<{
    id: number;
    category_id: number;
    code: string;
    title: string;
    content: string;
    tags: string | null;
    usage_count: number;
  }>;
}

export interface RecommendItem {
  id: number;
  categoryId: number;
  code: string;
  title: string;
  content: string;
  tags: string | null;
  usageCount: number;
  score: number;
}

export interface RenderResult {
  id: number;
  title: string;
  content: string;
  missingVars: string[];
  builtinVariables: string[];
}

// -------- 统计 --------

export interface StatsOverview {
  totalSnippets: number;
  activeSnippets: number;
  monthUsage: number;
  avgCloseRate: number;
}

export interface StatsTopItem {
  id: number;
  code: string;
  title: string;
  categoryName: string | null;
  usageCount: number;
  logCount: number;
  closedCount: number;
  closeRate: number;
}

export interface StatsTrendItem {
  date: string;
  usageCount: number;
  activeSnippets: number;
}

// ==================== 分类 API ====================

/** 分类树 */
export async function getSnippetCategoryTree(params?: { onlyActive?: boolean }) {
  return request('/api/admin/feedback/snippet-categories', {
    params: params?.onlyActive ? { onlyActive: '1' } : undefined,
  });
}

export async function getSnippetCategoryDetail(id: number) {
  return request(`/api/admin/feedback/snippet-categories/${id}`);
}

export async function createSnippetCategory(data: CategoryCreatePayload) {
  return request('/api/admin/feedback/snippet-categories', { method: 'POST', data });
}

export async function updateSnippetCategory(id: number, data: CategoryUpdatePayload) {
  return request(`/api/admin/feedback/snippet-categories/${id}`, { method: 'PUT', data });
}

export async function deleteSnippetCategory(id: number) {
  return request(`/api/admin/feedback/snippet-categories/${id}`, { method: 'DELETE' });
}

export async function getCategoryRolePermissions(id: number) {
  return request(`/api/admin/feedback/snippet-categories/${id}/role-permissions`);
}

export async function setCategoryRolePermissions(id: number, roleIds: number[]) {
  return request(`/api/admin/feedback/snippet-categories/${id}/role-permissions`, {
    method: 'PUT',
    data: { roleIds },
  });
}

// ==================== 话术 API ====================

export async function getSnippetList(params?: SnippetListQuery) {
  return request('/api/admin/feedback/snippets', { params });
}

export async function getSnippetDetail(id: number) {
  return request(`/api/admin/feedback/snippets/${id}`);
}

export async function createSnippet(data: SnippetCreatePayload) {
  return request('/api/admin/feedback/snippets', { method: 'POST', data });
}

export async function updateSnippet(id: number, data: SnippetUpdatePayload) {
  return request(`/api/admin/feedback/snippets/${id}`, { method: 'PUT', data });
}

export async function deleteSnippet(id: number) {
  return request(`/api/admin/feedback/snippets/${id}`, { method: 'DELETE' });
}

// 发布 / 停用 / 回滚

export async function publishSnippet(id: number, changeNote?: string) {
  return request(`/api/admin/feedback/snippets/${id}/publish`, {
    method: 'POST',
    data: { changeNote },
  });
}

export async function disableSnippet(id: number) {
  return request(`/api/admin/feedback/snippets/${id}/disable`, { method: 'POST' });
}

export async function rollbackSnippet(id: number, versionId: number) {
  return request(`/api/admin/feedback/snippets/${id}/rollback/${versionId}`, { method: 'POST' });
}

export async function getSnippetVersions(id: number) {
  return request(`/api/admin/feedback/snippets/${id}/versions`);
}

// 使用相关

export async function getSnippetPicker() {
  return request('/api/admin/feedback/snippets/picker');
}

export async function getSnippetRecommend(feedbackId: number) {
  return request('/api/admin/feedback/snippets/recommend', { params: { feedbackId } });
}

export async function renderSnippet(id: number, body: {
  variables?: Record<string, any>;
  feedbackId?: number;
}) {
  return request(`/api/admin/feedback/snippets/${id}/render`, { method: 'POST', data: body });
}

export async function recordSnippetUsage(id: number, body: {
  feedbackId: number;
  finalContent?: string;
}) {
  return request(`/api/admin/feedback/snippets/${id}/usage`, { method: 'POST', data: body });
}

// 统计

export async function getSnippetStatsOverview() {
  return request('/api/admin/feedback/snippets/stats/overview');
}

export async function getSnippetStatsTop(params?: { limit?: number }) {
  return request('/api/admin/feedback/snippets/stats/top', { params });
}

export async function getSnippetStatsTrend(params?: { days?: number }) {
  return request('/api/admin/feedback/snippets/stats/trend', { params });
}

// 导入导出

export async function exportSnippets() {
  return request('/api/admin/feedback/snippets/export');
}

export async function importSnippets(data: {
  version?: string;
  categories?: any[];
  snippets?: any[];
}) {
  return request('/api/admin/feedback/snippets/import', { method: 'POST', data });
}

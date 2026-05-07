import request from '@/utils/request';

// ==================== 类型定义 ====================

export type LevelCode = 'free' | 'silver' | 'gold' | 'diamond' | 'black';

export interface CategoryDTO {
  code: string;
  name: string;
  icon?: string;
  description?: string;
  sort?: number;
  status?: 0 | 1;
}

export interface ToolDTO {
  code: string;
  name: string;
  description?: string;
  keyword?: string;
  categoryId: number;
  icon?: string;
  color?: string;
  path: string;
  isFeature?: 0 | 1;
  requiredLevelCode?: LevelCode;
  requirePaid?: 0 | 1;
  status?: 0 | 1;
  sort?: number;
}

export interface ListToolsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryCode?: string;
  status?: 0 | 1;
  isFeature?: 0 | 1;
  requiredLevelCode?: LevelCode;
  requirePaid?: 0 | 1;
}

// ==================== 分类 ====================

export async function listCategories(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return request('/api/admin/tool-categories', { params });
}

export async function createCategory(data: CategoryDTO) {
  return request('/api/admin/tool-categories', { method: 'POST', data });
}

export async function updateCategory(id: number, data: Partial<CategoryDTO>) {
  return request(`/api/admin/tool-categories/${id}`, { method: 'PUT', data });
}

export async function deleteCategory(id: number) {
  return request(`/api/admin/tool-categories/${id}`, { method: 'DELETE' });
}

// ==================== 工具 ====================

export async function listTools(params?: ListToolsQuery) {
  return request('/api/admin/tools', { params });
}

export async function getTool(id: number) {
  return request(`/api/admin/tools/${id}`);
}

export async function createTool(data: ToolDTO) {
  return request('/api/admin/tools', { method: 'POST', data });
}

export async function updateTool(id: number, data: Partial<ToolDTO>) {
  return request(`/api/admin/tools/${id}`, { method: 'PUT', data });
}

export async function deleteTool(id: number) {
  return request(`/api/admin/tools/${id}`, { method: 'DELETE' });
}

export async function batchPublish(ids: number[], status: 0 | 1) {
  return request('/api/admin/tools/batch-publish', { method: 'PUT', data: { ids, status } });
}

/**
 * 公共业务接口（不需登录态）
 *
 * 注：旧的 banner/tool/featured 接口已迁移至 service/tool.ts（对接新工具模块）
 * 本文件保留 favorite/site 等暂未迁移的接口
 */
import { request } from '@/utils';

const API_BASE = '/api';

// ==================== 收藏 ====================

export const getFavoriteTools = async () => {
  const result = await request.get(`${API_BASE}/favorite/list`);
  return result || {};
};

export const addFavorite = async (toolId: string) => {
  const result = await request.post(`${API_BASE}/favorite/add`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ toolId }),
  });
  return result || {};
};

export const removeFavorite = async (toolId: string) => {
  const result = await request.post(`${API_BASE}/favorite/remove`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ toolId }),
  });
  return result || {};
};

// ==================== 网站 ====================

export const getSiteCategories = async () => {
  const result = await request.get(`${API_BASE}/site/categories`);
  return result || {};
};

export const getSiteList = async (params: { categoryId: string; sortType?: string }) => {
  const query = new URLSearchParams();
  query.set('categoryId', params.categoryId);
  if (params.sortType) query.set('sortType', params.sortType);
  const result = await request.get(`${API_BASE}/site/list?${query.toString()}`);
  return result || {};
};

/**
 * 公共业务接口（不需登录态的资源类接口或与登录无关的业务接口）
 * 来源：原 service.ts 迁移
 */
import { request } from '@/utils';

const API_BASE = '/api';

// ==================== 首页 ====================

/** 获取广告位 Banner 列表 */
export const getBannerList = async () => {
  const result = await request.get(`${API_BASE}/banner/list`);
  return result || {};
};

/** 获取工具分类列表（含每个分类下的工具） */
export const getToolCategories = async () => {
  const result = await request.get(`${API_BASE}/tool/categories`);
  return result || {};
};

/** 搜索工具 */
export const searchTools = async (keyword: string) => {
  const result = await request.get(`${API_BASE}/tool/search?keyword=${encodeURIComponent(keyword)}`);
  return result || {};
};

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

// ==================== 特色 ====================

export const getFeaturedTools = async (type: 'featured' | 'vip') => {
  const result = await request.get(`${API_BASE}/featured/list?type=${encodeURIComponent(type)}`);
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

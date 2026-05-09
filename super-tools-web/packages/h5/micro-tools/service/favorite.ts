/**
 * 收藏模块接口
 *
 * 对接后端 /api/favorites/* 路由（v1.0，2026-05-08）
 * - 所有接口均需登录，Authorization 头由 request 拦截器统一注入
 * - 成功码：GET/DELETE/PUT = 200，POST = 201
 */
import { request } from '@/utils';

const API = '/api/favorites';

const buildQS = (params?: Record<string, any>): string => {
  if (!params) return '';
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

/**
 * 1) 收藏工具
 * @param toolCode 工具编码（推荐）
 */
export const addFavoriteApi = async (toolCode: string) =>
  (await request.post(API, {
    data: { toolCode },
    headers: { 'Content-Type': 'application/json' },
  })) || {};

/**
 * 2) 取消收藏
 * @param toolCode 工具编码
 */
export const removeFavoriteApi = async (toolCode: string) =>
  (await request.delete(`${API}/${encodeURIComponent(toolCode)}`)) || {};

/**
 * 3) 分页收藏列表（支持 keyword / categoryCode 服务端过滤）
 */
export const getFavoriteListApi = async (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryCode?: string;
}) => (await request.get(`${API}${buildQS(params)}`)) || {};

/**
 * 4) 已收藏 code 集合（轻量，工具列表页批量标注心形用）
 */
export const getFavoriteCodesApi = async () =>
  (await request.get(`${API}/codes`)) || {};

/**
 * 5) 单工具收藏态
 */
export const checkFavoriteApi = async (toolCode: string) =>
  (await request.get(`${API}/check/${encodeURIComponent(toolCode)}`)) || {};

/**
 * 6) 手动拖拽排序
 * @param orderedToolCodes 必须包含当前用户**所有**已收藏工具 code 的数组，顺序为期望展示顺序
 */
export const reorderFavoritesApi = async (orderedToolCodes: string[]) =>
  (await request.put(`${API}/reorder`, {
    data: { orderedToolCodes },
    headers: { 'Content-Type': 'application/json' },
  })) || {};

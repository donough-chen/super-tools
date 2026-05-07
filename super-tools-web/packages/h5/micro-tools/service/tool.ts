/**
 * 工具模块接口
 *
 * 对接后端 /api/tools/* 路由
 *
 * 注：
 * - 响应格式 { code: 200, data, timestamp }（成功）
 * - 分页接口（feature/member）返回 { code, data: { list, total, page, pageSize, totalPages } }
 * - home 接口双模式：聚合（无 query）或分页（有 categoryCode/keyword）
 */
import { request } from '@/utils';

const API = '/api/tools';

const buildQS = (params?: Record<string, any>): string => {
  if (!params) return '';
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

/** 首页聚合/分页双模式 */
export const getHome = async (params?: {
  categoryCode?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) => (await request.get(`${API}/home${buildQS(params)}`)) || {};

/** 特色功能列表（分页） */
export const getFeatureTools = async (params?: { page?: number; pageSize?: number }) =>
  (await request.get(`${API}/feature${buildQS(params)}`)) || {};

/** 会员专属列表（分页） */
export const getMemberTools = async (params?: { page?: number; pageSize?: number }) =>
  (await request.get(`${API}/member${buildQS(params)}`)) || {};

/** 使用前权限校验（需登录） */
export const checkToolAccess = async (code: string) =>
  (await request.get(`${API}/${encodeURIComponent(code)}/access`)) || {};

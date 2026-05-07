import { config } from '../utils';

/** 后端通用接口 API 基础路径 */
export const API_BASE = config.env === 'preview' ? '/api-preview' : '/api';

/** 通用状态码 */
export const CODE = {
  SUCCESS: 0,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;

/** 分页默认配置 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
} as const;

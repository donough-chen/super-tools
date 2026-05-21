/**
 * 反馈模块接口（H5 / micro-tools）
 *
 * 对接后端：
 * - POST /api/feedback           — 提交反馈（可登录可不登录，限流 10 req/h/IP）
 * - GET  /api/feedback/mine      — 我的反馈列表（需登录）
 * - GET  /api/feedback/mine/:id  — 我的反馈详情（需登录）
 *
 * 成功码：POST = 201，GET = 200
 */
import { request } from '@/utils';

const API = '/api/feedback';

export type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';
export type FeedbackStatus = 0 | 1 | 2 | 3;

export interface FeedbackCreatePayload {
  type: FeedbackType;
  content: string;
  contact?: string;
  platform?: string;
}

export interface FeedbackListItem {
  id: number;
  type: FeedbackType;
  content: string;     // 列表中已截断到 100 字
  status: FeedbackStatus;
  createdAt: string;
  repliedAt: string | null;
}

export interface FeedbackDetail {
  id: number;
  type: FeedbackType;
  content: string;
  contact: string | null;
  platform: string | null;
  status: FeedbackStatus;
  replyContent: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
 * 1) 提交反馈
 *    - 登录态：自动注入 Authorization；contact 可选
 *    - 未登录：必须填 contact，否则后端返回 422
 */
export const submitFeedbackApi = async (payload: FeedbackCreatePayload) =>
  (await request.post(API, {
    data: payload,
    headers: { 'Content-Type': 'application/json' },
  })) || {};

/**
 * 2) 我的反馈列表
 */
export const getMyFeedbackListApi = async (params?: {
  page?: number;
  pageSize?: number;
  status?: FeedbackStatus;
}) => (await request.get(`${API}/mine${buildQS(params)}`)) || {};

/**
 * 3) 我的反馈详情
 *    - 后端会校验 userId，看不到他人反馈
 */
export const getMyFeedbackDetailApi = async (id: number | string) =>
  (await request.get(`${API}/mine/${id}`)) || {};

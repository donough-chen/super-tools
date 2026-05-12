import request from '@/utils/request';

// ==================== 类型定义 ====================

export type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';

/** 0=待处理 / 1=处理中 / 2=已回复 / 3=已关闭 */
export type FeedbackStatus = 0 | 1 | 2 | 3;

export interface FeedbackListQuery {
  page?: number;
  pageSize?: number;
  type?: FeedbackType;
  status?: FeedbackStatus;
  platform?: string;
  userId?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
}

export interface FeedbackUserBrief {
  id: number;
  username: string;
  nickname?: string;
}

export interface Feedback {
  id: number;
  userId: number | null;
  type: FeedbackType;
  content: string;
  contact: string | null;
  platform: string | null;
  ip: string | null;
  userAgent: string | null;
  status: FeedbackStatus;
  replyContent: string | null;
  replyUserId: number | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** include user（list/detail 都含） */
  user?: FeedbackUserBrief;
  /** include replier（仅 detail 含） */
  replier?: FeedbackUserBrief;
}

// ==================== API 封装 ====================

/**
 * 反馈列表（管理端）
 * - 后端 service.feedback.list 返回结构：data: { total, page, pageSize, rows }
 *   注意 rows 字段名（与 user list 的 list 字段不同）
 */
export async function listFeedbacks(params?: FeedbackListQuery) {
  return request('/api/admin/feedbacks', { params });
}

export async function getFeedback(id: number) {
  return request(`/api/admin/feedbacks/${id}`);
}

/**
 * 回复反馈
 * - 后端 service 严格状态机：仅 status=0/1 允许 reply，否则抛 409
 * - 成功后 status 自动变为 2
 */
export async function replyFeedback(id: number, replyContent: string) {
  return request(`/api/admin/feedbacks/${id}/reply`, {
    method: 'POST',
    data: { replyContent },
  });
}

/**
 * 更新反馈状态
 * - 后端有 transition 白名单：0/1 → 2 由 reply 独占；其他白名单见 utils/feedbackStatus.ts
 */
export async function updateFeedback(id: number, data: { status: FeedbackStatus }) {
  return request(`/api/admin/feedbacks/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 软删反馈（paranoid） */
export async function deleteFeedback(id: number) {
  return request(`/api/admin/feedbacks/${id}`, { method: 'DELETE' });
}

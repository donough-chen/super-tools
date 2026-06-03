/**
 * 任务中心接口
 *
 * - GET /api/tasks?category=...：查询任务列表（含状态、进度、奖励），支持按分类筛选
 * - POST /api/tasks/:code/claim：领取任务奖励，必传 Idempotency-Key
 *
 * 后端限流：claim 10 次/分钟（router.ts:401）
 *
 * Plan: Task 1.5
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type { TaskCategory, TaskItem, TaskClaimResult } from '../types/points';

export const getTasks = (category?: TaskCategory): Promise<ApiResult<TaskItem[]>> =>
  request.get('/api/tasks', {
    params: category ? { category } : {},
  });

export const claimTask = (
  code: string,
  idemKey: string,
): Promise<ApiResult<TaskClaimResult>> =>
  request.post(`/api/tasks/${encodeURIComponent(code)}/claim`, {
    data: {},
    headers: { 'Idempotency-Key': idemKey },
  });

/**
 * 任务中心接口
 *
 * - GET /api/tasks：查询全部任务（含状态、进度、奖励）
 * - POST /api/tasks/:code/claim：领取任务奖励，必传 Idempotency-Key
 *
 * 后端限流：claim 10 次/分钟（router.ts:401）
 *
 * Plan: Task 1.5
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type { TaskItem, TaskClaimResult } from '../types/points';

export const getTasks = (): Promise<ApiResult<TaskItem[]>> =>
  request.get('/api/tasks');

export const claimTask = (
  code: string,
  idemKey: string,
): Promise<ApiResult<TaskClaimResult>> =>
  request.post(`/api/tasks/${encodeURIComponent(code)}/claim`, {
    data: {},
    headers: { 'Idempotency-Key': idemKey },
  });

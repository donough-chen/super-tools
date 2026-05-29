/**
 * 签到接口
 *
 * - GET /api/sign/status：查询签到状态（含连签天数、本周日历）
 * - POST /api/sign：执行签到，必传 Idempotency-Key
 *
 * 后端限流：10 次/分钟（router.ts:396）
 *
 * Plan: Task 1.4
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type { SignStatus, SignResult } from '../types/points';

export const getSignStatus = (): Promise<ApiResult<SignStatus>> =>
  request.get('/api/sign/status');

export const doSign = (idemKey: string): Promise<ApiResult<SignResult>> =>
  request.post('/api/sign', {
    data: {},
    headers: { 'Idempotency-Key': idemKey },
  });

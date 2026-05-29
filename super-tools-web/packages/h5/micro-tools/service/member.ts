/**
 * 会员/积分模块接口
 *
 * V1：会员信息卡片 + 套餐
 * V2 扩展：等级列表 / 权益对比 / 积分流水 / 备用签到
 *
 * Spec: super-tool-node/docs/superpowers/specs/2026-05-29-积分成长体系H5页面-design.md §4.3
 * Plan: super-tool-node/docs/superpowers/plans/2026-05-29-积分成长体系H5页面实施计划.md (Task 1.3)
 */
import { request } from '@/utils';
import type { MemberInfo, ApiResult } from '../types/auth';
import type { PaidPlan } from '../types/order';
import type {
  MemberLevelItem,
  MemberBenefitsResponse,
  PointsLogsQuery,
  PointsLogsResponse,
  SignResult,
} from '../types/points';

const API_BASE = '/api';

/** 获取当前用户会员信息 */
export const getMemberInfo = (): Promise<ApiResult<MemberInfo>> =>
  request.get(`${API_BASE}/member/info`);

/** 获取会员套餐列表（公开） */
export const getMemberPlans = (): Promise<ApiResult<PaidPlan[]>> =>
  request.get(`${API_BASE}/member/plans`);

/** 获取等级列表（公开） */
export const getMemberLevels = (): Promise<ApiResult<MemberLevelItem[]>> =>
  request.get(`${API_BASE}/member/levels`);

/** 获取当前用户权益对比（当前等级 vs 下一级） */
export const getMemberBenefits = (): Promise<ApiResult<MemberBenefitsResponse>> =>
  request.get(`${API_BASE}/member/benefits`);

/** 获取积分流水（分页 + 类型/时间筛选） */
export const getPointsLogs = (
  params: PointsLogsQuery = {},
): Promise<ApiResult<PointsLogsResponse>> =>
  request.get(`${API_BASE}/member/points-logs`, { params });

/**
 * 备用：会员每日签到（与 /api/sign 等价但归属 member 模块）
 * 前端默认使用 service/sign.ts 的 doSign。
 */
export const memberDailySign = (
  idemKey: string,
): Promise<ApiResult<SignResult>> =>
  request.post(`${API_BASE}/member/daily-sign`, {
    data: {},
    headers: { 'Idempotency-Key': idemKey },
  });

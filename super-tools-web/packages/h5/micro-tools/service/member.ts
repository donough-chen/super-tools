/**
 * 会员接口模块
 * V1 范围：仅 getMemberInfo（个人信息卡片 + Mine 页徽标）
 * V2：套餐列表（getMemberPlans）— 配合订单/支付模块
 */
import { request } from '@/utils';
import type { MemberInfo, ApiResult } from '../types/auth';
import type { PaidPlan } from '../types/order';

const API_BASE = '/api';

/** 获取当前用户会员信息 */
export const getMemberInfo = (): Promise<ApiResult<MemberInfo>> =>
  request.get(`${API_BASE}/member/info`);

/** 获取会员套餐列表（公开，无需登录） */
export const getMemberPlans = (): Promise<ApiResult<PaidPlan[]>> =>
  request.get(`${API_BASE}/member/plans`);

// ==================== V2 预留 ====================
// export const getMemberBenefits = ...;
// export const getMemberLevels = ...;
// export const getPointsLogs = ...;
// export const dailySign = ...;

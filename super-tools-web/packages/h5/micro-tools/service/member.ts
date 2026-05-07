/**
 * 会员接口模块
 * V1 范围：仅 getMemberInfo（个人信息卡片 + Mine 页徽标）
 * V2 预留：等级列表、付费套餐、积分流水、每日签到、权益配置
 */
import { request } from '@/utils';
import type { MemberInfo, ApiResult } from '../types/auth';

const API_BASE = '/api';

/** 获取当前用户会员信息 */
export const getMemberInfo = (): Promise<ApiResult<MemberInfo>> =>
  request.get(`${API_BASE}/member/info`);

// ==================== V2 预留 ====================
// export const getMemberBenefits = ...;
// export const getMemberLevels = ...;
// export const getMemberPlans = ...;
// export const getPointsLogs = ...;
// export const dailySign = ...;

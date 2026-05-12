import request from '@/utils/request';

// ==================== 类型定义 ====================

export interface MemberLevel {
  id: number;
  name: string;
  code: string;
  level: number;
  icon?: string;
  color?: string;
  upgradePoints: number;
  upgradeGrowth: number;
  upgradeConsume: string;          // DECIMAL → string
  benefits?: Record<string, any>;
  description?: string;
  sort: number;
  status: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberLevelUpdateDTO {
  name?: string;
  icon?: string;
  color?: string;
  upgradePoints?: number;
  upgradeGrowth?: number;
  upgradeConsume?: number | string;
  benefits?: Record<string, any>;
  description?: string;
  sort?: number;
  status?: 0 | 1;
}

export interface PaidPlan {
  id: number;
  name: string;
  code: string;
  durationDays: number;
  price: string;
  originalPrice: string;
  benefits?: Record<string, any>;
  giftPoints: number;
  giftGrowth: number;
  description?: string;
  sort: number;
  status: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaidPlanUpdateDTO {
  name?: string;
  durationDays?: number;
  price?: number | string;
  originalPrice?: number | string;
  benefits?: Record<string, any>;
  giftPoints?: number;
  giftGrowth?: number;
  description?: string;
  sort?: number;
  status?: 0 | 1;
}

/**
 * 会员用户列表行（service.member.getMemberUsers 返回）
 * - include user: id/uuid/nickname/phone/email/avatar
 * - include level: name/code/level/color
 */
export interface MemberUser {
  id: number;
  userId: number;
  levelId: number;
  levelCode: string;
  growthValue: number;
  totalPoints: number;
  totalConsume: string;
  points: number;
  isPaid: 0 | 1;
  paidPlanCode?: string;
  paidStartAt?: string;
  paidExpireAt?: string;
  levelExpireAt?: string;
  user?: {
    id: number;
    uuid?: string;
    nickname?: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
  level?: {
    name: string;
    code: string;
    level: number;
    color?: string;
  };
}

/**
 * 管理端详情接口返回（与 list 字段集完全不同！）
 *
 * T1 联调发现：service.member.getMemberInfo 返回简化对象，
 * 不含原始 id/userId/levelId 等字段。前端用作"列表行 target 的增量补充"。
 */
export interface MemberInfoExtra {
  level: {
    id: number;
    name: string;
    code: string;
    level: number;
    icon?: string;
    color?: string;
  };
  growthValue: number;
  totalPoints: number;
  points: number;
  totalConsume: number;
  nextLevel: {
    name: string;
    code: string;
    upgradeGrowth: number;
    progress: number;
    remaining: number;
  } | null;
  paid: {
    isPaid: boolean;
    planName?: string;
    planCode?: string;
    startAt?: string;
    expireAt?: string;
    daysRemaining?: number;
  };
}

export interface MemberUserListQuery {
  page?: number;
  pageSize?: number;
  levelCode?: string;
  isPaid?: 0 | 1;
  keyword?: string;
}

export interface MemberStats {
  totalMembers: number;
  paidMembers: number;
  paidRate: number;
  levelDistribution: Record<string, number>;
  todayNewMembers: number;
}

/** 积分流水（service.member.getAdminPointsLogs 不 include user） */
export interface PointsLog {
  id: number;
  userId: number;
  type: 0 | 1;          // 0=支出 / 1=收入（service.addPoints 内部约定）
  source: string;       // 'admin' / 'sign' / 'consume' / ...
  points: number;       // 正数=收入；负数=支出
  balance: number;
  growthDelta: number;
  bizType?: string;
  bizId?: string;
  remark?: string;
  expireAt?: string;
  createdAt: string;
}

export interface PointsLogsQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  type?: 0 | 1;
  source?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== API 封装 ====================

/** GET /api/admin/member/levels — 等级列表（直接数组，非分页） */
export async function listLevels() {
  return request('/api/admin/member/levels');
}

/** PUT /api/admin/member/levels/:id — 更新等级（code/level 不可改） */
export async function updateLevel(id: number, data: MemberLevelUpdateDTO) {
  return request(`/api/admin/member/levels/${id}`, { method: 'PUT', data });
}

/** GET /api/admin/member/plans — 套餐列表（直接数组，非分页） */
export async function listPlans() {
  return request('/api/admin/member/plans');
}

/** PUT /api/admin/member/plans/:id — 更新套餐（code 不可改） */
export async function updatePlan(id: number, data: PaidPlanUpdateDTO) {
  return request(`/api/admin/member/plans/${id}`, { method: 'PUT', data });
}

/** GET /api/admin/member/users — 会员用户列表（paginate helper：data.list + total） */
export async function listMemberUsers(params?: MemberUserListQuery) {
  return request('/api/admin/member/users', { params });
}

/** GET /api/admin/member/users/:id — 用户会员详情（返回 MemberInfoExtra，不含原始 UserMember 字段） */
export async function getMemberUser(id: number) {
  return request(`/api/admin/member/users/${id}`);
}

/**
 * POST /api/admin/member/users/:id/adjust-points — 调整积分
 * - points 正数加，负数扣
 * - remark 必填（后端 service 强制非空）
 */
export async function adjustPoints(userId: number, points: number, growthDelta: number, remark: string) {
  return request(`/api/admin/member/users/${userId}/adjust-points`, {
    method: 'POST',
    data: { points, growthDelta, remark },
  });
}

/**
 * PUT /api/admin/member/users/:id/level — 调整等级
 * - 返回 { levelId, levelCode, levelName }（非完整 UserMember）
 */
export async function adjustLevel(userId: number, levelId: number) {
  return request(`/api/admin/member/users/${userId}/level`, {
    method: 'PUT',
    data: { levelId },
  });
}

/** POST /api/admin/member/users/:id/activate-plan — 开通套餐（用 planCode 字符串非 id） */
export async function activatePlan(userId: number, planCode: string) {
  return request(`/api/admin/member/users/${userId}/activate-plan`, {
    method: 'POST',
    data: { planCode },
  });
}

/** GET /api/admin/member/stats — 会员统计 */
export async function getMemberStats() {
  return request('/api/admin/member/stats');
}

/** GET /api/admin/member/points-logs — 积分流水（paginate helper；不 include user） */
export async function listPointsLogs(params?: PointsLogsQuery) {
  return request('/api/admin/member/points-logs', { params });
}

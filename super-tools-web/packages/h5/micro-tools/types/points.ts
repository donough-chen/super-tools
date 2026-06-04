/**
 * 积分成长体系 — 数据类型定义
 * 字段缺失处由 service 层适配，types 描述「期望存在」的最大集。
 *
 * Spec: super-tool-node/docs/superpowers/specs/2026-05-29-积分成长体系H5页面-design.md
 */

// === 等级（GET /api/member/levels） ===
export interface MemberLevelItem {
  id: number;
  name: string;
  code: string;
  level: number;
  icon: string | null;
  color: string | null;
  upgradePoints: number;
  upgradeGrowth: number;
  upgradeConsume: string;
  benefits: Record<string, any> | null;
  description: string | null;
  sort: number;
  status: number;
  createdAt?: string;
  updatedAt?: string;
}

// === 当前用户权益对比（GET /api/member/benefits） ===
export interface MemberBenefitsResponse {
  current: MemberLevelItem;
  next: MemberLevelItem | null;
  benefitsDiff?: Array<{
    key: string;
    name: string;
    currentValue: any;
    nextValue: any;
    locked: boolean;
  }>;
}

// === 签到 ===
export interface SignStatus {
  signedToday: boolean;
  continuousDays: number;
  totalDays: number;
  todayPoints?: number;
  weekCalendar?: Array<{ date: string; signed: boolean }>;
  monthCalendar?: Array<{ date: string; signed: boolean }>;
}
export interface SignResult {
  points: number;
  growth: number;
  continuousDays: number;
  bonusPoints?: number;
}

// === 任务 ===
// 任务分类（与后端 Task.category 对齐）
export type TaskCategory = 'newbie' | 'daily' | 'achievement' | 'activity';
export type TaskStatus = 'pending' | 'completed' | 'claimed' | 'expired';
export interface TaskItem {
  code: string;
  name: string;
  description?: string;
  category: TaskCategory;
  rewardPoints: number;
  rewardGrowth?: number;
  progress: number;
  progressTarget: number;
  status: TaskStatus;
  expireAt?: string;
  icon?: string;
  requiredLevel?: string | null;
  jumpPath?: string;
}
export interface TaskClaimResult {
  points: number;
  growth?: number;
}

// === 积分流水 ===
export interface PointsLog {
  id: number;
  type: number;
  userId: number;
  title: string;
  points: number;
  growthValue?: number;
  description: string;
  createdAt: string;
  expireAt?: string | null;
  metadata?: Record<string, any>;
}
export interface PointsLogsQuery {
  page?: number;
  pageSize?: number;
  type?: number | 'all';
  startDate?: string;
  endDate?: string;
}
export interface PointsLogsResponse {
  list: PointsLog[];
  total: number;
  page: number;
  pageSize: number;
}

// === 商城 ===
export type MallItemCategory = 'benefit' | 'coupon' | 'physical' | 'thirdparty' | 'tool_unlock';
export type MallItemTag = 'hot' | 'limited' | 'levelExclusive' | 'newArrival';

export interface MallItem {
  id: number;
  name: string;
  description?: string;
  images: string[];
  pointsRequired: number;
  pointsActual?: number;
  stock?: number;
  category?: MallItemCategory;
  tags?: MallItemTag[];
  exclusiveLevel?: string;
  monthlyLimit?: number;
  monthlyUsed?: number;
  exchangedCount?: number;
  saleEndAt?: string;
}
export interface MallItemsQuery {
  page?: number;
  pageSize?: number;
  category?: MallItemCategory;
}
export interface ExchangeResult {
  orderId: number;
  orderNo: string;
  costPoints: number;
  remainingPoints: number;
}
export type MallOrderStatus = 'pending' | 'completed' | 'shipping' | 'cancelled';
export interface MallOrder {
  id: number;
  orderNo: string;
  itemId: number;
  itemName: string;
  itemImage?: string;
  costPoints: number;
  status: MallOrderStatus;
  createdAt: string;
  trackingInfo?: { carrier: string; number: string };
}
export interface MallOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: MallOrderStatus | 'all';
}

// === 用户券 ===
export interface UserCoupon {
  id: number;
  userId: number;
  orderId: number;
  couponCode: string;
  couponType: 'fixed' | 'percent';
  discount: number;
  threshold: number;
  status: number; // 1=未使用, 0=已使用
  usedAt?: string | null;
  expireAt: string;
  createdAt: string;
}

export interface CouponUseResult {
  couponId: number;
  discountAmount: number;
}

/**
 * 积分商城接口
 *
 * - GET /api/points-mall/items：商品列表（分页 + 分类筛选）
 * - POST /api/points-mall/exchange：兑换商品，必传 Idempotency-Key（限流 5 次/分钟）
 * - GET /api/points-mall/orders：兑换订单列表（分页 + 状态筛选）
 * - GET /api/points-mall/coupons：我的券列表
 * - POST /api/points-mall/coupons/use：使用券
 *
 * 后端字段缺失处由 adaptItem / adaptOrder 兜底。
 *
 * Plan: Task 1.6
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type {
  MallItem,
  MallItemsQuery,
  MallOrder,
  MallOrdersQuery,
  ExchangeResult,
  UserCoupon,
} from '../types/points';

const DEFAULT_ITEM_IMG = '/assets/icons/default-mall-item.png';

/** 后端 raw item → 前端 MallItem（兜底字段缺失） */
export const adaptMallItem = (raw: any): MallItem => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  images:
    Array.isArray(raw.images) && raw.images.length
      ? raw.images
      : raw.image
        ? [raw.image]
        : [DEFAULT_ITEM_IMG],
  pointsRequired: Number(raw.pointsRequired ?? raw.points ?? 0),
  pointsActual:
    raw.pointsActual !== undefined
      ? Number(raw.pointsActual)
      : Number(raw.pointsRequired ?? raw.points ?? 0),
  stock: raw.stock,
  category: raw.category || 'benefit',
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  exclusiveLevel: raw.exclusiveLevel,
  monthlyLimit: raw.monthlyLimit,
  monthlyUsed: raw.monthlyUsed,
  exchangedCount: raw.exchangedCount,
  saleEndAt: raw.saleEndAt,
});

export const adaptMallOrder = (raw: any): MallOrder => ({
  id: raw.id,
  orderNo: raw.orderNo || raw.order_no || `MO${raw.id}`,
  itemId: raw.itemId,
  itemName: raw.itemName || raw.item?.name || '商品',
  itemImage: raw.itemImage || raw.item?.image,
  costPoints: Number(raw.costPoints ?? 0),
  status: raw.status || 'completed',
  createdAt: raw.createdAt,
  trackingInfo: raw.trackingInfo,
});

export const getMallItems = async (
  params: MallItemsQuery = {},
): Promise<ApiResult<{ list: MallItem[]; total: number }>> => {
  const res: any = await request.get('/api/points-mall/items', { params });
  if (res?.code === 200 && res.data) {
    const rawList = Array.isArray(res.data) ? res.data : res.data.list || [];
    const total = Array.isArray(res.data)
      ? rawList.length
      : res.data.total || rawList.length;
    return {
      code: 200,
      message: res.message,
      data: { list: rawList.map(adaptMallItem), total },
    };
  }
  return res;
};

export const exchangeItem = (
  itemId: number,
  idemKey: string,
): Promise<ApiResult<ExchangeResult>> =>
  request.post('/api/points-mall/exchange', {
    data: { itemId },
    headers: { 'Idempotency-Key': idemKey },
  });

export const getMallOrders = async (
  params: MallOrdersQuery = {},
): Promise<ApiResult<{ list: MallOrder[]; total: number }>> => {
  const res: any = await request.get('/api/points-mall/orders', { params });
  if (res?.code === 200 && res.data) {
    const rawList = Array.isArray(res.data) ? res.data : res.data.list || [];
    const total = Array.isArray(res.data)
      ? rawList.length
      : res.data.total || rawList.length;
    return {
      code: 200,
      message: res.message,
      data: { list: rawList.map(adaptMallOrder), total },
    };
  }
  return res;
};

/** 获取用户券列表 */
export const getUserCoupons = async (
  status: 'unused' | 'used' | 'expired' | 'all' = 'unused',
): Promise<ApiResult<UserCoupon[]>> => {
  const res: any = await request.get('/api/points-mall/coupons', {
    params: { status },
  });
  if (res?.code === 200 && res.data) {
    return { code: 200, data: res.data };
  }
  return res;
};

/** 使用券 */
export const useCoupon = async (
  orderAmount: number,
  couponId?: number,
): Promise<ApiResult<{ couponId: number; discountAmount: number } | null>> => {
  const res: any = await request.post('/api/points-mall/coupons/use', {
    data: { orderAmount, couponId },
  });
  if (res?.code === 200) {
    return { code: 200, data: res.data };
  }
  return res;
};

/** 获取用户已解锁工具列表 */
export const getUnlockedTools = async (): Promise<ApiResult<string[]>> => {
  const res: any = await request.get('/api/points-mall/unlocked-tools');
  if (res?.code === 200 && res.data) {
    return { code: 200, data: res.data };
  }
  return res;
};

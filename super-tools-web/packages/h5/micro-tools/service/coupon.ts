/**
 * 优惠券接口（H5 端）
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';

export interface AvailableCoupon {
  id: number;
  couponCode: string;
  couponType: 'fixed' | 'percent';
  discount: number;
  threshold: number;
  applicableScenes?: any;
  status: 'unused' | 'used' | 'expired';
  expireAt: string;
  discountAmount: number;
}

export interface CouponListResult {
  list: AvailableCoupon[];
  bestCoupon: AvailableCoupon | null;
}

/** 获取可用于会员订阅的优惠券列表 */
export const getAvailableCoupons = (
  amount: number,
): Promise<ApiResult<CouponListResult>> =>
  request.get('/api/coupons/available-for-subscription', {
    params: { amount },
  });

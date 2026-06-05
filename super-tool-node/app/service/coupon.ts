import BaseService from './base';
import { Op, Sequelize } from 'sequelize';

export default class CouponService extends BaseService {
  /**
   * 获取可用于会员订阅的优惠券列表
   */
  async getAvailableForSubscription(userId: number, targetAmount: number) {
    const { ctx } = this;

    const coupons = await ctx.model.UserCoupon.findAll({
      where: {
        userId,
        status: 'unused',
        expireAt: { [Op.gt]: new Date() },
        [Op.or]: [
          { applicableScenes: { [Op.is]: null } },
          { applicableScenes: { [Op.like]: '%"member_subscription"%' } },
        ],
      },
      order: [['expireAt', 'ASC']],
    });

    // 过滤：满减券需要满足门槛
    const validCoupons = coupons.filter((c: any) => {
      const coupon = c.toJSON ? c.toJSON() : c;
      if (coupon.threshold === 0) return true;
      return targetAmount >= coupon.threshold;
    });

    return validCoupons.map((c: any) => {
      const coupon = c.toJSON ? c.toJSON() : c;
      const discountAmount = this._calcDiscountAmount(coupon, targetAmount);
      return {
        ...coupon,
        discountAmount,
      };
    });
  }

  /**
   * 选择最佳优惠券
   */
  pickBestCoupon(coupons: any[], targetAmount: number): any | null {
    if (!coupons || coupons.length === 0) return null;

    let best = null;
    let maxDiscount = 0;

    for (const coupon of coupons) {
      const discountAmount = coupon.discountAmount || this._calcDiscountAmount(coupon, targetAmount);
      if (discountAmount > maxDiscount) {
        maxDiscount = discountAmount;
        best = coupon;
      }
    }

    return best;
  }

  /**
   * 计算优惠券抵扣金额
   */
  _calcDiscountAmount(coupon: any, targetAmount: number): number {
    if (coupon.couponType === 'fixed') {
      return Math.min(coupon.discount, targetAmount);
    } else if (coupon.couponType === 'percent') {
      const discountRate = Number(coupon.discount);
      return Math.round(targetAmount * (1 - discountRate) * 100) / 100;
    }
    return 0;
  }

  /**
   * 验证优惠券是否可用于订阅
   */
  async validateCouponForSubscription(couponId: number, userId: number, targetAmount: number) {
    const coupon = await this.ctx.model.UserCoupon.findOne({
      where: {
        id: couponId,
        userId,
        status: 'unused',
        expireAt: { [Op.gt]: new Date() },
      },
    });

    if (!coupon) return { valid: false, error: '优惠券不存在或已使用' };

    const couponData = (coupon as any).toJSON();

    // 检查适用场景
    if (couponData.applicableScenes) {
      let scenes: string[];
      if (Array.isArray(couponData.applicableScenes)) {
        scenes = couponData.applicableScenes;
      } else {
        try {
          scenes = JSON.parse(couponData.applicableScenes);
        } catch {
          scenes = [];
        }
      }
      if (!scenes.includes('member_subscription')) {
        return { valid: false, error: '该优惠券不可用于会员订阅' };
      }
    }

    // 检查门槛
    if (couponData.threshold > 0 && targetAmount < couponData.threshold) {
      return { valid: false, error: `该优惠券需要满足 ${couponData.threshold} 元门槛` };
    }

    const discountAmount = this._calcDiscountAmount(couponData, targetAmount);

    return {
      valid: true,
      coupon: couponData,
      discountAmount,
      finalAmount: Math.max(0, targetAmount - discountAmount),
    };
  }

  /**
   * 锁定优惠券
   */
  async lockCoupon(couponId: number, paymentId: number) {
    await this.ctx.model.UserCoupon.update(
      { lockedPaymentId: paymentId },
      { where: { id: couponId, status: 'unused', lockedPaymentId: null } }
    );
  }

  /**
   * 解锁优惠券
   */
  async unlockCoupon(couponId: number) {
    await this.ctx.model.UserCoupon.update(
      { lockedPaymentId: null },
      { where: { id: couponId } }
    );
  }

  /**
   * 标记优惠券为已使用
   */
  async markCouponUsed(couponId: number) {
    await this.ctx.model.UserCoupon.update(
      { status: 'used', usedAt: new Date(), lockedPaymentId: null },
      { where: { id: couponId } }
    );
  }
}

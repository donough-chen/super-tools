import BaseService from './base';

export default class CouponService extends BaseService {
  /**
   * 获取可用于会员订阅的优惠券列表
   * 规则：
   * 1. status = 'unused'
   * 2. 未过期（expire_at > now()）
   * 3. applicable_scenes 包含 'member_subscription'（或 NULL 表示全场景）
   * 4. 满减券需要 targetAmount >= threshold
   */
  async getAvailableForSubscription(userId: number, targetAmount: number) {
    const { ctx, app } = this;
    const userIdNum = typeof userId === 'number' ? userId : Number(userId);

    const coupons = await ctx.model.UserCoupon.findAll({
      where: {
        userId: userIdNum,
        status: 'unused',
        expireAt: { [app.Sequelize.Op.gt]: new Date() },
        [app.Sequelize.Op.or]: [
          { applicableScenes: { [app.Sequelize.Op.is]: null } },
          { applicableScenes: { [app.Sequelize.Op.like]: '%"member_subscription"%' } },
        ],
      },
      order: [['expireAt', 'ASC']],
    });

    // 过滤：满减券需要满足门槛
    const validCoupons = coupons.filter((c: any) => {
      const coupon = c.toJSON();
      // 无门槛券（threshold = 0）始终可用
      if (coupon.threshold === 0) return true;
      // 满减券需要订阅金额 >= 门槛
      return targetAmount >= coupon.threshold;
    });

    return validCoupons.map((c: any) => {
      const coupon = c.toJSON();
      // 计算抵扣金额
      const discountAmount = this._calcDiscountAmount(coupon, targetAmount);
      return {
        ...coupon,
        discountAmount,
      };
    });
  }

  /**
   * 选择最佳优惠券（每次限用一张）
   * 规则：抵扣金额最大的优先
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
      // 固定金额抵扣
      return Math.min(coupon.discount, targetAmount); // 抵扣金额不超过订单金额
    } else if (coupon.couponType === 'percent') {
      // 折扣券：discount 是折扣率（0.9 = 9折）
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
        expireAt: { [this.app.Sequelize.Op.gt]: new Date() },
      },
    });

    if (!coupon) return { valid: false, error: '优惠券不存在或已使用' };

    const couponData = (coupon as any).toJSON();

    // 检查适用场景
    if (couponData.applicableScenes) {
      const scenes = Array.isArray(couponData.applicableScenes)
        ? couponData.applicableScenes
        : JSON.parse(couponData.applicableScenes);
      if (!scenes.includes('member_subscription')) {
        return { valid: false, error: '该优惠券不可用于会员订阅' };
      }
    }

    // 检查门槛
    if (couponData.threshold > 0 && targetAmount < couponData.threshold) {
      return { valid: false, error: `该优惠券需要满足 ${couponData.threshold} 元门槛` };
    }

    // 计算抵扣金额
    const discountAmount = this._calcDiscountAmount(couponData, targetAmount);

    return {
      valid: true,
      coupon: couponData,
      discountAmount,
      finalAmount: Math.max(0, targetAmount - discountAmount),
    };
  }

  /**
   * 锁定优惠券（创建支付时）
   */
  async lockCoupon(couponId: number, paymentId: number) {
    await this.ctx.model.UserCoupon.update(
      { lockedPaymentId: paymentId },
      { where: { id: couponId, status: 'unused', lockedPaymentId: null } }
    );
  }

  /**
   * 解锁优惠券（支付失败时）
   */
  async unlockCoupon(couponId: number) {
    await this.ctx.model.UserCoupon.update(
      { lockedPaymentId: null },
      { where: { id: couponId } }
    );
  }

  /**
   * 标记优惠券为已使用（支付成功时）
   */
  async markCouponUsed(couponId: number) {
    await this.ctx.model.UserCoupon.update(
      { status: 'used', usedAt: new Date(), lockedPaymentId: null },
      { where: { id: couponId } }
    );
  }
}

import BaseController from './base';

/**
 * 优惠券 Controller
 * 路由前缀: /api/coupons
 */
export default class CouponController extends BaseController {
  /** GET /api/coupons/available-for-subscription — 获取可用于会员订阅的优惠券 */
  async availableForSubscription() {
    const userId = (this.ctx.state.user as any).id;
    const { amount } = this.ctx.query; // 订阅金额，用于门槛校验

    const targetAmount = amount ? Number(amount) : 0;

    const coupons = await this.service.coupon.getAvailableForSubscription(userId, targetAmount);

    // 自动计算最佳优惠券
    const bestCoupon = this.service.coupon.pickBestCoupon(coupons, targetAmount);

    this.success({
      list: coupons,
      bestCoupon,
    });
  }
}
